package ethclient

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// ---------------------------------------------------------------------------
// Helpers: construct test logs from typed values.
// ---------------------------------------------------------------------------

func makeMedicalRecordCreatedLog(id *big.Int, owner common.Address, name string, age uint8, animalType *big.Int, caretakerName, caretakerPhone string) types.Log {
	event := parsedMedicalRecordCreated.Events["MedicalRecordCreated"]
	animalTypeU8 := uint8(animalType.Uint64())
	data, err := event.Inputs.NonIndexed().Pack(name, age, animalTypeU8, caretakerName, caretakerPhone)
	if err != nil {
		panic("makeMedicalRecordCreatedLog pack: " + err.Error())
	}
	return types.Log{
		Topics: []common.Hash{event.ID, common.BigToHash(id), common.BytesToHash(owner.Bytes())},
		Data:   data,
	}
}

func makeMedicalAppointmentCreatedLog(id, petId *big.Int, date *big.Int, timeStr string, appointmentValue *big.Int) types.Log {
	event := parsedMedicalAppointmentCreated.Events["MedicalAppointmentCreated"]
	data, err := event.Inputs.NonIndexed().Pack(date, timeStr, appointmentValue)
	if err != nil {
		panic("makeMedicalAppointmentCreatedLog pack: " + err.Error())
	}
	return types.Log{
		Topics: []common.Hash{event.ID, common.BigToHash(id), common.BigToHash(petId)},
		Data:   data,
	}
}

func makeAppointmentPaidTokenLog(appointmentID *big.Int, payer common.Address, token common.Address, amount *big.Int) types.Log {
	event := parsedAppointmentPaidToken.Events["AppointmentPaidToken"]
	data, err := event.Inputs.NonIndexed().Pack(token, amount)
	if err != nil {
		panic("makeAppointmentPaidTokenLog pack: " + err.Error())
	}
	return types.Log{
		Topics: []common.Hash{event.ID, common.BigToHash(appointmentID), common.BytesToHash(payer.Bytes())},
		Data:   data,
	}
}

func makeAppointmentPaidEthLog(appointmentID *big.Int, payer common.Address, ethAmount, usdCents *big.Int) types.Log {
	event := parsedAppointmentPaidEth.Events["AppointmentPaidEth"]
	data, err := event.Inputs.NonIndexed().Pack(ethAmount, usdCents)
	if err != nil {
		panic("makeAppointmentPaidEthLog pack: " + err.Error())
	}
	return types.Log{
		Topics: []common.Hash{event.ID, common.BigToHash(appointmentID), common.BytesToHash(payer.Bytes())},
		Data:   data,
	}
}

// ---------------------------------------------------------------------------
// MedicalRecordCreated tests
// ---------------------------------------------------------------------------

func TestParseMedicalRecordCreated(t *testing.T) {
	ownerAddr := common.HexToAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")

	tests := []struct {
		name           string
		id             *big.Int
		petName        string
		age            uint8
		animalType     *big.Int
		caretakerName  string
		caretakerPhone string
	}{
		{
			name:           "normal dog record",
			id:             big.NewInt(1),
			petName:        "Buddy",
			age:            3,
			animalType:     big.NewInt(0), // Dog
			caretakerName:  "Alice Johnson",
			caretakerPhone: "+1234567890",
		},
		{
			name:           "normal cat record",
			id:             big.NewInt(42),
			petName:        "Whiskers",
			age:            7,
			animalType:     big.NewInt(1), // Cat
			caretakerName:  "Bob Smith",
			caretakerPhone: "+0987654321",
		},
		{
			name:           "max id value",
			id:             new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)), // 2^256 - 1
			petName:        "MaxId",
			age:            255,
			animalType:     big.NewInt(0),
			caretakerName:  "Tester",
			caretakerPhone: "0000000000",
		},
		{
			name:           "empty strings",
			id:             big.NewInt(99),
			petName:        "",
			age:            0,
			animalType:     big.NewInt(1),
			caretakerName:  "",
			caretakerPhone: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			log := makeMedicalRecordCreatedLog(tt.id, ownerAddr, tt.petName, tt.age, tt.animalType, tt.caretakerName, tt.caretakerPhone)

			got, err := ParseMedicalRecordCreated(log)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if got.Id.Cmp(tt.id) != 0 {
				t.Errorf("Id: got %v, want %v", got.Id, tt.id)
			}
			if got.Owner != ownerAddr {
				t.Errorf("Owner: got %v, want %v", got.Owner, ownerAddr)
			}
			if got.Name != tt.petName {
				t.Errorf("Name: got %q, want %q", got.Name, tt.petName)
			}
			if got.Age != tt.age {
				t.Errorf("Age: got %d, want %d", got.Age, tt.age)
			}
			if got.AnimalType != uint8(tt.animalType.Uint64()) {
				t.Errorf("AnimalType: got %d, want %d", got.AnimalType, tt.animalType.Uint64())
			}
			if got.CaretakerName != tt.caretakerName {
				t.Errorf("CaretakerName: got %q, want %q", got.CaretakerName, tt.caretakerName)
			}
			if got.CaretakerPhone != tt.caretakerPhone {
				t.Errorf("CaretakerPhone: got %q, want %q", got.CaretakerPhone, tt.caretakerPhone)
			}
		})
	}
}

