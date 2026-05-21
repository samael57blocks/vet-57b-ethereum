package indexer

import (
	"context"
	"fmt"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"vet-57b/backend/internal/config"
	"vet-57b/backend/internal/ethclient"
	"vet-57b/backend/internal/models"
	"vet-57b/backend/internal/store"
)

// ---------------------------------------------------------------------------
// Mock implementations
// ---------------------------------------------------------------------------

// mockStore implements store.Store with call-recording function fields.
type mockStore struct {
	store.Store // embed so we only need to implement methods used in tests

	upsertPetCalls    []*models.Pet
	upsertApptCalls   []*models.Appointment
	updatePaidCalls   []paidCall
	deleteAfterCalls  []uint64
	checkpointCalls   int

	upsertPetFn    func(ctx context.Context, pet *models.Pet) error
	upsertApptFn   func(ctx context.Context, appt *models.Appointment) error
	updatePaidFn   func(ctx context.Context, id uint64, amount string) error
	deleteAfterFn  func(ctx context.Context, block uint64) (int64, error)
	getCheckpointFn func(ctx context.Context) (*models.Checkpoint, error)
	upsertCheckpointFn func(ctx context.Context, cp *models.Checkpoint) error
}

type paidCall struct {
	appointmentID uint64
	amount        string
}

func (m *mockStore) UpsertPet(ctx context.Context, pet *models.Pet) error {
	m.upsertPetCalls = append(m.upsertPetCalls, pet)
	if m.upsertPetFn != nil {
		return m.upsertPetFn(ctx, pet)
	}
	return nil
}

func (m *mockStore) UpsertAppointment(ctx context.Context, appt *models.Appointment) error {
	m.upsertApptCalls = append(m.upsertApptCalls, appt)
	if m.upsertApptFn != nil {
		return m.upsertApptFn(ctx, appt)
	}
	return nil
}

func (m *mockStore) UpdateAppointmentPaidValue(ctx context.Context, id uint64, amount string) error {
	m.updatePaidCalls = append(m.updatePaidCalls, paidCall{id, amount})
	if m.updatePaidFn != nil {
		return m.updatePaidFn(ctx, id, amount)
	}
	return nil
}

func (m *mockStore) DeleteEventsAfterBlock(ctx context.Context, block uint64) (int64, error) {
	m.deleteAfterCalls = append(m.deleteAfterCalls, block)
	if m.deleteAfterFn != nil {
		return m.deleteAfterFn(ctx, block)
	}
	return 3, nil // return > 0 to indicate rows deleted
}

func (m *mockStore) GetCheckpoint(ctx context.Context) (*models.Checkpoint, error) {
	m.checkpointCalls++
	if m.getCheckpointFn != nil {
		return m.getCheckpointFn(ctx)
	}
	return nil, nil
}

func (m *mockStore) UpsertCheckpoint(ctx context.Context, cp *models.Checkpoint) error {
	if m.upsertCheckpointFn != nil {
		return m.upsertCheckpointFn(ctx, cp)
	}
	return nil
}

// mockClient implements ethclient.Client for testing.
type mockClient struct {
	blockNumberFn   func(ctx context.Context) (uint64, error)
	blockByNumberFn func(ctx context.Context, number *big.Int) (*types.Block, error)
	filterLogsFn    func(ctx context.Context, address common.Address, fromBlock, toBlock uint64) ([]types.Log, error)
}

func (m *mockClient) SubscribeLogs(ctx context.Context, address common.Address) (<-chan types.Log, error) {
	ch := make(chan types.Log)
	close(ch) // immediately closed — no logs
	return ch, nil
}

func (m *mockClient) FilterLogs(ctx context.Context, address common.Address, fromBlock, toBlock uint64) ([]types.Log, error) {
	if m.filterLogsFn != nil {
		return m.filterLogsFn(ctx, address, fromBlock, toBlock)
	}
	return nil, nil
}

func (m *mockClient) BlockNumber(ctx context.Context) (uint64, error) {
	if m.blockNumberFn != nil {
		return m.blockNumberFn(ctx)
	}
	return 0, nil
}

