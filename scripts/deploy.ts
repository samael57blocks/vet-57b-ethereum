import { ethers } from "hardhat";

async function main() {
  // -------------------------------------------------------------------
  // 1. Deploy MockERC20 (USDC with 6 decimals)
  // -------------------------------------------------------------------
  console.log("Deploying MockERC20 (USDC)...");

  const usdcFactory = await ethers.getContractFactory("MockERC20");
  const usdc = await usdcFactory.deploy("USDC", "USDC", 6, ethers.parseUnits("1000000", 6));
  await usdc.waitForDeployment();

  const usdcAddress = await usdc.getAddress();
  console.log(`MockERC20 (USDC) deployed to: ${usdcAddress}`);

  // -------------------------------------------------------------------
  // 2. Deploy VetRegistry
  // -------------------------------------------------------------------
  console.log("Deploying VetRegistry...");

  const factory = await ethers.getContractFactory("VetRegistry");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`VetRegistry deployed to: ${address}`);

  // -------------------------------------------------------------------
  // 3. Deploy MockPriceFeed
  // -------------------------------------------------------------------
  console.log("Deploying MockPriceFeed...");

  const priceFeedFactory = await ethers.getContractFactory("MockPriceFeed");
  const priceFeed = await priceFeedFactory.deploy();
  await priceFeed.waitForDeployment();

  const priceFeedAddress = await priceFeed.getAddress();
  console.log(`MockPriceFeed deployed to: ${priceFeedAddress}`);

  // -------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------
  console.log("\n=== Deployment Summary ===");
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);
  console.log(`VITE_USDC_ADDRESS=${usdcAddress}`);
  console.log(`VITE_PRICE_FEED_ADDRESS=${priceFeedAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
