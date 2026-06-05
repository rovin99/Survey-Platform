# ParticipantsManagementService Dockerfile
FROM golang:1.25-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy all source code first (includes local packages)
COPY . .

# Download dependencies and build
RUN go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Runtime image
FROM alpine:latest
WORKDIR /app

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Copy binary from builder
COPY --from=builder /app/main .

# Expose port
EXPOSE 8081

# Run the application
CMD ["./main"]

