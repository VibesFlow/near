# VibesFlow Chunker Worker - NEAR Shade Agent
# Dockerfile for production deployment on Phala Cloud

FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    curl

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p temp receipts logs

# Create non-root user for security
RUN addgroup --system --gid 1001 chunker && \
    adduser --system --uid 1001 chunker

# Set ownership
RUN chown -R chunker:chunker /app

# Switch to non-root user
USER chunker

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start the application
CMD ["node", "server.js"]
