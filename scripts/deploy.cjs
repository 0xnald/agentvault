const { ethers } = require("hardhat");

async function main() {
  const dailySpendLimit = ethers.parseUnits("750", 6);
  const approvalThreshold = ethers.parseUnits("300", 6);

  const AgentVault = await ethers.getContractFactory("AgentVault");
  const vault = await AgentVault.deploy(dailySpendLimit, approvalThreshold);
  await vault.waitForDeployment();

  console.log(`AgentVault deployed to: ${await vault.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
