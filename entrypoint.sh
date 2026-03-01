#!/bin/sh
set -e

# If Tailscale auth key is provided, set up funnel
if [ -n "$TAILSCALE_AUTHKEY" ]; then
    echo "Starting Tailscale..."
    
    # Start tailscaled in background
    /usr/local/bin/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
    sleep 2
    
    # Authenticate
    /usr/local/bin/tailscale up --authkey="${TAILSCALE_AUTHKEY}" --hostname="${TAILSCALE_HOSTNAME:-necklass}"
    
    # Wait for Tailscale to be ready
    until /usr/local/bin/tailscale status >/dev/null 2>&1; do
        echo "Waiting for Tailscale to start..."
        sleep 1
    done
    
    echo "Tailscale started successfully"
    
    # Enable funnel on the webhook port
    if [ -n "$TAILSCALE_FUNNEL_PORT" ]; then
        FUNNEL_PORT="${TAILSCALE_FUNNEL_PORT}"
    else
        FUNNEL_PORT="${PORT:-80}"
    fi
    
    echo "Enabling Tailscale Funnel on port ${FUNNEL_PORT}..."
    /usr/local/bin/tailscale funnel --bg "${FUNNEL_PORT}"
    
    echo "Tailscale Funnel enabled: https://$(tailscale status --json | jq -r '.Self.DNSName' | sed 's/\.$//')"
fi

# Start the Node.js application
exec node index.js
