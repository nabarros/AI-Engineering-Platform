# Dockerfile for AI Engineering Platform
# Single-stage build for local development/deployment
FROM node:20.18.0-alpine3.19

# Create non-root user
RUN addgroup -g 1001 -S aiep && adduser -S aiep -u 1001 -G aiep

WORKDIR /app

# Copy package files
COPY --chown=aiep:aiep package.json package-lock.json ./

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY --chown=aiep:aiep src/ ./src/
COPY --chown=aiep:aiep scripts/ ./scripts/

# Create data directory for state persistence
RUN mkdir -p ./data && chown -R aiep:aiep ./data

# Set environment
ENV NODE_ENV=production

# Switch to non-root user
USER aiep

# Expose ports
EXPOSE 8787 8790

# Health check for orchestration API
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8787/health || exit 1

# Start both services in parallel
CMD ["sh", "-c", "npm run start:orchestration-api 8787 & npm run start:shared-state-service 8790 & wait"]
