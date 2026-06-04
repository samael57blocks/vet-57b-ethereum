import { expect } from "chai";
import { ethers } from "hardhat";
import { VetRegistry, VetRegistry__factory, MockERC20, MockERC20__factory, MockPriceFeed, MockPriceFeed__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const VET_ROLE = ethers.id("VET_ROLE");

describe("VetRegistry", () => {
  let registry: VetRegistry;
  let owner: SignerWithAddress;
  let payer: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const PET_1 = {
    name: "Boby",
    age: 5,
    animalType: 0, // Dog
    caretakerName: "John Doe",
    caretakerPhone: "+56912345678",
  };

  const PET_2 = {
    name: "Mimi",
    age: 3,
    animalType: 1, // Cat
    caretakerName: "Jane Doe",
    caretakerPhone: "+56987654321",
  };

  beforeEach(async () => {
    [owner, payer, unauthorized] = await ethers.getSigners();
    const factory = new VetRegistry__factory(owner);
    registry = await factory.deploy();
  });

  describe("Pet Registration", () => {
    it("Registers a new pet and emits MedicalRecordCreated event", async () => {
      const tx = await registry.registerPet(
        PET_1.name,
        PET_1.age,
        PET_1.animalType,
        owner.address,
        PET_1.caretakerName,
        PET_1.caretakerPhone
      );

      await expect(tx)
        .to.emit(registry, "MedicalRecordCreated")
        .withArgs(1, owner.address, PET_1.name, PET_1.age, PET_1.animalType, PET_1.caretakerName, PET_1.caretakerPhone);
    });

    it("Increments pet count after registration", async () => {
      expect(await registry.getPetCount()).to.equal(0);

      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone);
      expect(await registry.getPetCount()).to.equal(1);

      await registry.registerPet(PET_2.name, PET_2.age, PET_2.animalType, owner.address, PET_2.caretakerName, PET_2.caretakerPhone);
      expect(await registry.getPetCount()).to.equal(2);
    });

    it("Returns the assigned pet ID", async () => {
      const tx = await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone);
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });

    it("Reverts when name is empty", async () => {
      await expect(
        registry.registerPet("", PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone)
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Reverts when age is 0", async () => {
      await expect(
        registry.registerPet(PET_1.name, 0, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone)
      ).to.be.revertedWith("Age must be greater than 0");
    });
  });

  describe("Medical Record Queries", () => {
    it("Returns the correct medical record for a pet", async () => {
      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone);

      const record = await registry.getMedicalRecord(1);
      expect(record.name).to.equal(PET_1.name);
      expect(record.age).to.equal(PET_1.age);
      expect(record.animalType).to.equal(PET_1.animalType);
      expect(record.caretakerName).to.equal(PET_1.caretakerName);
      expect(record.caretakerPhone).to.equal(PET_1.caretakerPhone);
      expect(record.owner).to.equal(owner.address);
    });

    it("Returns correct records for multiple pets", async () => {
      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone);
      await registry.registerPet(PET_2.name, PET_2.age, PET_2.animalType, owner.address, PET_2.caretakerName, PET_2.caretakerPhone);

      const record1 = await registry.getMedicalRecord(1);
      expect(record1.name).to.equal(PET_1.name);

      const record2 = await registry.getMedicalRecord(2);
      expect(record2.name).to.equal(PET_2.name);
    });

    it("Reverts when querying a non-existent pet", async () => {
      await expect(registry.getMedicalRecord(99)).to.be.revertedWith("Pet does not exist");
    });
  });

  describe("Appointment Scheduling", () => {
    const APPOINTMENT = {
      date: 1715338800, // Unix timestamp
      time: "10:30",
      appointmentValue: 5000, // dollar cents
    };

    beforeEach(async () => {
      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone);
    });

    it("Schedules an appointment and emits MedicalAppointmentCreated event", async () => {
      const tx = await registry.scheduleAppointment(1, APPOINTMENT.date, APPOINTMENT.time, APPOINTMENT.appointmentValue);

      await expect(tx)
        .to.emit(registry, "MedicalAppointmentCreated")
        .withArgs(1, 1, APPOINTMENT.date, APPOINTMENT.time, APPOINTMENT.appointmentValue);
    });

    it("Reverts when scheduling for a non-existent pet", async () => {
      await expect(
        registry.scheduleAppointment(99, APPOINTMENT.date, APPOINTMENT.time, APPOINTMENT.appointmentValue)
      ).to.be.revertedWith("Pet does not exist");
    });

    it("Reverts when date is 0", async () => {
      await expect(
        registry.scheduleAppointment(1, 0, APPOINTMENT.time, APPOINTMENT.appointmentValue)
      ).to.be.revertedWith("Date must be provided");
    });

    it("Reverts when appointment value is 0", async () => {
      await expect(
        registry.scheduleAppointment(1, APPOINTMENT.date, APPOINTMENT.time, 0)
      ).to.be.revertedWith("Appointment value must be greater than 0");
    });
  });

  describe("Appointment View Functions", () => {
    const VIEW_APPOINTMENT = {
      date: 1715338800, // Unix timestamp
      time: "10:30",
      appointmentValue: 5000, // dollar cents
    };

    beforeEach(async () => {
      // Register two pets for view function tests
      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone);
      await registry.registerPet(PET_2.name, PET_2.age, PET_2.animalType, owner.address, PET_2.caretakerName, PET_2.caretakerPhone);
    });

    it("should return appointment by id", async () => {
      await registry.scheduleAppointment(1, VIEW_APPOINTMENT.date, VIEW_APPOINTMENT.time, VIEW_APPOINTMENT.appointmentValue);

      const appointment = await registry.getAppointment(1);
      expect(appointment.petId).to.equal(1);
      expect(appointment.date).to.equal(VIEW_APPOINTMENT.date);
      expect(appointment.time).to.equal(VIEW_APPOINTMENT.time);
      expect(appointment.appointmentValue).to.equal(VIEW_APPOINTMENT.appointmentValue);
      expect(appointment.paidValue).to.equal(0);
    });

    it("should revert when appointment does not exist", async () => {
      await expect(registry.getAppointment(999)).to.be.revertedWith("Appointment does not exist");
    });

    it("should return empty array for pet with no appointments", async () => {
      const ids = await registry.getPetAppointments(1);
      expect(ids.length).to.equal(0);
    });

    it("should return appointments for a specific pet", async () => {
      await registry.scheduleAppointment(1, VIEW_APPOINTMENT.date, VIEW_APPOINTMENT.time, VIEW_APPOINTMENT.appointmentValue);
      await registry.scheduleAppointment(1, VIEW_APPOINTMENT.date, VIEW_APPOINTMENT.time, VIEW_APPOINTMENT.appointmentValue);
      await registry.scheduleAppointment(2, VIEW_APPOINTMENT.date, VIEW_APPOINTMENT.time, VIEW_APPOINTMENT.appointmentValue);

      const ids = await registry.getPetAppointments(1);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1);
      expect(ids[1]).to.equal(2);
    });

    it("should return total appointment count", async () => {
      expect(await registry.getAppointmentCount()).to.equal(0);

      await registry.scheduleAppointment(1, VIEW_APPOINTMENT.date, VIEW_APPOINTMENT.time, VIEW_APPOINTMENT.appointmentValue);
      expect(await registry.getAppointmentCount()).to.equal(1);

      await registry.scheduleAppointment(2, VIEW_APPOINTMENT.date, VIEW_APPOINTMENT.time, VIEW_APPOINTMENT.appointmentValue);
      expect(await registry.getAppointmentCount()).to.equal(2);
    });
  });

  describe("Access Control", () => {
    it("should revert when non-VET calls registerPet", async () => {
      await expect(
        registry.connect(payer).registerPet(PET_1.name, PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(payer.address, VET_ROLE);
    });

    it("should revert when non-VET calls scheduleAppointment", async () => {
      // Register a pet first as owner (deployer has VET_ROLE)
      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone);

      await expect(
        registry.connect(payer).scheduleAppointment(1, 1715338800, "10:30", 5000)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(payer.address, VET_ROLE);
    });
  });

  describe("Owner-Gated Payments", () => {
    let usdc: MockERC20;
    let petOwner: SignerWithAddress;

    const GATED_APPOINTMENT = {
      date: 1715338800,
      time: "10:30",
      appointmentValue: 5000, // $50 in cents
    };

    beforeEach(async () => {
      petOwner = payer; // alias for clarity

      // Deploy MockERC20 (USDC with 6 decimals)
      const usdcFactory = new MockERC20__factory(owner);
      usdc = await usdcFactory.deploy("USDC", "USDC", 6, ethers.parseUnits("1000000", 6));

      // Register a pet with petOwner as the MedicalRecord.owner
      await registry.registerPet(
        PET_1.name,
        PET_1.age,
        PET_1.animalType,
        petOwner.address,  // <-- petOwner is the recorded owner
        PET_1.caretakerName,
        PET_1.caretakerPhone
      );
      await registry.scheduleAppointment(
        1,
        GATED_APPOINTMENT.date,
        GATED_APPOINTMENT.time,
        GATED_APPOINTMENT.appointmentValue
      );

      // Give petOwner USDC and approve registry to spend
      await usdc.connect(owner).transfer(petOwner.address, ethers.parseUnits("1000", 6));
      await usdc.connect(petOwner).approve(registry.target, ethers.parseUnits("1000", 6));
    });

    it("should revert when non-owner pays with token", async () => {
      await expect(
        registry.connect(unauthorized).payAppointmentToken(1, await usdc.getAddress())
      ).to.be.revertedWith("Not pet owner");
    });

    it("should revert when non-owner pays with ETH", async () => {
      const feedFactory = new MockPriceFeed__factory(owner);
      const priceFeed = await feedFactory.deploy();
      const priceFeedAddress = await priceFeed.getAddress();

      await expect(
        registry.connect(unauthorized).payAppointmentEth(1, priceFeedAddress, {
          value: ethers.parseEther("0.025"),
        })
      ).to.be.revertedWith("Not pet owner");
    });
  });

  describe("Payment", () => {
    let usdc: MockERC20;
    let payer: SignerWithAddress;

    const PAYMENT_APPOINTMENT = {
      date: 1715338800,
      time: "10:30",
      appointmentValue: 5000, // $50 in cents
    };

    beforeEach(async () => {
      [, payer] = await ethers.getSigners();

      // Deploy MockERC20 (USDC with 6 decimals)
      const usdcFactory = new MockERC20__factory(owner);
      usdc = await usdcFactory.deploy("USDC", "USDC", 6, ethers.parseUnits("1000000", 6));

      // Register a pet with payer as the MedicalRecord.owner
      await registry.registerPet(
        PET_1.name,
        PET_1.age,
        PET_1.animalType,
        payer.address,  // <-- payer IS the pet owner
        PET_1.caretakerName,
        PET_1.caretakerPhone
      );
      await registry.scheduleAppointment(
        1,
        PAYMENT_APPOINTMENT.date,
        PAYMENT_APPOINTMENT.time,
        PAYMENT_APPOINTMENT.appointmentValue
      );

      // Give payer USDC and approve registry to spend
      await usdc.connect(owner).transfer(payer.address, ethers.parseUnits("1000", 6));
      await usdc.connect(payer).approve(registry.target, ethers.parseUnits("1000", 6));
    });

    it("should pay an unpaid appointment with USDC", async () => {
      const tokenAddress = await usdc.getAddress();
      const expectedAmount = ethers.parseUnits("50", 6); // 5000 cents → 50 USDC

      const tx = await registry.connect(payer).payAppointmentToken(1, tokenAddress);

      await expect(tx)
        .to.emit(registry, "AppointmentPaidToken")
        .withArgs(1, payer.address, tokenAddress, expectedAmount);

      const appointment = await registry.getAppointment(1);
      expect(appointment.paidValue).to.equal(PAYMENT_APPOINTMENT.appointmentValue);
    });

    it("should revert when appointment does not exist", async () => {
      await expect(
        registry.connect(payer).payAppointmentToken(999, await usdc.getAddress())
      ).to.be.revertedWith("Appointment does not exist");
    });

    it("should revert when appointment already paid", async () => {
      await registry.connect(payer).payAppointmentToken(1, await usdc.getAddress());

      await expect(
        registry.connect(payer).payAppointmentToken(1, await usdc.getAddress())
      ).to.be.revertedWith("Already paid");
    });

    it("should revert when allowance is zero", async () => {
      await usdc.connect(payer).approve(registry.target, 0);

      await expect(
        registry.connect(payer).payAppointmentToken(1, await usdc.getAddress())
      ).to.be.revertedWithCustomError(registry, "SafeERC20FailedOperation");
    });

    it("should revert when balance is insufficient", async () => {
      // Drain payer's USDC balance while keeping allowance intact
      await usdc.connect(payer).transfer(owner.address, await usdc.balanceOf(payer.address));

      await expect(
        registry.connect(payer).payAppointmentToken(1, await usdc.getAddress())
      ).to.be.revertedWithCustomError(registry, "SafeERC20FailedOperation");
    });

    it("should allow admin to withdraw tokens", async () => {
      await registry.connect(payer).payAppointmentToken(1, await usdc.getAddress());

      const contractBalanceBefore = await usdc.balanceOf(registry.target);
      expect(contractBalanceBefore).to.equal(ethers.parseUnits("50", 6));

      const adminBalanceBefore = await usdc.balanceOf(owner.address);

      await registry.connect(owner).withdrawToken(await usdc.getAddress());

      expect(await usdc.balanceOf(registry.target)).to.equal(0);
      expect(await usdc.balanceOf(owner.address)).to.equal(adminBalanceBefore + ethers.parseUnits("50", 6));
    });

    it("should revert when non-admin tries to withdraw", async () => {
      await expect(
        registry.connect(payer).withdrawToken(await usdc.getAddress())
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("should reject direct ETH transfers", async () => {
      await expect(
        owner.sendTransaction({ to: registry.target, value: ethers.parseEther("1") })
      ).to.be.revertedWith("ETH not supported");
    });

    it("should revert when token decimals are ≤ 2", async () => {
      // Deploy a MockERC20 with 1 decimal to trigger the _centsToTokenUnits guard
      const lowDecFactory = new MockERC20__factory(owner);
      const lowDecToken = await lowDecFactory.deploy("LOW", "LOW", 1, ethers.parseUnits("1000", 1));
      await lowDecToken.connect(owner).transfer(payer.address, ethers.parseUnits("100", 1));
      await lowDecToken.connect(payer).approve(registry.target, ethers.parseUnits("100", 1));

      await expect(
        registry.connect(payer).payAppointmentToken(1, await lowDecToken.getAddress())
      ).to.be.revertedWith("Token decimals must be > 2");
    });
  });

  describe("ETH Payment", () => {
    let priceFeed: MockPriceFeed;
    let payer: SignerWithAddress;
    let priceFeedAddress: string;

    const ETH_APPOINTMENT = {
      date: 1715338800,
      time: "10:30",
      appointmentValue: 5000, // $50 in cents
    };

    // At $2000/ETH default price: expectedEth = (5000 * 1e24) / (2000 * 1e8) = 0.025 ETH
    const EXPECTED_ETH = ethers.parseEther("0.025");

    beforeEach(async () => {
      [, payer] = await ethers.getSigners();

      // Deploy MockPriceFeed with default $2000/ETH
      const feedFactory = new MockPriceFeed__factory(owner);
      priceFeed = await feedFactory.deploy();
      priceFeedAddress = await priceFeed.getAddress();

      // Register a pet with payer as the MedicalRecord.owner
      await registry.registerPet(
        PET_1.name,
        PET_1.age,
        PET_1.animalType,
        payer.address,  // <-- payer IS the pet owner
        PET_1.caretakerName,
        PET_1.caretakerPhone
      );
      await registry.scheduleAppointment(
        1,
        ETH_APPOINTMENT.date,
        ETH_APPOINTMENT.time,
        ETH_APPOINTMENT.appointmentValue
      );
    });

    it("should pay an unpaid appointment with exact ETH", async () => {
      const tx = await registry.connect(payer).payAppointmentEth(1, priceFeedAddress, {
        value: EXPECTED_ETH,
      });

      await expect(tx)
        .to.emit(registry, "AppointmentPaidEth")
        .withArgs(1, payer.address, EXPECTED_ETH, ETH_APPOINTMENT.appointmentValue);

      const appointment = await registry.getAppointment(1);
      expect(appointment.paidValue).to.equal(ETH_APPOINTMENT.appointmentValue);
    });

    it("should refund excess ETH", async () => {
      const excessAmount = ethers.parseEther("0.03"); // 0.03 ETH, 0.005 more than needed
      const payerBalanceBefore = await ethers.provider.getBalance(payer.address);

      const tx = await registry.connect(payer).payAppointmentEth(1, priceFeedAddress, {
        value: excessAmount,
      });

      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      // After tx: payer sent 0.03 ETH, 0.005 should be refunded, so net cost = 0.025 + gas
      const payerBalanceAfter = await ethers.provider.getBalance(payer.address);
      const netCost = payerBalanceBefore - payerBalanceAfter;
      expect(netCost).to.equal(EXPECTED_ETH + gasCost);

      // paidValue stores cents, not msg.value
      const appointment = await registry.getAppointment(1);
      expect(appointment.paidValue).to.equal(ETH_APPOINTMENT.appointmentValue);
    });

    it("should revert when appointment does not exist", async () => {
      await expect(
        registry.connect(payer).payAppointmentEth(999, priceFeedAddress, {
          value: EXPECTED_ETH,
        }),
      ).to.be.revertedWith("Appointment does not exist");
    });

    it("should revert when appointment already paid", async () => {
      await registry.connect(payer).payAppointmentEth(1, priceFeedAddress, {
        value: EXPECTED_ETH,
      });

      await expect(
        registry.connect(payer).payAppointmentEth(1, priceFeedAddress, {
          value: EXPECTED_ETH,
        }),
      ).to.be.revertedWith("Already paid");
    });

    it("should revert when insufficient ETH sent", async () => {
      const lowAmount = ethers.parseEther("0.01"); // Only $20 at $2000/ETH — insufficient for $50

      await expect(
        registry.connect(payer).payAppointmentEth(1, priceFeedAddress, {
          value: lowAmount,
        }),
      ).to.be.revertedWith("Insufficient ETH");
    });

    it("should revert when price is zero", async () => {
      await priceFeed.setPrice(0);

      await expect(
        registry.connect(payer).payAppointmentEth(1, priceFeedAddress, {
          value: EXPECTED_ETH,
        }),
      ).to.be.revertedWith("Invalid price");
    });

    it("should allow admin to withdraw ETH", async () => {
      // Make a payment so the contract has ETH
      await registry.connect(payer).payAppointmentEth(1, priceFeedAddress, {
        value: EXPECTED_ETH,
      });

      const contractBalanceBefore = await ethers.provider.getBalance(registry.target);
      expect(contractBalanceBefore).to.equal(EXPECTED_ETH);

      const adminBalanceBefore = await ethers.provider.getBalance(owner.address);

      const tx = await registry.connect(owner).withdrawEth();
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      expect(await ethers.provider.getBalance(registry.target)).to.equal(0);
      expect(await ethers.provider.getBalance(owner.address)).to.equal(
        adminBalanceBefore + EXPECTED_ETH - gasCost,
      );
    });

    it("should revert when non-admin tries to withdraw ETH", async () => {
      await expect(
        registry.connect(payer).withdrawEth(),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Admin Role Management", () => {
    it("should allow admin to grant VET_ROLE", async () => {
      await registry.connect(owner).grantRole(VET_ROLE, payer.address);
      expect(await registry.hasRole(VET_ROLE, payer.address)).to.equal(true);
    });

    it("should allow admin to revoke VET_ROLE", async () => {
      await registry.connect(owner).grantRole(VET_ROLE, payer.address);
      expect(await registry.hasRole(VET_ROLE, payer.address)).to.equal(true);

      await registry.connect(owner).revokeRole(VET_ROLE, payer.address);
      expect(await registry.hasRole(VET_ROLE, payer.address)).to.equal(false);
    });

    it("should revert when non-admin tries to grant VET_ROLE", async () => {
      await expect(
        registry.connect(payer).grantRole(VET_ROLE, unauthorized.address)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("should revert when non-admin tries to revoke VET_ROLE", async () => {
      await expect(
        registry.connect(payer).revokeRole(VET_ROLE, owner.address)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Owner Registration", () => {
    it("registers a new owner and emits OwnerRegistered event", async () => {
      const tx = await registry.connect(payer).registerAsOwner("Alice");

      await expect(tx)
        .to.emit(registry, "OwnerRegistered")
        .withArgs(payer.address, "Alice");
    });

    it("re-registration updates name without duplicate entries", async () => {
      await registry.connect(payer).registerAsOwner("Alice");

      // Re-register with updated name
      const tx = await registry.connect(payer).registerAsOwner("Alice Smith");

      await expect(tx)
        .to.emit(registry, "OwnerRegistered")
        .withArgs(payer.address, "Alice Smith");

      // Verify only one entry in the owners list
      const owners = await registry.getRegisteredOwners();
      expect(owners.length).to.equal(1);
      expect(owners[0].wallet).to.equal(payer.address);
      expect(owners[0].name).to.equal("Alice Smith");
      expect(owners[0].registered).to.equal(true);
    });

    it("reverts when name is empty", async () => {
      await expect(
        registry.connect(payer).registerAsOwner("")
      ).to.be.revertedWith("Name must be at least 2 characters");
    });

    it("reverts when name exceeds 32 characters", async () => {
      const longName = "a".repeat(33);
      await expect(
        registry.connect(payer).registerAsOwner(longName)
      ).to.be.revertedWith("Name must be at most 32 characters");
    });
  });

  describe("Owner Queries", () => {
    it("returns empty array when no owners registered", async () => {
      const owners = await registry.getRegisteredOwners();
      expect(owners.length).to.equal(0);
    });

    it("returns single owner with correct address and name", async () => {
      await registry.connect(payer).registerAsOwner("Alice");

      const owners = await registry.getRegisteredOwners();
      expect(owners.length).to.equal(1);
      expect(owners[0].wallet).to.equal(payer.address);
      expect(owners[0].name).to.equal("Alice");
      expect(owners[0].registered).to.equal(true);
    });

    it("returns multiple owners with correct entries", async () => {
      await registry.connect(payer).registerAsOwner("Alice");
      await registry.connect(unauthorized).registerAsOwner("Bob");

      const owners = await registry.getRegisteredOwners();
      expect(owners.length).to.equal(2);

      // Owners may be in any order based on registration order
      const alice = owners.find(o => o.wallet === payer.address)!;
      const bob = owners.find(o => o.wallet === unauthorized.address)!;
      expect(alice.name).to.equal("Alice");
      expect(bob.name).to.equal("Bob");
      expect(alice.registered).to.equal(true);
      expect(bob.registered).to.equal(true);
    });
  });

  describe("Owner Pet Queries", () => {
    beforeEach(async () => {
      // Register 3 pets:
      // pet 1 → owner (deployer)
      // pet 2 → payer
      // pet 3 → owner (deployer)
      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone);
      await registry.registerPet(PET_2.name, PET_2.age, PET_2.animalType, payer.address, PET_2.caretakerName, PET_2.caretakerPhone);
      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, owner.address, PET_1.caretakerName, PET_1.caretakerPhone);
    });

    it("returns empty array when owner has no pets", async () => {
      const pets = await registry.getPetsByOwner(unauthorized.address);
      expect(pets.length).to.equal(0);
    });

    it("returns single pet ID for owner with one pet", async () => {
      const pets = await registry.getPetsByOwner(payer.address);
      expect(pets.length).to.equal(1);
      expect(pets[0]).to.equal(2n);
    });

    it("returns all pet IDs for owner with multiple pets", async () => {
      const pets = await registry.getPetsByOwner(owner.address);
      expect(pets.length).to.equal(2);
      expect(pets[0]).to.equal(1n);
      expect(pets[1]).to.equal(3n);
    });

    it("returns empty array for non-existent address", async () => {
      const nonExistent = "0x0000000000000000000000000000000000000001";
      const pets = await registry.getPetsByOwner(nonExistent);
      expect(pets.length).to.equal(0);
    });
  });
});
