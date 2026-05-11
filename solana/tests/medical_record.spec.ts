import { Program } from "@coral-xyz/anchor";
import { Vet57b } from "../target/types/vet_57b";
import { TestingContext } from "./helpers/testing_context.helper";
import { givenNewMedicalRecord } from "./helpers/data_mothers";
import { MedicalRecord, MedicalRecordCreatedEvent } from "../app/models";
import { expect } from "chai";

describe('Medical record', () => {

  /** The testing context for the program */
  let testingContext: TestingContext;
  /** The vet program to invoke the instructions under test */
  let vetProgram: Program<Vet57b>;

  beforeEach(async () => {
    // Create a new testing context
    testingContext = new TestingContext();
    // Initialize the testing context
    await testingContext.initialize();

    // Load the vet program
    vetProgram = testingContext.program;
  });

  describe('New pet registration', () => {
    it('Registers a new pet', async () => {
      // Create the information for the new medical record
      const newMedicalRecord = givenNewMedicalRecord();

      // Invoke the instruction to register the new pet
      const tx = await vetProgram.methods.registerPet(newMedicalRecord).accounts({

      }).signers([testingContext.defaultSigner]).rpc();
      // Wait for the transaction to be confirmed
      await testingContext.waitForTransactions(tx);

      // Get the address of the medical record account
      const medicalRecordAddress = MedicalRecord.deriveAddress(newMedicalRecord.id, vetProgram.programId);
      // Get the medical record account
      const medicalRecord = await vetProgram.account.medicalRecord.fetch(medicalRecordAddress);
      // Assert that the medical record account is created
      expect(medicalRecord).not.to.be.null;
      // Assert that the medical record account has the correct information
      expect(medicalRecord.id.toBase58()).equals(newMedicalRecord.id.toBase58());
      expect(medicalRecord.name).equals(newMedicalRecord.name);
      expect(medicalRecord.age).equals(newMedicalRecord.age);
      expect(medicalRecord.animalType).equals(newMedicalRecord.animalType);

      // Get the event from the transaction
      const event = await testingContext.getEvent<MedicalRecordCreatedEvent>(tx);
      // Assert that the event is not null
      expect(event).not.to.be.null;
      // Assert that the event has the correct information
      expect(event.id).equals(newMedicalRecord.id.toBase58());
      expect(event.name).equals(newMedicalRecord.name);
      expect(event.age).equals(newMedicalRecord.age);
      expect(event.animalType).equals(newMedicalRecord.animalType);
      expect(event.caretakerName).equals(newMedicalRecord.caretakerName);
      expect(event.caretakerPhone).equals(newMedicalRecord.caretakerPhone);
    });
  });
});
