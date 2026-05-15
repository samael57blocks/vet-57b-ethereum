import { ethers } from "hardhat";

async function main() {
  console.log("Deploying VetRegistry...");

  const factory = await ethers.getContractFactory("VetRegistry");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`VetRegistry deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
