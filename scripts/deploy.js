const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Deploy Mock ERC20
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy("Vesting Token", "VEST");
  await token.waitForDeployment();
  console.log("Mock ERC20 deployed to:", await token.getAddress());

  // Deploy VestingManager
  const VestingManager = await ethers.getContractFactory("VestingManager");
  const vestingManager = await VestingManager.deploy(await token.getAddress());
  await vestingManager.waitForDeployment();
  console.log("VestingManager deployed to:", await vestingManager.getAddress());

  // Example: Create vesting schedules
  const amount1 = ethers.parseEther("100000");
  const amount2 = ethers.parseEther("50000");
  const startTime = Math.floor(Date.now() / 1000);

  await token.approve(await vestingManager.getAddress(), ethers.parseEther("1000000"));

  // Beneficiary 1: 1 year vesting, 3 months cliff
  const tx1 = await vestingManager.createVestingSchedule(
    "0xBeneficiary1Address", // Ganti dengan address beneficiary
    amount1,
    startTime,
    90 * 24 * 60 * 60, // 3 months cliff
    365 * 24 * 60 * 60 // 1 year total
  );
  await tx1.wait();
  console.log("Vesting schedule 1 created");

  // Beneficiary 2: 2 year vesting, 6 months cliff
  const tx2 = await vestingManager.createVestingSchedule(
    "0xBeneficiary2Address", // Ganti dengan address beneficiary
    amount2,
    startTime,
    180 * 24 * 60 * 60, // 6 months cliff
    730 * 24 * 60 * 60 // 2 years total
  );
  await tx2.wait();
  console.log("Vesting schedule 2 created");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
