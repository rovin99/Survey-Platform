# ====================================
# BUILD STAGE
# ====================================
FROM golang:1.22.1-alpine AS builder

# Install necessary packages for building
RUN apk add --no-cache git ca-certificates tzdata

# Set build environment variables
ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64

# Create application directory
WORKDIR /build

# Copy go mod files first for better caching
COPY go.mod go.sum ./

# Download dependencies (cached layer if go.mod/go.sum unchanged)
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Build the application with optimizations
RUN go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o survey-service \
    ./main.go

# ====================================
# RUNTIME STAGE
# ====================================
FROM alpine:3.19 AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    && update-ca-certificates

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R appuser:appgroup /app

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /build/survey-service .

# Copy timezone data
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Make binary executable and change ownership
RUN chmod +x survey-service && \
    chown appuser:appgroup survey-service

# Switch to non-root user
USER appuser

# Set environment variables
ENV GIN_MODE=release \
    PORT=3001 \
    TZ=UTC

# Expose port
EXPOSE 3001

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Define entrypoint and command
ENTRYPOINT ["./survey-service"]

# ====================================
# KNATIVE OPTIMIZED STAGE (Optional)
# ====================================
FROM runtime AS knative

# Switch back to root to modify settings
USER root

# Install additional dependencies for Knative if needed
RUN apk add --no-cache dumb-init

# Switch back to app user
USER appuser

# Override default port for Knative
ENV PORT=8080

# Expose Knative standard port
EXPOSE 8080

# Use dumb-init for proper signal handling in serverless
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./survey-service"]
