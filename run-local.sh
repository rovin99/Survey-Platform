#!/bin/bash

# ============================================================================
# Survey Platform - Local Development Startup Script
# ============================================================================
# This script starts all microservices for local development.
#
# Prerequisites:
#   - PostgreSQL running on localhost:5432 (or Docker)
#   - Go 1.21+ installed
#   - .NET 8.0+ installed
#   - Node.js 18+ installed
#
# Usage:
#   ./run-local.sh          # Start all services
#   ./run-local.sh stop     # Stop all services
#   ./run-local.sh status   # Check service status
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# ============================================================================
# CONFIGURATION - Shared across all services
# ============================================================================

# Database Configuration (shared by all services)
export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5433}"
export DB_USER="${DB_USER:-postgres}"
export DB_PASSWORD="${DB_PASSWORD:-postgres123}"
export DB_NAME="${DB_NAME:-SurveyDb}"
export DB_SSLMODE="${DB_SSLMODE:-disable}"

# Connection string for AuthService (.NET)
export CONNECTION_STRING="Host=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD}"

# JWT Configuration (MUST be identical across all services!)
export JWT_KEY="${JWT_KEY:-ThisIsASecretKeyWithAtLeast32CharactersForSecurity123456789}"
export JWT_SECRET_KEY="${JWT_KEY}"  # Go services use this name
export JWT_ISSUER="${JWT_ISSUER:-AuthService}"
export JWT_AUDIENCE="${JWT_AUDIENCE:-SurveyApp}"
export JWT_DURATION="${JWT_DURATION:-60}"

# Email Configuration (Gmail SMTP)
export EMAIL="${EMAIL:-rovin9325@gmail.com}"
export APP_PASS="${APP_PASS:-qrls wiqy wdmb cwjs}"
export SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"
export SMTP_PORT="${SMTP_PORT:-587}"

# Service Ports
AUTH_PORT=5171
SURVEY_PORT=5172
PARTICIPANTS_PORT=5173
FRONTEND_PORT=3000

# CORS Origins (frontend URL)
export CORS_ORIGINS="http://localhost:${FRONTEND_PORT}"

# Development mode
export ASPNETCORE_ENVIRONMENT="Development"
export APP_ENV="development"

# PID file location
PID_DIR="${PROJECT_ROOT}/.pids"
mkdir -p "$PID_DIR"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    log_info "Waiting for $name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            log_success "$name is ready!"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    log_error "$name failed to start after $max_attempts seconds"
    return 1
}

# ============================================================================
# STOP SERVICES
# ============================================================================

stop_services() {
    log_info "Stopping all services..."

    # Kill processes by PID files
    for pid_file in "$PID_DIR"/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            service_name=$(basename "$pid_file" .pid)
            if kill -0 "$pid" 2>/dev/null; then
                log_info "Stopping $service_name (PID: $pid)..."
                kill "$pid" 2>/dev/null || true
            fi
            rm -f "$pid_file"
        fi
    done

    # Also kill by port just in case
    for port in $AUTH_PORT $SURVEY_PORT $PARTICIPANTS_PORT $FRONTEND_PORT; do
        if check_port $port; then
            log_info "Killing process on port $port..."
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
        fi
    done

    log_success "All services stopped"
}

# ============================================================================
# STATUS CHECK
# ============================================================================

check_status() {
    echo ""
    echo "============================================"
    echo "       Survey Platform Service Status       "
    echo "============================================"
    echo ""

    services=(
        "AuthService|$AUTH_PORT|http://localhost:$AUTH_PORT/health/live"
        "SurveyManagementService|$SURVEY_PORT|http://localhost:$SURVEY_PORT/health"
        "ParticipantsManagementService|$PARTICIPANTS_PORT|http://localhost:$PARTICIPANTS_PORT/health"
        "Frontend|$FRONTEND_PORT|http://localhost:$FRONTEND_PORT"
    )

    for service in "${services[@]}"; do
        IFS='|' read -r name port url <<< "$service"
        if check_port $port; then
            if curl -s "$url" > /dev/null 2>&1; then
                echo -e "  ${GREEN}●${NC} $name (port $port) - Running"
            else
                echo -e "  ${YELLOW}●${NC} $name (port $port) - Starting..."
            fi
        else
            echo -e "  ${RED}●${NC} $name (port $port) - Stopped"
        fi
    done

    echo ""
    echo "============================================"
    echo ""
}

# ============================================================================
# START SERVICES
# ============================================================================

start_auth_service() {
    log_info "Starting AuthService on port $AUTH_PORT..."

    cd "$PROJECT_ROOT/AuthService"

    # Create .env file for AuthService
    cat > .env << EOF
CONNECTION_STRING=${CONNECTION_STRING}
JWT_KEY=${JWT_KEY}
JWT_ISSUER=${JWT_ISSUER}
JWT_AUDIENCE=${JWT_AUDIENCE}
JWT_DURATION=${JWT_DURATION}
CORS_ORIGINS=${CORS_ORIGINS}
ASPNETCORE_ENVIRONMENT=Development
EMAIL_SERVICE_BASE_URL=http://localhost:${SURVEY_PORT}
EOF

    # Build and run
    dotnet build -c Debug > /dev/null 2>&1

    ASPNETCORE_URLS="http://localhost:$AUTH_PORT" \
    dotnet run --no-build > "$PROJECT_ROOT/logs/auth-service.log" 2>&1 &

    echo $! > "$PID_DIR/auth-service.pid"
    log_success "AuthService started (PID: $(cat $PID_DIR/auth-service.pid))"
}

