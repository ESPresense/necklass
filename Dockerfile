FROM node:20-alpine

WORKDIR /app

# Install Tailscale and dependencies
RUN apk add --no-cache \
    ca-certificates \
    iptables \
    ip6tables \
    bash \
    jq \
    curl \
    tailscale

# Download prebuilt bd binary (v0.50.3)
RUN curl -fsSL https://github.com/steveyegge/beads/releases/download/v0.50.3/bd-linux-amd64 -o /usr/local/bin/bd && \
    chmod +x /usr/local/bin/bd

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
