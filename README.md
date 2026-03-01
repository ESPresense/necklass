# necklass

GitHub webhook → beads integration service. Converts GitHub events (PRs, issues, checks, comments) into beads with automatic lifecycle management.

## Features

- HMAC signature verification for GitHub webhooks
- Automatic bead creation/updates for all GitHub events
- Zero-token approach: direct `bd` CLI execution
- 12-factor app design
- Docker ready

## Environment Variables

```bash
GITHUB_WEBHOOK_SECRET=your-secret-here  # Required: GitHub webhook secret
PORT=80                                  # Optional: HTTP port (default: 80)
BD_PATH=/usr/local/bin/bd               # Optional: Path to bd CLI (default: bd in PATH)
LOG_LEVEL=info                          # Optional: info|debug|error (default: info)
```

## Quick Start

```bash
# Install dependencies
npm install

# Set environment
export GITHUB_WEBHOOK_SECRET=your-secret

# Run
npm start
```

## Docker

```bash
docker build -t github2beads .
docker run -p 80:80 -e GITHUB_WEBHOOK_SECRET=secret github2beads
```

## GitHub Setup

1. Navigate to repo Settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain/webhook`
3. Content type: `application/json`
4. Secret: (same as GITHUB_WEBHOOK_SECRET)
5. Events: Select "Send me everything"

## Bead Mapping

| GitHub Event | Bead Action |
|--------------|-------------|
| PR opened | Create bead, defer +8h |
| PR closed/merged | Close bead |
| Check failed | Undefer + update notes |
| Check passed | Update notes |
| Issue/PR comment | Undefer + append comment |
| Issue opened | Create bead |
| Issue closed | Close bead |

## Tailscale Funnel Support

necklass includes built-in Tailscale Funnel support for secure public webhook access without exposing ports or configuring reverse proxies.

### Quick Start with Tailscale

```bash
docker run -d \
  -e GITHUB_WEBHOOK_SECRET=your-secret \
  -e TAILSCALE_AUTHKEY=tskey-auth-xxx \
  -e TAILSCALE_HOSTNAME=necklass \
  -e BD_PATH=/usr/local/bin/bd \
  -v /usr/local/bin/bd:/usr/local/bin/bd:ro \
  --name necklass \
  ghcr.io/espresense/necklass:latest
```

**Environment Variables:**
- `TAILSCALE_AUTHKEY` - Tailscale auth key (get from https://login.tailscale.com/admin/settings/keys)
- `TAILSCALE_HOSTNAME` - Tailscale hostname (default: `necklass`)
- `TAILSCALE_FUNNEL_PORT` - Port to expose via Funnel (default: same as `PORT`)

The container will:
1. Start Tailscale with userspace networking
2. Authenticate with your tailnet
3. Enable Funnel on the webhook port
4. Print the public HTTPS URL on startup

**GitHub Webhook URL:**
```
https://necklass.your-tailnet.ts.net/webhook
```

### Without Tailscale

If `TAILSCALE_AUTHKEY` is not set, necklass runs as a standard HTTP server. Use Traefik, nginx, or another reverse proxy for TLS termination.


## Docker Compose

```bash
# Create .env file
cp .env.example .env
# Edit .env and set GITHUB_WEBHOOK_SECRET and optionally TAILSCALE_AUTHKEY

# Start
docker compose up -d

# View logs (includes Tailscale Funnel URL if enabled)
docker compose logs -f

# Stop
docker compose down
```

See [docker-compose.yml](docker-compose.yml) for configuration options.