start_survey_service() {
    log_info "Starting SurveyManagementService on port $SURVEY_PORT..."

    cd "$PROJECT_ROOT/SurveyManagementService"

    # Create .env file for SurveyManagementService
    cat > .env << EOF
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_SSLMODE=${DB_SSLMODE}
JWT_SECRET_KEY=${JWT_KEY}
JWT_ISSUER=${JWT_ISSUER}
JWT_AUDIENCE=${JWT_AUDIENCE}
PORT=${SURVEY_PORT}
CORS_ORIGINS=${CORS_ORIGINS}
EMAIL=${EMAIL}
APP_PASS=${APP_PASS}
ENVIRONMENT=development
EOF

    # Build and run
    go build -o survey-service . 2>/dev/null

    PORT=$SURVEY_PORT ./survey-service > "$PROJECT_ROOT/logs/survey-service.log" 2>&1 &

    echo $! > "$PID_DIR/survey-service.pid"
    log_success "SurveyManagementService started (PID: $(cat $PID_DIR/survey-service.pid))"
}

start_participants_service() {
    log_info "Starting ParticipantsManagementService on port $PARTICIPANTS_PORT..."

    cd "$PROJECT_ROOT/ParticipantsManagementService"

    # Create .env file for ParticipantsManagementService
    cat > .env << EOF
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_SSLMODE=${DB_SSLMODE}
JWT_SECRET_KEY=${JWT_KEY}
JWT_ISSUER=${JWT_ISSUER}
JWT_AUDIENCE=${JWT_AUDIENCE}
PORT=${PARTICIPANTS_PORT}
APP_ENV=development
CORS_ORIGINS=${CORS_ORIGINS}
SURVEY_SERVICE_URL=http://localhost:${SURVEY_PORT}
EOF

    # Build and run
    go build -o participants-service . 2>/dev/null

    PORT=$PARTICIPANTS_PORT APP_ENV=development ./participants-service > "$PROJECT_ROOT/logs/participants-service.log" 2>&1 &

    echo $! > "$PID_DIR/participants-service.pid"
    log_success "ParticipantsManagementService started (PID: $(cat $PID_DIR/participants-service.pid))"
}

start_frontend() {
    log_info "Starting Frontend on port $FRONTEND_PORT..."

    cd "$PROJECT_ROOT/frontend"

    # Create .env.local for Next.js
    cat > .env.local << EOF
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:${AUTH_PORT}
NEXT_PUBLIC_SURVEY_SERVICE_URL=http://localhost:${SURVEY_PORT}
NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL=http://localhost:${PARTICIPANTS_PORT}
EOF

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install > /dev/null 2>&1
    fi

    # Start the dev server
    npm run dev -- --port $FRONTEND_PORT > "$PROJECT_ROOT/logs/frontend.log" 2>&1 &

    echo $! > "$PID_DIR/frontend.pid"
    log_success "Frontend started (PID: $(cat $PID_DIR/frontend.pid))"
}

start_all() {
    echo ""
    echo "============================================"
    echo "     Starting Survey Platform Locally       "
    echo "============================================"
    echo ""

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Check if any services are already running
    for port in $AUTH_PORT $SURVEY_PORT $PARTICIPANTS_PORT $FRONTEND_PORT; do
        if check_port $port; then
            log_warn "Port $port is already in use. Stopping existing process..."
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
    done

    # Start services in order
    start_auth_service
    sleep 2

    start_survey_service
    sleep 2

    start_participants_service
    sleep 2

    start_frontend
    sleep 3

    # Wait for services to be ready
    echo ""
    wait_for_service "http://localhost:$AUTH_PORT/health/live" "AuthService"
    wait_for_service "http://localhost:$SURVEY_PORT/health" "SurveyManagementService"
    # Participants service might be in dev mode without health endpoint

    echo ""
    echo "============================================"
    echo "       All Services Started!                "
    echo "============================================"
    echo ""
    echo "  Service URLs:"
    echo "    - Frontend:     http://localhost:$FRONTEND_PORT"
    echo "    - AuthService:  http://localhost:$AUTH_PORT"
    echo "    - SurveyService: http://localhost:$SURVEY_PORT"
    echo "    - ParticipantsService: http://localhost:$PARTICIPANTS_PORT"
    echo ""
    echo "  Logs:"
    echo "    - $PROJECT_ROOT/logs/auth-service.log"
    echo "    - $PROJECT_ROOT/logs/survey-service.log"
    echo "    - $PROJECT_ROOT/logs/participants-service.log"
    echo "    - $PROJECT_ROOT/logs/frontend.log"
    echo ""
    echo "  To stop all services: ./run-local.sh stop"
    echo "  To check status: ./run-local.sh status"
    echo ""
    echo "============================================"
    echo ""
}

# ============================================================================
# MAIN
# ============================================================================

case "${1:-start}" in
    start)
        start_all
        ;;
    stop)
        stop_services
        ;;
    status)
        check_status
        ;;
    restart)
        stop_services
        sleep 2
        start_all
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        exit 1
        ;;
esac

