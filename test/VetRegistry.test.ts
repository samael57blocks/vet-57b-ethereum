import { expect } from "chai";
import { ethers } from "hardhat";
import { VetRegistry, VetRegistry__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VetRegistry", () => {
  let registry: VetRegistry;
  let owner: SignerWithAddress;

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
    [owner] = await ethers.getSigners();
    const factory = new VetRegistry__factory(owner);
    registry = await factory.deploy();
  });

  describe("Pet Registration", () => {
    it("Registers a new pet and emits MedicalRecordCreated event", async () => {
      const tx = await registry.registerPet(
        PET_1.name,
        PET_1.age,
        PET_1.animalType,
        PET_1.caretakerName,
        PET_1.caretakerPhone
      );

      await expect(tx)
        .to.emit(registry, "MedicalRecordCreated")
        .withArgs(1, PET_1.name, PET_1.age, PET_1.animalType, PET_1.caretakerName, PET_1.caretakerPhone);
    });

    it("Increments pet count after registration", async () => {
      expect(await registry.getPetCount()).to.equal(0);

      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, PET_1.caretakerName, PET_1.caretakerPhone);
      expect(await registry.getPetCount()).to.equal(1);

      await registry.registerPet(PET_2.name, PET_2.age, PET_2.animalType, PET_2.caretakerName, PET_2.caretakerPhone);
      expect(await registry.getPetCount()).to.equal(2);
    });

    it("Returns the assigned pet ID", async () => {
      const tx = await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, PET_1.caretakerName, PET_1.caretakerPhone);
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });

    it("Reverts when name is empty", async () => {
      await expect(
        registry.registerPet("", PET_1.age, PET_1.animalType, PET_1.caretakerName, PET_1.caretakerPhone)
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Reverts when age is 0", async () => {
      await expect(
        registry.registerPet(PET_1.name, 0, PET_1.animalType, PET_1.caretakerName, PET_1.caretakerPhone)
      ).to.be.revertedWith("Age must be greater than 0");
    });
  });

  describe("Medical Record Queries", () => {
    it("Returns the correct medical record for a pet", async () => {
      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, PET_1.caretakerName, PET_1.caretakerPhone);

      const record = await registry.getMedicalRecord(1);
      expect(record.name).to.equal(PET_1.name);
      expect(record.age).to.equal(PET_1.age);
      expect(record.animalType).to.equal(PET_1.animalType);
      expect(record.caretakerName).to.equal(PET_1.caretakerName);
      expect(record.caretakerPhone).to.equal(PET_1.caretakerPhone);
    });

    it("Returns correct records for multiple pets", async () => {
      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, PET_1.caretakerName, PET_1.caretakerPhone);
      await registry.registerPet(PET_2.name, PET_2.age, PET_2.animalType, PET_2.caretakerName, PET_2.caretakerPhone);

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
      await registry.registerPet(PET_1.name, PET_1.age, PET_1.animalType, PET_1.caretakerName, PET_1.caretakerPhone);
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
});
