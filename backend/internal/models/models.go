// Package models defines the domain types used throughout the indexer.
// These structs map to both the database schema and JSON API responses.
package models

import "time"

// Pet represents a registered pet from the VetRegistry contract.
type Pet struct {
	ID             uint64    `json:"id" db:"id"`
	Name           string    `json:"name" db:"name"`
	Age            uint8     `json:"age" db:"age"`
	AnimalType     string    `json:"animalType" db:"animal_type"`
	CaretakerName  string    `json:"caretakerName" db:"caretaker_name"`
	CaretakerPhone string    `json:"caretakerPhone" db:"caretaker_phone"`
	TxHash         []byte    `json:"-" db:"tx_hash"`
	LogIndex       uint      `json:"-" db:"log_index"`
	BlockNumber    uint64    `json:"-" db:"block_number"`
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
}

// Appointment represents a medical appointment from the VetRegistry contract.
type Appointment struct {
	ID               uint64    `json:"id" db:"id"`
	PetID            uint64    `json:"petId" db:"pet_id"`
	Date             int64     `json:"date" db:"date"`
	TimeStr          string    `json:"time" db:"time_str"`
	AppointmentValue string    `json:"appointmentValue" db:"appointment_value"`
	PaidValue        string    `json:"paidValue" db:"paid_value"`
	TxHash           []byte    `json:"-" db:"tx_hash"`
	LogIndex         uint      `json:"-" db:"log_index"`
	BlockNumber      uint64    `json:"-" db:"block_number"`
	CreatedAt        time.Time `json:"createdAt" db:"created_at"`
}

// Checkpoint tracks the indexer's progress through the blockchain.
// It is a singleton row in the database.
type Checkpoint struct {
	ID                 int       `db:"id"`
	LastFinalizedBlock uint64    `db:"last_finalized_block"`
	LastFetchedBlock   uint64    `db:"last_fetched_block"`
	UpdatedAt          time.Time `db:"updated_at"`
}
