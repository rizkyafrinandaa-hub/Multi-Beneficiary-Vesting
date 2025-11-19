const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VestingManager", function () {
  let token, vestingManager;
  let owner, beneficiary1, beneficiary2;
  const MILLION = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, beneficiary1, beneficiary2] = await ethers.getSigners();

    // Deploy Mock ERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Test Token", "TEST");

    // Deploy VestingManager
    const VestingManager = await ethers.getContractFactory("VestingManager");
    vestingManager = await VestingManager.deploy(await token.getAddress());

    // Approve tokens for vesting
    await token.approve(await vestingManager.getAddress(), MILLION);
  });

  describe("Create Vesting Schedule", function () {
    it("Should create vesting schedule for beneficiary", async function () {
      const amount = ethers.parseEther("10000");
      const startTime = await time.latest();
      const cliffDuration = 30 * 24 * 60 * 60; // 30 days
      const duration = 365 * 24 * 60 * 60; // 1 year

      await expect(
        vestingManager.createVestingSchedule(
          beneficiary1.address,
          amount,
          startTime,
          cliffDuration,
          duration
        )
      ).to.emit(vestingManager, "VestingCreated");

      const schedules = await vestingManager.getBeneficiarySchedules(
        beneficiary1.address
      );
      expect(schedules.length).to.equal(1);
    });

    it("Should create multiple schedules for different beneficiaries", async function () {
      const amount1 = ethers.parseEther("10000");
      const amount2 = ethers.parseEther("20000");
      const startTime = await time.latest();

      await vestingManager.createVestingSchedule(
        beneficiary1.address,
        amount1,
        startTime,
        0,
        365 * 24 * 60 * 60
      );

      await vestingManager.createVestingSchedule(
        beneficiary2.address,
        amount2,
        startTime,
        60 * 24 * 60 * 60, // 60 days cliff
        730 * 24 * 60 * 60 // 2 years
      );

      const schedules1 = await vestingManager.getBeneficiarySchedules(
        beneficiary1.address
      );
      const schedules2 = await vestingManager.getBeneficiarySchedules(
        beneficiary2.address
      );

      expect(schedules1.length).to.equal(1);
      expect(schedules2.length).to.equal(1);
    });
  });

  describe("Release Tokens", function () {
    it("Should not release before cliff", async function () {
      const amount = ethers.parseEther("12000");
      const startTime = await time.latest();
      const cliffDuration = 30 * 24 * 60 * 60;

      const tx = await vestingManager.createVestingSchedule(
        beneficiary1.address,
        amount,
        startTime,
        cliffDuration,
        365 * 24 * 60 * 60
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "VestingCreated"
      );
      const scheduleId = event.args[0];

      await time.increase(15 * 24 * 60 * 60); // 15 days

      await expect(
        vestingManager.connect(beneficiary1).release(scheduleId)
      ).to.be.revertedWith("No tokens to release");
    });

    it("Should release tokens after cliff proportionally", async function () {
      const amount = ethers.parseEther("12000");
      const startTime = await time.latest();
      const cliffDuration = 30 * 24 * 60 * 60;
      const duration = 365 * 24 * 60 * 60;

      const tx = await vestingManager.createVestingSchedule(
        beneficiary1.address,
        amount,
        startTime,
        cliffDuration,
        duration
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "VestingCreated"
      );
      const scheduleId = event.args[0];

      // Fast forward 6 months
      await time.increase(182 * 24 * 60 * 60);

      const balanceBefore = await token.balanceOf(beneficiary1.address);
      await vestingManager.connect(beneficiary1).release(scheduleId);
      const balanceAfter = await token.balanceOf(beneficiary1.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("Revoke Vesting", function () {
    it("Should revoke vesting and return unvested tokens", async function () {
      const amount = ethers.parseEther("10000");
      const startTime = await time.latest();

      const tx = await vestingManager.createVestingSchedule(
        beneficiary1.address,
        amount,
        startTime,
        0,
        365 * 24 * 60 * 60
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "VestingCreated"
      );
      const scheduleId = event.args[0];

      await time.increase(100 * 24 * 60 * 60); // 100 days

      await expect(vestingManager.revokeVesting(scheduleId)).to.emit(
        vestingManager,
        "VestingRevoked"
      );

      const schedule = await vestingManager.getVestingSchedule(scheduleId);
      expect(schedule.revoked).to.equal(true);
    });
  });
});
