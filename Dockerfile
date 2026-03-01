FROM node:20-alpine

WORKDIR /app

# Install Tailscale
RUN apk add --no-cache \
    ca-certificates \
    iptables \
    ip6tables \
    bash \
    curl \
    jq && \
    curl -fsSL https://tailscale.com/install.sh | sh

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application
COPY index.js entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Create state directory for Tailscale
RUN mkdir -p /var/run/tailscale /var/cache/tailscale /var/lib/tailscale

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-80}/health || exit 1

EXPOSE 80

ENTRYPOINT ["./entrypoint.sh"]
