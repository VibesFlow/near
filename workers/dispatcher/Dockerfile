# VibesFlow Dispatcher Worker Agent - Phala Cloud Deployment
# Production-ready Dockerfile for Express-based NEAR Shade Agent

FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    ca-certificates \
    tzdata \
    curl \
    && rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=UTC

# Create app directory
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS dev
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS builder
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force
COPY . .

# Create production directories
RUN mkdir -p temp uploads receipts

# Verify server.js exists
RUN ls -la server.js

# Production runtime stage
FROM base AS runner

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create app user for security
RUN addgroup --system --gid 1001 appgroup
RUN adduser --system --uid 1001 appuser

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY --from=builder --chown=appuser:appgroup /app/server.js ./
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Copy contract directory for deployment
COPY --from=builder --chown=appuser:appgroup /app/contract ./contract

# Create and set permissions for runtime directories
RUN mkdir -p temp uploads receipts && \
    chown -R appuser:appgroup temp uploads receipts

# Switch to app user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start the Express server
CMD ["node", "server.js"]

# Production target alias
FROM runner AS prod
