.PHONY: build test migrate docker-build clean

BINARY_NAME=indexer
BUILD_DIR=./bin

build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/indexer

test:
	@echo "Running tests..."
	go test -v -race -count=1 ./...

test-short:
	@echo "Running short tests..."
	go test -v -race -count=1 -short ./...

migrate:
	@echo "Migration command not implemented yet."
	@echo "Usage: make migrate args='up'"
	@echo "  make migrate args='down'"
	@echo "  make migrate args='goto 1'"

docker-build:
	@echo "Docker build not implemented yet."
	@echo "Run: docker build -t vet-57b-indexer ."

clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@echo "Done."
