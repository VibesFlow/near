#!/bin/bash

# VibesFlow Workers Build Script
# Builds both dispatcher and chunker Docker images and extracts code hashes
# Following NEAR Shade Agents documentation patterns

set -e

echo "🚀 Building VibesFlow Workers for Phala Cloud Deployment"
echo "Following NEAR Shade Agents documentation patterns"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Build Dispatcher Worker
echo -e "${BLUE}📦 Building Dispatcher Worker...${NC}"
cd dispatcher
echo "Building ghcr.io/vibesflow/dispatcher:latest"
docker buildx build --platform linux/amd64 --no-cache -t ghcr.io/vibesflow/dispatcher:latest .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dispatcher build successful${NC}"
else
    echo -e "${RED}❌ Dispatcher build failed${NC}"
    exit 1
fi

cd ..

# Build Chunker Worker  
echo -e "${BLUE}📦 Building Chunker Worker...${NC}"
cd chunker
echo "Building ghcr.io/vibesflow/chunker:latest"
docker buildx build --platform linux/amd64 --no-cache -t ghcr.io/vibesflow/chunker:latest .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Chunker build successful${NC}"
else
    echo -e "${RED}❌ Chunker build failed${NC}"
    exit 1
fi

cd ..

echo ""
echo -e "${YELLOW}🔍 Extracting Code Hashes...${NC}"

# Extract code hashes
DISPATCHER_IMAGE_ID=$(docker images ghcr.io/vibesflow/dispatcher:latest --format "{{.ID}}")
CHUNKER_IMAGE_ID=$(docker images ghcr.io/vibesflow/chunker:latest --format "{{.ID}}")

echo ""
echo -e "${GREEN}📋 Build Summary:${NC}"
echo "===================="
echo -e "Dispatcher Image ID: ${BLUE}${DISPATCHER_IMAGE_ID}${NC}"
echo -e "Chunker Image ID:    ${BLUE}${CHUNKER_IMAGE_ID}${NC}"

echo ""
echo -e "${YELLOW}🔗 Code Hashes for Contract Approval:${NC}"
echo "======================================"
echo -e "Dispatcher: ${GREEN}${DISPATCHER_IMAGE_ID}${NC}"
echo -e "Chunker:    ${GREEN}${CHUNKER_IMAGE_ID}${NC}"

echo ""
echo -e "${YELLOW}📝 Contract Update Commands:${NC}"
echo "============================="
echo "# Approve dispatcher code hash:"
echo "near contract call-function as-transaction v1dispatcher.vibesflow.testnet approve_codehash json-args '{\"codehash\": \"${DISPATCHER_IMAGE_ID}\"}' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' sign-as dispatcher.vibesflow.testnet network-config testnet"
echo ""
echo "# Approve chunker code hash:"
echo "near contract call-function as-transaction v1chunker.vibesflow.testnet approve_codehash json-args '{\"codehash\": \"${CHUNKER_IMAGE_ID}\"}' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' sign-as chunker.vibesflow.testnet network-config testnet"

echo ""
echo -e "${YELLOW}🐳 Docker Push Commands:${NC}"
echo "========================"
echo "# Push dispatcher:"
echo "docker push ghcr.io/vibesflow/dispatcher:latest"
echo ""
echo "# Push chunker:"
echo "docker push ghcr.io/vibesflow/chunker:latest"

echo ""
echo -e "${YELLOW}🔧 Environment Variables for Phala Cloud:${NC}"
echo "=========================================="
echo "DISPATCHER_CODEHASH=${DISPATCHER_IMAGE_ID}"
echo "CHUNKER_CODEHASH=${CHUNKER_IMAGE_ID}"

echo ""
echo -e "${GREEN}✅ Build complete! Follow the deployment guide in README.md${NC}"
echo -e "${BLUE}📖 Next steps:${NC}"
echo "1. Run the contract update commands above"
echo "2. Push images to GHCR"
echo "3. Deploy using docker-compose.yaml with Phala Cloud"
echo "4. Set environment variables in Phala dashboard" 