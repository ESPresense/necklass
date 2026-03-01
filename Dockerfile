FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install bd CLI (adjust path if needed)
# Assumes bd is available in PATH or mounted as volume
RUN apk add --no-cache bash

# Copy application
COPY index.js ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-80}/health || exit 1

# Run as non-root
USER node

EXPOSE 80

CMD ["node", "index.js"]
