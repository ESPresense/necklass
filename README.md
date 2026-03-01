# github2beads

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