func (m *mockClient) BlockByNumber(ctx context.Context, number *big.Int) (*types.Block, error) {
	if m.blockByNumberFn != nil {
		return m.blockByNumberFn(ctx, number)
	}
	return makeBlock(number.Uint64(), common.Hash{}), nil
}

func (m *mockClient) Close() {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// makeBlock creates a block with a deterministic hash based on header fields.
func makeBlock(number uint64, parentHash common.Hash) *types.Block {
	header := &types.Header{
		ParentHash: parentHash,
		Number:     new(big.Int).SetUint64(number),
		Time:       uint64(number),
		Extra:      []byte(fmt.Sprintf("b%d", number)),
	}
	return types.NewBlockWithHeader(header)
}

// mustABIType is a test helper that creates an abi.Type or panics.
func mustABIType(t string) abi.Type {
	typ, err := abi.NewType(t, "", nil)
	if err != nil {
		panic(err)
	}
	return typ
}

// makeMedicalRecordCreatedLog creates a test log for MedicalRecordCreated.
func makeMedicalRecordCreatedLog(id *big.Int, name string, age uint8, animalType *big.Int, caretakerName, caretakerPhone string) types.Log {
	args := abi.Arguments{
		{Type: mustABIType("string"), Name: "name"},
		{Type: mustABIType("uint8"), Name: "age"},
		{Type: mustABIType("uint256"), Name: "animalType"},
		{Type: mustABIType("string"), Name: "caretakerName"},
		{Type: mustABIType("string"), Name: "caretakerPhone"},
	}
	data, err := args.Pack(name, age, animalType, caretakerName, caretakerPhone)
	if err != nil {
		panic("makeMedicalRecordCreatedLog pack: " + err.Error())
	}
	return types.Log{
		Topics:      []common.Hash{ethclient.MedicalRecordCreatedSig, common.BigToHash(id)},
		Data:        data,
		BlockNumber: 100,
		TxHash:      common.HexToHash("0xabc"),
		Index:       0,
	}
}

// makeMedicalAppointmentCreatedLog creates a test log for MedicalAppointmentCreated.
func makeMedicalAppointmentCreatedLog(id, petID *big.Int, date *big.Int, timeStr string, appointmentValue *big.Int) types.Log {
	args := abi.Arguments{
		{Type: mustABIType("uint256"), Name: "date"},
		{Type: mustABIType("string"), Name: "time"},
		{Type: mustABIType("uint256"), Name: "appointmentValue"},
	}
	data, err := args.Pack(date, timeStr, appointmentValue)
	if err != nil {
		panic("makeMedicalAppointmentCreatedLog pack: " + err.Error())
	}
	return types.Log{
		Topics:      []common.Hash{ethclient.MedicalAppointmentCreatedSig, common.BigToHash(id), common.BigToHash(petID)},
		Data:        data,
		BlockNumber: 101,
		TxHash:      common.HexToHash("0xdef"),
		Index:       0,
	}
}

// makeAppointmentPaidTokenLog creates a test log for AppointmentPaidToken.
func makeAppointmentPaidTokenLog(appointmentID *big.Int, payer, token common.Address, amount *big.Int) types.Log {
	args := abi.Arguments{
		{Type: mustABIType("address"), Name: "token"},
		{Type: mustABIType("uint256"), Name: "amount"},
	}
	data, err := args.Pack(token, amount)
	if err != nil {
		panic("makeAppointmentPaidTokenLog pack: " + err.Error())
	}
	return types.Log{
		Topics: []common.Hash{
			ethclient.AppointmentPaidTokenSig,
			common.BigToHash(appointmentID),
			common.BytesToHash(payer.Bytes()),
		},
		Data:        data,
		BlockNumber: 102,
		TxHash:      common.HexToHash("0xf00"),
		Index:       0,
	}
}

// makeAppointmentPaidEthLog creates a test log for AppointmentPaidEth.
func makeAppointmentPaidEthLog(appointmentID *big.Int, payer common.Address, ethAmount, usdCents *big.Int) types.Log {
	args := abi.Arguments{
		{Type: mustABIType("uint256"), Name: "ethAmount"},
		{Type: mustABIType("uint256"), Name: "usdCents"},
	}
	data, err := args.Pack(ethAmount, usdCents)
	if err != nil {
		panic("makeAppointmentPaidEthLog pack: " + err.Error())
	}
	return types.Log{
		Topics: []common.Hash{
			ethclient.AppointmentPaidEthSig,
			common.BigToHash(appointmentID),
			common.BytesToHash(payer.Bytes()),
		},
		Data:        data,
		BlockNumber: 103,
		TxHash:      common.HexToHash("0xb00"),
		Index:       0,
	}
}

// ---------------------------------------------------------------------------
// Tests: decodeAndUpsert — event dispatch
// ---------------------------------------------------------------------------

func TestDecodeAndUpsert_MedicalRecordCreated(t *testing.T) {
	ms := &mockStore{}
	idx := &Indexer{
		cfg:    &config.Config{Confirmations: 0},
		store:  ms,
		client: &mockClient{},
	}

	log := makeMedicalRecordCreatedLog(
		big.NewInt(1),
		"Buddy",
		3,
		big.NewInt(0), // Dog
		"Alice",
		"+1234567890",
	)

	idx.decodeAndUpsert(context.Background(), log)

	if len(ms.upsertPetCalls) != 1 {
		t.Fatalf("expected 1 UpsertPet call, got %d", len(ms.upsertPetCalls))
	}
	pet := ms.upsertPetCalls[0]
	if pet.ID != 1 {
		t.Errorf("pet.ID = %d, want 1", pet.ID)
	}
	if pet.Name != "Buddy" {
		t.Errorf("pet.Name = %q, want %q", pet.Name, "Buddy")
	}
	if pet.Age != 3 {
		t.Errorf("pet.Age = %d, want 3", pet.Age)
	}
	if pet.AnimalType != "Dog" {
		t.Errorf("pet.AnimalType = %q, want %q", pet.AnimalType, "Dog")
	}
	if pet.CaretakerName != "Alice" {
		t.Errorf("pet.CaretakerName = %q, want %q", pet.CaretakerName, "Alice")
	}
	if pet.CaretakerPhone != "+1234567890" {
		t.Errorf("pet.CaretakerPhone = %q, want %q", pet.CaretakerPhone, "+1234567890")
	}
	if pet.BlockNumber != 100 {
		t.Errorf("pet.BlockNumber = %d, want 100", pet.BlockNumber)
	}
}

func TestDecodeAndUpsert_MedicalRecordCreated_Cat(t *testing.T) {
	ms := &mockStore{}
	idx := &Indexer{
		cfg:    &config.Config{Confirmations: 0},
		store:  ms,
		client: &mockClient{},
	}

	log := makeMedicalRecordCreatedLog(
		big.NewInt(2),
		"Whiskers",
		7,
		big.NewInt(1), // Cat
		"Bob",
		"+0987654321",
	)

	idx.decodeAndUpsert(context.Background(), log)

	if len(ms.upsertPetCalls) != 1 {
		t.Fatalf("expected 1 UpsertPet call, got %d", len(ms.upsertPetCalls))
	}
	if ms.upsertPetCalls[0].AnimalType != "Cat" {
		t.Errorf("AnimalType = %q, want %q", ms.upsertPetCalls[0].AnimalType, "Cat")
	}
}

func TestDecodeAndUpsert_MedicalAppointmentCreated(t *testing.T) {
	ms := &mockStore{}
	idx := &Indexer{
		cfg:    &config.Config{Confirmations: 0},
		store:  ms,
		client: &mockClient{},
	}

	log := makeMedicalAppointmentCreatedLog(
		big.NewInt(10),
		big.NewInt(1),
		big.NewInt(1700000000),
		"14:30",
		big.NewInt(50000),
	)

	idx.decodeAndUpsert(context.Background(), log)

	if len(ms.upsertApptCalls) != 1 {
		t.Fatalf("expected 1 UpsertAppointment call, got %d", len(ms.upsertApptCalls))
	}
	appt := ms.upsertApptCalls[0]
	if appt.ID != 10 {
		t.Errorf("appt.ID = %d, want 10", appt.ID)
	}
	if appt.PetID != 1 {
		t.Errorf("appt.PetID = %d, want 1", appt.PetID)
	}
	if appt.Date != 1700000000 {
		t.Errorf("appt.Date = %d, want 1700000000", appt.Date)
	}
	if appt.TimeStr != "14:30" {
		t.Errorf("appt.TimeStr = %q, want %q", appt.TimeStr, "14:30")
	}
	if appt.AppointmentValue != "50000" {
		t.Errorf("appt.AppointmentValue = %q, want %q", appt.AppointmentValue, "50000")
	}
	if appt.PaidValue != "0" {
		t.Errorf("appt.PaidValue = %q, want %q", appt.PaidValue, "0")
	}
	if appt.BlockNumber != 101 {
		t.Errorf("appt.BlockNumber = %d, want 101", appt.BlockNumber)
	}
}

func TestDecodeAndUpsert_AppointmentPaidToken(t *testing.T) {
	ms := &mockStore{}
	idx := &Indexer{
		cfg:    &config.Config{Confirmations: 0},
		store:  ms,
		client: &mockClient{},
	}

	usdc := common.HexToAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
	log := makeAppointmentPaidTokenLog(
		big.NewInt(10),
		common.HexToAddress("0x1111111111111111111111111111111111111111"),
		usdc,
		big.NewInt(1000000),
	)

	idx.decodeAndUpsert(context.Background(), log)

	if len(ms.updatePaidCalls) != 1 {
		t.Fatalf("expected 1 UpdateAppointmentPaidValue call, got %d", len(ms.updatePaidCalls))
	}
	if ms.updatePaidCalls[0].appointmentID != 10 {
		t.Errorf("appointmentID = %d, want 10", ms.updatePaidCalls[0].appointmentID)
	}
	if ms.updatePaidCalls[0].amount != "1000000" {
		t.Errorf("amount = %q, want %q", ms.updatePaidCalls[0].amount, "1000000")
	}
}

func TestDecodeAndUpsert_AppointmentPaidEth(t *testing.T) {
	ms := &mockStore{}
	idx := &Indexer{
		cfg:    &config.Config{Confirmations: 0},
		store:  ms,
		client: &mockClient{},
	}

	log := makeAppointmentPaidEthLog(
		big.NewInt(10),
		common.HexToAddress("0x2222222222222222222222222222222222222222"),
		big.NewInt(1000000000000000000), // 1 ETH
		big.NewInt(350000),              // $3500.00
	)

	idx.decodeAndUpsert(context.Background(), log)

	if len(ms.updatePaidCalls) != 1 {
		t.Fatalf("expected 1 UpdateAppointmentPaidValue call, got %d", len(ms.updatePaidCalls))
	}
	if ms.updatePaidCalls[0].appointmentID != 10 {
		t.Errorf("appointmentID = %d, want 10", ms.updatePaidCalls[0].appointmentID)
	}
	if ms.updatePaidCalls[0].amount != "1000000000000000000" {
		t.Errorf("amount = %q, want %q", ms.updatePaidCalls[0].amount, "1000000000000000000")
	}
}

func TestDecodeAndUpsert_UnknownSig(t *testing.T) {
	ms := &mockStore{}
	idx := &Indexer{
		cfg:    &config.Config{Confirmations: 0},
		store:  ms,
		client: &mockClient{},
	}

	// Log with unknown topic[0]
	log := types.Log{
		Topics: []common.Hash{
			common.HexToHash("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"),
			{},
		},
		Data:        nil,
		BlockNumber: 100,
		TxHash:      common.HexToHash("0xaaa"),
	}

	idx.decodeAndUpsert(context.Background(), log)

	if len(ms.upsertPetCalls) != 0 {
		t.Errorf("expected 0 UpsertPet calls for unknown sig, got %d", len(ms.upsertPetCalls))
	}
	if len(ms.upsertApptCalls) != 0 {
		t.Errorf("expected 0 UpsertAppointment calls for unknown sig, got %d", len(ms.upsertApptCalls))
	}
	if len(ms.updatePaidCalls) != 0 {
		t.Errorf("expected 0 UpdateAppointmentPaidValue calls for unknown sig, got %d", len(ms.updatePaidCalls))
	}
}

// ---------------------------------------------------------------------------
// Tests: isConfirmed
// ---------------------------------------------------------------------------

func TestIsConfirmed(t *testing.T) {
	tests := []struct {
		name          string
		currentBlock  uint64
		confirmations uint64
		logBlock      uint64
		want          bool
	}{
		{name: "exactly confirmed", currentBlock: 112, confirmations: 12, logBlock: 100, want: true},
		{name: "over confirmed", currentBlock: 120, confirmations: 12, logBlock: 100, want: true},
		{name: "not yet confirmed", currentBlock: 111, confirmations: 12, logBlock: 100, want: false},
		{name: "current too small", currentBlock: 5, confirmations: 12, logBlock: 0, want: false},
		{name: "zero confirmations", currentBlock: 100, confirmations: 0, logBlock: 100, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			idx := &Indexer{
				cfg:          &config.Config{Confirmations: tt.confirmations},
				client:       &mockClient{},
				store:        &mockStore{},
				currentBlock: tt.currentBlock,
			}
			got := idx.isConfirmed(tt.logBlock)
			if got != tt.want {
				t.Errorf("isConfirmed(%d) with current=%d, confirmations=%d = %v, want %v",
					tt.logBlock, tt.currentBlock, tt.confirmations, got, tt.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: detectReorg
// ---------------------------------------------------------------------------

func TestDetectReorg_NoReorg(t *testing.T) {
	ms := &mockStore{}
	mc := &mockClient{}

	// Pre-populate blockHashes with a specific hash for block 100
	block100 := makeBlock(100, common.HexToHash("0xaaaa"))
	idx := &Indexer{
		cfg:         &config.Config{Confirmations: 12},
		store:       ms,
		client:      mc,
		blockHashes: map[uint64]common.Hash{100: block100.Hash()},
	}

	// Mock client returns the same block (same hash)
	mc.blockByNumberFn = func(ctx context.Context, num *big.Int) (*types.Block, error) {
		if num.Uint64() == 100 {
			return block100, nil
		}
		return makeBlock(num.Uint64(), common.Hash{}), nil
	}

	idx.detectReorg(context.Background(), &models.Checkpoint{LastFinalizedBlock: 100})

	if len(ms.deleteAfterCalls) != 0 {
		t.Errorf("expected 0 DeleteEventsAfterBlock calls on no reorg, got %d", len(ms.deleteAfterCalls))
	}
}

func TestDetectReorg_ReorgDetected(t *testing.T) {
	ms := &mockStore{}
	mc := &mockClient{}

	// Seed blockHashes with a specific hash for block 100
	originalBlock100 := makeBlock(100, common.HexToHash("0xaaaa"))
	idx := &Indexer{
		cfg:         &config.Config{Confirmations: 12},
		store:       ms,
		client:      mc,
		blockHashes: map[uint64]common.Hash{
			100: originalBlock100.Hash(),
			99:  makeBlock(99, common.HexToHash("0x9999")).Hash(),
		},
		currentBlock: 50, // keeps confirmedTo low so backfill is skipped
	}

	// Mock client returns a DIFFERENT block at height 100 (simulating reorg)
	reorgedBlock100 := makeBlock(100, common.HexToHash("0xbbbb"))
	mc.blockByNumberFn = func(ctx context.Context, num *big.Int) (*types.Block, error) {
		switch num.Uint64() {
		case 100:
			return reorgedBlock100, nil // different hash → reorg
		case 99:
			return makeBlock(99, common.HexToHash("0x9999")), nil // same hash → fork point
		default:
			return makeBlock(num.Uint64(), common.Hash{}), nil
		}
	}

	idx.detectReorg(context.Background(), &models.Checkpoint{LastFinalizedBlock: 100})

	// Should have called DeleteEventsAfterBlock to remove events after fork point
	if len(ms.deleteAfterCalls) == 0 {
		t.Fatal("expected DeleteEventsAfterBlock to be called on reorg")
	}
	// forkBlock was found at 100 (block 99 matched), so delete after 99
	if ms.deleteAfterCalls[0] != 99 {
		t.Errorf("DeleteEventsAfterBlock called with block %d, want 99", ms.deleteAfterCalls[0])
	}
}
