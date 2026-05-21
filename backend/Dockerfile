# Stage 1: Build the Go binary
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Cache dependencies first for faster rebuilds
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build a statically-linked binary
COPY . .
RUN CGO_ENABLED=0 go build -o /app/bin/indexer ./cmd/indexer

# Stage 2: Minimal runtime image
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/bin/indexer .
COPY --from=builder /app/migrations ./migrations

EXPOSE ${PORT:-8080}

ENTRYPOINT ["./indexer"]