func TestParseMedicalRecordCreated_WrongSig(t *testing.T) {
	log := types.Log{
		Topics: []common.Hash{{0x01}, {}},
		Data:   nil,
	}
	_, err := ParseMedicalRecordCreated(log)
	if err == nil {
		t.Fatal("expected error for wrong event signature")
	}
}

func TestParseMedicalRecordCreated_TooFewTopics(t *testing.T) {
	log := types.Log{
		Topics: []common.Hash{parsedMedicalRecordCreated.Events["MedicalRecordCreated"].ID},
		Data:   nil,
	}
	_, err := ParseMedicalRecordCreated(log)
	if err == nil {
		t.Fatal("expected error for too few topics")
	}
}

// ---------------------------------------------------------------------------
// MedicalAppointmentCreated tests
// ---------------------------------------------------------------------------

func TestParseMedicalAppointmentCreated(t *testing.T) {
	tests := []struct {
		name             string
		id               *big.Int
		petId            *big.Int
		date             *big.Int
		timeStr          string
		appointmentValue *big.Int
	}{
		{
			name:             "normal appointment",
			id:               big.NewInt(1),
			petId:            big.NewInt(42),
			date:             big.NewInt(1700000000),
			timeStr:          "14:30",
			appointmentValue: big.NewInt(100000),
		},
		{
			name:             "max values",
			id:               big.NewInt(0).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)),
			petId:            big.NewInt(0).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)),
			date:             big.NewInt(0).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)),
			timeStr:          "",
			appointmentValue: big.NewInt(0).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)),
		},
		{
			name:             "zero values",
			id:               big.NewInt(0),
			petId:            big.NewInt(0),
			date:             big.NewInt(0),
			timeStr:          "",
			appointmentValue: big.NewInt(0),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			log := makeMedicalAppointmentCreatedLog(tt.id, tt.petId, tt.date, tt.timeStr, tt.appointmentValue)

			got, err := ParseMedicalAppointmentCreated(log)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if got.Id.Cmp(tt.id) != 0 {
				t.Errorf("Id: got %v, want %v", got.Id, tt.id)
			}
			if got.PetId.Cmp(tt.petId) != 0 {
				t.Errorf("PetId: got %v, want %v", got.PetId, tt.petId)
			}
			if got.Date.Cmp(tt.date) != 0 {
				t.Errorf("Date: got %v, want %v", got.Date, tt.date)
			}
			if got.Time != tt.timeStr {
				t.Errorf("Time: got %q, want %q", got.Time, tt.timeStr)
			}
			if got.AppointmentValue.Cmp(tt.appointmentValue) != 0 {
				t.Errorf("AppointmentValue: got %v, want %v", got.AppointmentValue, tt.appointmentValue)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// AppointmentPaidToken tests
// ---------------------------------------------------------------------------

func TestParseAppointmentPaidToken(t *testing.T) {
	alice := common.HexToAddress("0x1111111111111111111111111111111111111111")
	usdc := common.HexToAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")

	tests := []struct {
		name          string
		appointmentID *big.Int
		payer         common.Address
		token         common.Address
		amount        *big.Int
	}{
		{
			name:          "normal token payment",
			appointmentID: big.NewInt(1),
			payer:         alice,
			token:         usdc,
			amount:        big.NewInt(5000000),
		},
		{
			name:          "zero address payer and token",
			appointmentID: big.NewInt(2),
			payer:         common.Address{},
			token:         common.Address{},
			amount:        big.NewInt(0),
		},
		{
			name:          "max uint256 amount",
			appointmentID: big.NewInt(3),
			payer:         alice,
			token:         usdc,
			amount:        new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			log := makeAppointmentPaidTokenLog(tt.appointmentID, tt.payer, tt.token, tt.amount)

			got, err := ParseAppointmentPaidToken(log)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if got.AppointmentId.Cmp(tt.appointmentID) != 0 {
				t.Errorf("AppointmentId: got %v, want %v", got.AppointmentId, tt.appointmentID)
			}
			if got.Payer != tt.payer {
				t.Errorf("Payer: got %s, want %s", got.Payer.Hex(), tt.payer.Hex())
			}
			if got.Token != tt.token {
				t.Errorf("Token: got %s, want %s", got.Token.Hex(), tt.token.Hex())
			}
			if got.Amount.Cmp(tt.amount) != 0 {
				t.Errorf("Amount: got %v, want %v", got.Amount, tt.amount)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// AppointmentPaidEth tests
// ---------------------------------------------------------------------------

func TestParseAppointmentPaidEth(t *testing.T) {
	bob := common.HexToAddress("0x2222222222222222222222222222222222222222")

	tests := []struct {
		name          string
		appointmentID *big.Int
		payer         common.Address
		ethAmount     *big.Int
		usdCents      *big.Int
	}{
		{
			name:          "normal eth payment",
			appointmentID: big.NewInt(1),
			payer:         bob,
			ethAmount:     big.NewInt(1000000000000000000), // 1 ETH in wei
			usdCents:      big.NewInt(350000),              // $3500.00
		},
		{
			name:          "zero amounts",
			appointmentID: big.NewInt(0),
			payer:         common.Address{},
			ethAmount:     big.NewInt(0),
			usdCents:      big.NewInt(0),
		},
		{
			name:          "max uint256 amounts",
			appointmentID: big.NewInt(99),
			payer:         bob,
			ethAmount:     new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)),
			usdCents:      new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			log := makeAppointmentPaidEthLog(tt.appointmentID, tt.payer, tt.ethAmount, tt.usdCents)

			got, err := ParseAppointmentPaidEth(log)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if got.AppointmentId.Cmp(tt.appointmentID) != 0 {
				t.Errorf("AppointmentId: got %v, want %v", got.AppointmentId, tt.appointmentID)
			}
			if got.Payer != tt.payer {
				t.Errorf("Payer: got %s, want %s", got.Payer.Hex(), tt.payer.Hex())
			}
			if got.EthAmount.Cmp(tt.ethAmount) != 0 {
				t.Errorf("EthAmount: got %v, want %v", got.EthAmount, tt.ethAmount)
			}
			if got.UsdCents.Cmp(tt.usdCents) != 0 {
				t.Errorf("UsdCents: got %v, want %v", got.UsdCents, tt.usdCents)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Wrong-sig and edge cases shared across events
// ---------------------------------------------------------------------------

func TestParseAppointmentPaidToken_WrongSig(t *testing.T) {
	log := types.Log{
		Topics: []common.Hash{{0x02}, {}, {}},
		Data:   nil,
	}
	_, err := ParseAppointmentPaidToken(log)
	if err == nil {
		t.Fatal("expected error for wrong event signature")
	}
}

func TestParseAppointmentPaidEth_WrongSig(t *testing.T) {
	log := types.Log{
		Topics: []common.Hash{{0x03}, {}, {}},
		Data:   nil,
	}
	_, err := ParseAppointmentPaidEth(log)
	if err == nil {
		t.Fatal("expected error for wrong event signature")
	}
}
