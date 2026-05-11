# Vet 57B - Solana Development Exercise

A hands-on exercise designed to challenge developers in building a **Solana program** for veterinary clinic management. This exercise tests core Solana development skills including account creation, data manipulation, and program interaction, while also exploring off-chain data consumption and presentation.

## Overview

The 57B Veterinary offers medical services for the pets in their community, they take register of each pets the take care in the clinic including basic information like name, age, type of animal, and caretaker's information. Additionally, they need to have registers on each medical appointment the create for a pet where they are able to include the reason for the appointment, date, and billing information.

In the last period, they perceived an increase on the flow of clients into the veterinary. 

---

## 🎯 Exercise Goal

Build a complete system to administrate pets in the 57B veterinary clinic, managing their basic information, medical appointments, and enabling payments using cryptocurrencies.

---

## 📋 Developer Tasks

### 1. Solana Program Development

Create a Solana program that manages veterinary data with the following capabilities:

#### Medical Records

Manage pet information as "Medical Records" with the following data structure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the medical record |
| `name` | `string` | Name of the pet |
| `age` | `number` | Age of the pet |
| `caretakerName` | `string` | Name of the pet's caretaker |
| `caretakerPhone` | `string` | Phone number of the pet's caretaker |

> 📄 TypeScript definition: [`solana/app/models/medical_record.model.ts`](./solana/app/models/medical_record.model.ts)

#### Medical Appointments

Create and manage medical appointments for pets with the following data structure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier for the appointment |
| `petId` | `string` | Reference to the pet's medical record |
| `date` | `Date` | Date of the appointment |
| `time` | `string` | Time of the appointment |
| `appointmentValue` | `number` | Total cost of the appointment (in dollar cents) |
| `paidValue` | `number` | Amount already paid by the caretaker (in dollar cents) |

> 📄 TypeScript definition: [`solana/app/models/medical_appointment.model.ts`](./solana/app/models/medical_appointment.model.ts)

---

### 2. Backend Service (Data Consumption)

Build a backend service that bridges on-chain data with traditional application architecture:

#### Event Listening
- Subscribe to Solana program events for:
  - Pet/Medical Record creation
  - Medical Appointment creation
- Persist captured events into a database

#### RESTful API
Expose endpoints to read veterinary data from the database:
- Retrieve all pets/medical records
- Retrieve medical appointments
- Query appointments by pet ID

---

## 🗂️ Project Structure

```
vet-57b/
├── solana/                    # Solana program & client
│   ├── programs/vet-57b/      # Anchor program (Rust)
│   ├── app/                   # TypeScript client & models
│   │   └── models/            # Data type definitions
│   ├── tests/                 # Program test suite
│   └── migrations/            # Deployment scripts
│
└── web-app/                   # Frontend application (React + Vite)
    └── src/
        ├── pets/              # Pets feature module
        ├── common/            # Shared components
        └── config/            # App configuration
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Solana |
| Smart Contract Framework | Anchor |
| Program Language | Rust |
| Client SDK | TypeScript |
| Frontend | React + Vite |

---

## 🚀 Getting Started

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://www.anchor-lang.com/docs/installation)
- [Node.js](https://nodejs.org/) (v18+)
- [Yarn](https://yarnpkg.com/)

### Solana Program

```bash
# Navigate to solana directory
cd solana

# Install dependencies
yarn install

# Build the program
anchor build

# Run tests
anchor test
```

### Web Application

```bash
# Navigate to web-app directory
cd web-app

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## 📝 Evaluation Criteria

- **Account Management**: Proper creation and management of Solana accounts
- **Data Serialization**: Correct handling of on-chain data structures
- **Program Instructions**: Well-designed instruction handlers
- **Testing**: Comprehensive test coverage for program functionality
- **Event Emission**: Proper event emission for off-chain consumption
- **API Design**: Clean and RESTful API implementation
- **Code Quality**: Clean, readable, and well-documented code

---

## 📚 Resources

- [Solana Documentation](https://docs.solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)

---

*This exercise is part of the 57Blocks Web3 development training program.*
# repo
