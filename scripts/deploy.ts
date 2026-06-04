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
  // 4. Seed data — create pets and appointments for local dev
  // -------------------------------------------------------------------
  console.log("\nSeeding pets...");
  const [, owner, payer] = await ethers.getSigners();

  const pets = [
    { name: "Max", age: 3, animalType: 0, ownerAddress: owner.address, caretakerName: "Alice Johnson", caretakerPhone: "+1-555-0101" },
    { name: "Luna", age: 2, animalType: 1, ownerAddress: owner.address, caretakerName: "Bob Smith", caretakerPhone: "+1-555-0202" },
    { name: "Rocky", age: 5, animalType: 0, ownerAddress: payer.address, caretakerName: "Carol Davis", caretakerPhone: "+1-555-0303" },
  ];

  for (const pet of pets) {
    const tx = await contract.registerPet(
      pet.name,
      pet.age,
      pet.animalType,
      pet.ownerAddress,
      pet.caretakerName,
      pet.caretakerPhone
    );
    await tx.wait();
    console.log(`  Pet registered: ${pet.name} (${["Dog", "Cat"][pet.animalType]})`);
  }
  console.log("✓ 3 pets seeded");

  const now = Math.floor(Date.now() / 1000);
  const appointments = [
    { petId: 1, date: now + 86400, time: "10:00", value: 5000 },   // $50 — tomorrow
    { petId: 1, date: now + 2 * 86400, time: "14:30", value: 7500 }, // $75 — day after
    { petId: 2, date: now + 86400, time: "11:00", value: 6000 },    // $60 — tomorrow
    { petId: 3, date: now + 3 * 86400, time: "09:30", value: 4000 }, // $40 — 3 days
  ];

  for (const apt of appointments) {
    const tx = await contract.scheduleAppointment(apt.petId, apt.date, apt.time, apt.value);
    await tx.wait();
    console.log(`  Appointment scheduled: pet #${apt.petId} at ${apt.time}`);
  }
  console.log("✓ 4 appointments seeded");

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
