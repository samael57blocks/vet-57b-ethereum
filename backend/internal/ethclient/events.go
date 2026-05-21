package ethclient

import (
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// ---------------------------------------------------------------------------
// Event structs — raw event shapes from the VetRegistry contract.
// These map one-to-one with the Solidity event parameters. They are NOT domain
// models; the indexer transforms them into domain models (package models).
// ---------------------------------------------------------------------------

// MedicalRecordCreated is emitted when a new pet medical record is registered.
type MedicalRecordCreated struct {
	Id             *big.Int
	Name           string
	Age            uint8
	AnimalType     uint8 // 0=Dog, 1=Cat (enum value as uint8)
	CaretakerName  string
	CaretakerPhone string
}

// MedicalAppointmentCreated is emitted when a new appointment is scheduled.
type MedicalAppointmentCreated struct {
	Id               *big.Int
	PetId            *big.Int
	Date             *big.Int
	Time             string
	AppointmentValue *big.Int
}

// AppointmentPaidToken is emitted when an appointment is paid with an ERC-20 token.
type AppointmentPaidToken struct {
	AppointmentId *big.Int
	Payer         common.Address
	Token         common.Address
	Amount        *big.Int
}

// AppointmentPaidEth is emitted when an appointment is paid with native ETH.
type AppointmentPaidEth struct {
	AppointmentId *big.Int
	Payer         common.Address
	EthAmount     *big.Int
	UsdCents      *big.Int
}

// ---------------------------------------------------------------------------
// ABI definitions — Go constant strings with the canonical event JSON ABI.
// Parsed once at startup via accounts/abi.JSON.
// ---------------------------------------------------------------------------

const medicalRecordCreatedABI = `[{"anonymous":false,"inputs":[{"indexed":true,"name":"id","type":"uint256"},{"indexed":false,"name":"name","type":"string"},{"indexed":false,"name":"age","type":"uint8"},{"indexed":false,"name":"animalType","type":"uint256"},{"indexed":false,"name":"caretakerName","type":"string"},{"indexed":false,"name":"caretakerPhone","type":"string"}],"name":"MedicalRecordCreated","type":"event"}]`

const medicalAppointmentCreatedABI = `[{"anonymous":false,"inputs":[{"indexed":true,"name":"id","type":"uint256"},{"indexed":true,"name":"petId","type":"uint256"},{"indexed":false,"name":"date","type":"uint256"},{"indexed":false,"name":"time","type":"string"},{"indexed":false,"name":"appointmentValue","type":"uint256"}],"name":"MedicalAppointmentCreated","type":"event"}]`

const appointmentPaidTokenABI = `[{"anonymous":false,"inputs":[{"indexed":true,"name":"appointmentId","type":"uint256"},{"indexed":true,"name":"payer","type":"address"},{"indexed":false,"name":"token","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"AppointmentPaidToken","type":"event"}]`

const appointmentPaidEthABI = `[{"anonymous":false,"inputs":[{"indexed":true,"name":"appointmentId","type":"uint256"},{"indexed":true,"name":"payer","type":"address"},{"indexed":false,"name":"ethAmount","type":"uint256"},{"indexed":false,"name":"usdCents","type":"uint256"}],"name":"AppointmentPaidEth","type":"event"}]`

// ---------------------------------------------------------------------------
// Parsed ABIs — package-level vars, populated once on startup.
// ---------------------------------------------------------------------------

var (
	parsedMedicalRecordCreated      abi.ABI
	parsedMedicalAppointmentCreated abi.ABI
	parsedAppointmentPaidToken      abi.ABI
	parsedAppointmentPaidEth        abi.ABI
)

// Event signature hashes (topic[0] values) exported for the indexer to
// dispatch logs to the correct parser.
var (
	MedicalRecordCreatedSig     common.Hash
	MedicalAppointmentCreatedSig common.Hash
	AppointmentPaidTokenSig      common.Hash
	AppointmentPaidEthSig        common.Hash
)

func init() {
	mustParse(&parsedMedicalRecordCreated, medicalRecordCreatedABI)
	mustParse(&parsedMedicalAppointmentCreated, medicalAppointmentCreatedABI)
	mustParse(&parsedAppointmentPaidToken, appointmentPaidTokenABI)
	mustParse(&parsedAppointmentPaidEth, appointmentPaidEthABI)

	MedicalRecordCreatedSig = parsedMedicalRecordCreated.Events["MedicalRecordCreated"].ID
	MedicalAppointmentCreatedSig = parsedMedicalAppointmentCreated.Events["MedicalAppointmentCreated"].ID
	AppointmentPaidTokenSig = parsedAppointmentPaidToken.Events["AppointmentPaidToken"].ID
	AppointmentPaidEthSig = parsedAppointmentPaidEth.Events["AppointmentPaidEth"].ID
}

func mustParse(target *abi.ABI, raw string) {
	var err error
	*target, err = abi.JSON(strings.NewReader(raw))
	if err != nil {
		panic(fmt.Sprintf("ethclient: failed to parse event ABI: %v", err))
	}
}

// ---------------------------------------------------------------------------
// Event parsers — each takes a raw types.Log and returns a typed event struct.
// ---------------------------------------------------------------------------

// ParseMedicalRecordCreated decodes a MedicalRecordCreated event from a log entry.
func ParseMedicalRecordCreated(log types.Log) (MedicalRecordCreated, error) {
	var result MedicalRecordCreated
	event := parsedMedicalRecordCreated.Events["MedicalRecordCreated"]

	if len(log.Topics) < 2 {
		return result, fmt.Errorf("MedicalRecordCreated: need at least 2 topics, got %d", len(log.Topics))
	}
	if log.Topics[0] != event.ID {
		return result, fmt.Errorf("MedicalRecordCreated: event sig mismatch")
	}

	// Indexed: id (uint256, topic[1])
	result.Id = log.Topics[1].Big()

	// Non-indexed: name (string), age (uint8), animalType (uint256),
	//              caretakerName (string), caretakerPhone (string)
	unpacked, err := event.Inputs.NonIndexed().Unpack(log.Data)
	if err != nil {
		return result, fmt.Errorf("MedicalRecordCreated: unpack data: %w", err)
	}
	if len(unpacked) != 5 {
		return result, fmt.Errorf("MedicalRecordCreated: expected 5 data fields, got %d", len(unpacked))
	}

	var ok bool
	if result.Name, ok = unpacked[0].(string); !ok {
		return result, fmt.Errorf("MedicalRecordCreated: field[0] name is not string")
	}
	if result.Age, ok = unpacked[1].(uint8); !ok {
		return result, fmt.Errorf("MedicalRecordCreated: field[1] age is not uint8")
	}
	at, ok := unpacked[2].(*big.Int)
	if !ok {
		return result, fmt.Errorf("MedicalRecordCreated: field[2] animalType is not *big.Int")
	}
	result.AnimalType = uint8(at.Uint64())
	if result.CaretakerName, ok = unpacked[3].(string); !ok {
		return result, fmt.Errorf("MedicalRecordCreated: field[3] caretakerName is not string")
	}
	if result.CaretakerPhone, ok = unpacked[4].(string); !ok {
		return result, fmt.Errorf("MedicalRecordCreated: field[4] caretakerPhone is not string")
	}

	return result, nil
}

// ParseMedicalAppointmentCreated decodes a MedicalAppointmentCreated event from a log entry.
func ParseMedicalAppointmentCreated(log types.Log) (MedicalAppointmentCreated, error) {
	var result MedicalAppointmentCreated
	event := parsedMedicalAppointmentCreated.Events["MedicalAppointmentCreated"]

	if len(log.Topics) < 3 {
		return result, fmt.Errorf("MedicalAppointmentCreated: need at least 3 topics, got %d", len(log.Topics))
	}
	if log.Topics[0] != event.ID {
		return result, fmt.Errorf("MedicalAppointmentCreated: event sig mismatch")
	}

	// Indexed: id (topic[1]), petId (topic[2])
	result.Id = log.Topics[1].Big()
	result.PetId = log.Topics[2].Big()

	// Non-indexed: date (uint256), time (string), appointmentValue (uint256)
	unpacked, err := event.Inputs.NonIndexed().Unpack(log.Data)
	if err != nil {
		return result, fmt.Errorf("MedicalAppointmentCreated: unpack data: %w", err)
	}
	if len(unpacked) != 3 {
		return result, fmt.Errorf("MedicalAppointmentCreated: expected 3 data fields, got %d", len(unpacked))
	}

	var ok bool
	if result.Date, ok = unpacked[0].(*big.Int); !ok {
		return result, fmt.Errorf("MedicalAppointmentCreated: field[0] date is not *big.Int")
	}
	if result.Time, ok = unpacked[1].(string); !ok {
		return result, fmt.Errorf("MedicalAppointmentCreated: field[1] time is not string")
	}
	if result.AppointmentValue, ok = unpacked[2].(*big.Int); !ok {
		return result, fmt.Errorf("MedicalAppointmentCreated: field[2] appointmentValue is not *big.Int")
	}

	return result, nil
}

// ParseAppointmentPaidToken decodes an AppointmentPaidToken event from a log entry.
func ParseAppointmentPaidToken(log types.Log) (AppointmentPaidToken, error) {
	var result AppointmentPaidToken
	event := parsedAppointmentPaidToken.Events["AppointmentPaidToken"]

	if len(log.Topics) < 3 {
		return result, fmt.Errorf("AppointmentPaidToken: need at least 3 topics, got %d", len(log.Topics))
	}
	if log.Topics[0] != event.ID {
		return result, fmt.Errorf("AppointmentPaidToken: event sig mismatch")
	}

	// Indexed: appointmentId (topic[1]), payer (topic[2])
	result.AppointmentId = log.Topics[1].Big()
	result.Payer = common.BytesToAddress(log.Topics[2].Bytes())

	// Non-indexed: token (address), amount (uint256)
	unpacked, err := event.Inputs.NonIndexed().Unpack(log.Data)
	if err != nil {
		return result, fmt.Errorf("AppointmentPaidToken: unpack data: %w", err)
	}
	if len(unpacked) != 2 {
		return result, fmt.Errorf("AppointmentPaidToken: expected 2 data fields, got %d", len(unpacked))
	}

	var ok bool
	if result.Token, ok = unpacked[0].(common.Address); !ok {
		return result, fmt.Errorf("AppointmentPaidToken: field[0] token is not common.Address")
	}
	if result.Amount, ok = unpacked[1].(*big.Int); !ok {
		return result, fmt.Errorf("AppointmentPaidToken: field[1] amount is not *big.Int")
	}

	return result, nil
}

// ParseAppointmentPaidEth decodes an AppointmentPaidEth event from a log entry.
func ParseAppointmentPaidEth(log types.Log) (AppointmentPaidEth, error) {
	var result AppointmentPaidEth
	event := parsedAppointmentPaidEth.Events["AppointmentPaidEth"]

	if len(log.Topics) < 3 {
		return result, fmt.Errorf("AppointmentPaidEth: need at least 3 topics, got %d", len(log.Topics))
	}
	if log.Topics[0] != event.ID {
		return result, fmt.Errorf("AppointmentPaidEth: event sig mismatch")
	}

	// Indexed: appointmentId (topic[1]), payer (topic[2])
	result.AppointmentId = log.Topics[1].Big()
	result.Payer = common.BytesToAddress(log.Topics[2].Bytes())

	// Non-indexed: ethAmount (uint256), usdCents (uint256)
	unpacked, err := event.Inputs.NonIndexed().Unpack(log.Data)
	if err != nil {
		return result, fmt.Errorf("AppointmentPaidEth: unpack data: %w", err)
	}
	if len(unpacked) != 2 {
		return result, fmt.Errorf("AppointmentPaidEth: expected 2 data fields, got %d", len(unpacked))
	}

	var ok bool
	if result.EthAmount, ok = unpacked[0].(*big.Int); !ok {
		return result, fmt.Errorf("AppointmentPaidEth: field[0] ethAmount is not *big.Int")
	}
	if result.UsdCents, ok = unpacked[1].(*big.Int); !ok {
		return result, fmt.Errorf("AppointmentPaidEth: field[1] usdCents is not *big.Int")
	}

	return result, nil
}
