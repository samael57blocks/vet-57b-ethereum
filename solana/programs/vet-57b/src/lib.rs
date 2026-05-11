use anchor_lang::prelude::*;

declare_id!("GW9yVGbyRmzwxAzNCmYHruT8FAmVLh48ibfdjniHgzx3");

#[program]
pub mod vet_57b {
    use super::*;

    /// Opens a a record for a new Pet saving its basic information.
    pub fn register_pet(ctx: Context<MockContext>) -> Result<()> {
        msg!("Registering a new pet in the Vet");
        Ok(())
    }

    /// Schedule a medical appointment for a pet.
    pub fn schedule_medical_appointment(ctx: Context<MockContext>) -> Result<()> {
        msg!("Scheduling a new medical appointment for a pet");
        Ok(())
    }

    /// Pay for a medical appointment.
    pub fn pay_medical_appointment(ctx: Context<MockContext>) -> Result<()> {
        msg!("Paying for a medical appointment");
        Ok(())
    }

    /// Take a pet to the vet.
    pub fn take_pet_to_vet(ctx: Context<MockContext>) -> Result<()> {
        msg!("Taking a pet to the vet");
        Ok(())
    }
}

/// Mock context for default usage in instructions that have not been implemented yet or its context
/// has not been defined yet.
#[derive(Accounts)]
pub struct MockContext {}
