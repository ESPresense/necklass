FROM golang:1.23-alpine AS builder

# Clone and build beads at specific commit (compatible version)
RUN apk add --no-cache git && \
    git clone https://github.com/asg017/beads.git /build && \
    cd /build && \
    git checkout bd25acbc && \
    go build -o bd ./cmd/bd

FROM node:20-alpine

WORKDIR /app

# Install Tailscale from Alpine repos
RUN apk add --no-cache \
    ca-certificates \
    iptables \
    ip6tables \
    bash \
    jq \
    tailscale

# Copy bd from builder
COPY --from=builder /build/bd /usr/local/bin/bd

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
