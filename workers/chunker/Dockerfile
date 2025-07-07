# VibesFlow Chunker Shade Agent - Production Dockerfile
# Optimized for Phala Cloud dStack deployment with TEE support

FROM node:18-alpine AS base

# Install system dependencies required for TEE and cryptography
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers \
    ca-certificates \
    curl \
    && rm -rf /var/cache/apk/*

# Create application directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production \
    && npm cache clean --force

# Copy application code
COPY . .

# Create required directories
RUN mkdir -p temp receipts logs \
    && chmod 755 temp receipts logs

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S vibesflow -u 1001

# Set proper ownership
RUN chown -R vibesflow:nodejs /app

# Switch to non-root user
USER vibesflow

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Environment variables for production
ENV NODE_ENV=production
ENV PORT=3001
ENV TEE_ENABLED=true
ENV TEE_ATTESTATION_MODE=production

# Labels for container metadata
LABEL org.opencontainers.image.title="VibesFlow Chunker Shade Agent"
LABEL org.opencontainers.image.description="NEAR Shade Agent for VRF chunk processing with TEE attestation"
LABEL org.opencontainers.image.version="2.0.0"
LABEL org.opencontainers.image.vendor="VibesFlow"
LABEL org.opencontainers.image.source="https://github.com/vibesflow/vibesflow"
LABEL shade-agent.type="chunker-worker"
LABEL shade-agent.network="near-testnet"
LABEL shade-agent.tee-enabled="true"

# Start the application
CMD ["node", "server.js"]
