#!/bin/bash
# Development Environment Setup Script
set -e

echo "🔧 Setting up Survey Platform development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check Docker
if command_exists docker; then
    echo -e "${GREEN}✅ Docker is installed${NC}"
else
    echo -e "${RED}❌ Docker is required but not installed${NC}"
    exit 1
fi

# Check Docker Compose
if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker Compose is available${NC}"
else
    echo -e "${RED}❌ Docker Compose is required but not available${NC}"
    exit 1
fi

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js is installed (${NODE_VERSION})${NC}"
else
    echo -e "${RED}❌ Node.js is required but not installed${NC}"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm is installed (${NPM_VERSION})${NC}"
else
    echo -e "${RED}❌ npm is required but not installed${NC}"
    exit 1
fi

# Check .NET
if command_exists dotnet; then
    DOTNET_VERSION=$(dotnet --version)
    echo -e "${GREEN}✅ .NET is installed (${DOTNET_VERSION})${NC}"
else
    echo -e "${RED}❌ .NET 8.0 is required but not installed${NC}"
    exit 1
fi

# Check Go
if command_exists go; then
    GO_VERSION=$(go version | cut -d ' ' -f 3)
    echo -e "${GREEN}✅ Go is installed (${GO_VERSION})${NC}"
else
    echo -e "${RED}❌ Go is required but not installed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🚀 Starting development setup...${NC}"

# Start database
echo -e "${YELLOW}📦 Starting PostgreSQL database...${NC}"
cd AuthService
docker-compose up -d postgres
echo -e "${GREEN}✅ Database is running${NC}"

# Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
sleep 10

# Setup AuthService
echo -e "${YELLOW}🔧 Setting up AuthService (.NET)...${NC}"
dotnet restore
dotnet ef database update
echo -e "${GREEN}✅ AuthService setup completed${NC}"

cd ..

# Setup SurveyManagementService
echo -e "${YELLOW}🔧 Setting up SurveyManagementService (Go)...${NC}"
cd SurveyManagementService
go mod download
go mod tidy
echo -e "${GREEN}✅ SurveyManagementService setup completed${NC}"

cd ..

# Setup ParticipantsManagementService
echo -e "${YELLOW}🔧 Setting up ParticipantsManagementService (Go)...${NC}"
cd ParticipantsManagementService
go mod download
go mod tidy
echo -e "${GREEN}✅ ParticipantsManagementService setup completed${NC}"

cd ..

# Setup Frontend
echo -e "${YELLOW}🔧 Setting up Frontend (Next.js)...${NC}"
cd frontend
npm ci
echo -e "${GREEN}✅ Frontend setup completed${NC}"

cd ..

# Create environment file templates if they don't exist
echo -e "${YELLOW}📄 Creating environment file templates...${NC}"

if [ ! -f AuthService/.env ]; then
    cp AuthService/.env.example AuthService/.env || true
    echo -e "${YELLOW}ℹ️  Created AuthService/.env from template${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Development environment setup completed!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Review and update .env files with your configuration"
echo "2. Run 'scripts/start-dev.sh' to start all services"
echo "3. Visit http://localhost:3000 for the frontend"
echo "4. API endpoints will be available at:"
echo "   - AuthService: http://localhost:5000"
echo "   - SurveyService: http://localhost:3001"
echo "   - ParticipantService: http://localhost:8081"
echo ""