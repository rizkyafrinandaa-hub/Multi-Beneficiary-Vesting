const { ethers } = require("hardhat");

async function main() {
  const vestingManagerAddress = "0xYourVestingManagerAddress";
  const vestingManager = await ethers.getContractAt("VestingManager", vestingManagerAddress);

  // Get beneficiary schedules
  const beneficiary = "0xBeneficiaryAddress";
  const schedules = await vestingManager.getBeneficiarySchedules(beneficiary);
  console.log("Schedules:", schedules);

  // Check releasable amount
  if (schedules.length > 0) {
    const releasable = await vestingManager.computeReleasableAmount(schedules[0]);
    console.log("Releasable amount:", ethers.formatEther(releasable));
  }

  // Release tokens (sebagai beneficiary)
  // await vestingManager.release(schedules[0]);
}

main();
