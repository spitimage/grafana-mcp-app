# Grafana MCP App

An MCP (Model Context Protocol) App that lets Claude users explore live Grafana dashboards inline within conversations.

## Features

- 🔍 **Natural language discovery** — Ask Claude to find and show specific panels
- 📊 **Interactive embeds** — Time range controls and variable dropdowns in-chat
- 🔄 **Bidirectional context** — Variable changes update Claude's context
- 🖼️ **Fallback rendering** — Static PNG when live iframe fails

## Prerequisites

- Node.js 18+ (recommended: 20+)
- Docker (for running Grafana)
- curl (for API setup scripts)

## Quick Start

### 1. Start Grafana with Docker

Run Grafana with embedding enabled and anonymous access:

```bash
docker run -d \
  --name grafana \
  -p 3000:3000 \
  -e GF_AUTH_ANONYMOUS_ENABLED=true \
  -e GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer \
  -e GF_SECURITY_ALLOW_EMBEDDING=true \
  -e GF_SECURITY_COOKIE_SAMESITE=none \
  -e GF_SECURITY_COOKIE_SECURE=false \
  grafana/grafana:latest
```

Wait for Grafana to start (about 10-15 seconds), then verify:

```bash
curl http://localhost:3000/api/health
# Should return: {"database":"ok","version":"..."}
```

Access Grafana UI at: http://localhost:3000 (default login: admin/admin)

### 2. Create Grafana Service Account Token

```bash
# Create service account
curl -X POST http://admin:admin@localhost:3000/api/serviceaccounts \
  -H "Content-Type: application/json" \
  -d '{"name": "mcp-server", "role": "Viewer"}'

# Note the service account ID from the response, then create a token
# Replace {id} with the actual ID (usually 1 for first service account)
curl -X POST http://admin:admin@localhost:3000/api/serviceaccounts/1/tokens \
  -H "Content-Type: application/json" \
  -d '{"name": "mcp-token"}'

# Copy the "key" value from the response - this is your GRAFANA_SERVICE_TOKEN
```

### 3. Setup Test Dashboard

Run the setup script to create a TestData datasource and sample dashboard:

```bash
# Create TestData datasource and test dashboard
npm run setup:grafana
```

This will output a dashboard UID that you can use for testing.

Alternatively, use the manual setup script:

```bash
node scripts/setup-grafana.js
```

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Required: Your Grafana instance URL
GRAFANA_BASE_URL=http://localhost:3000

# Required: Service Account Token from step 2
GRAFANA_SERVICE_TOKEN=glsa_xxxxxxxxxxxx

# Optional: Organization ID (defaults to 1)
GRAFANA_ORG_ID=1

# Optional: Default theme for embedded panels
GRAFANA_DEFAULT_THEME=dark

# Optional: HTTP server port (for HTTP mode)
PORT=3001
```

**Note:** If testing from another machine on your network, use your network IP instead:
```bash
GRAFANA_BASE_URL=http://192.168.x.x:3000
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Build the MCP App

```bash
npm run build
```

This compiles:
- MCP server → `dist/src/server/`
- UI bundle → `dist/src/ui/grafana-panel.html` (single-file)

### 7. Run the MCP Server

**HTTP Mode (for testing with basic-host or remote deployment):**

```bash
npm start
```

Server will be available at:
- `http://localhost:3001/mcp` (MCP endpoint)
- `http://localhost:3001/health` (health check)

**stdio Mode (for Claude Desktop):**

```bash
node dist/src/server/main.js --stdio
```

## Testing the MCP App

### Using basic-host (Recommended for Development)

The basic-host is a reference implementation for testing MCP Apps locally:

1. **Start the MCP server** (in one terminal):
   ```bash
   npm start
   ```

2. **Start basic-host** (in another terminal):
   ```bash
   cd /path/to/mcp-apps-host/examples/basic-host
   npm install
   SERVERS='["http://localhost:3001/mcp"]' npm run serve
   ```

3. **Open browser**: http://localhost:8080

4. **Test the tools**:
   - Click on `render_panel` tool
   - Enter payload (use the dashboard UID from setup):
     ```json
     {
       "dashboard_uid": "your-dashboard-uid",
       "panel_id": 1
     }
     ```
   - Click "Call Tool"
   - You should see an interactive Grafana panel!

### Using Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "grafana": {
      "command": "node",
      "args": ["/absolute/path/to/grafana-mcp-app/dist/src/server/main.js", "--stdio"],
      "env": {
        "GRAFANA_BASE_URL": "http://localhost:3000",
        "GRAFANA_SERVICE_TOKEN": "glsa_xxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop, then ask:
```
Show me the Random Walk panel from the Test Dashboard
```

## Available MCP Tools

### 1. search_dashboards

Search for Grafana dashboards by title.

**Input:**
```json
{
  "query": "test"
}
```

**Output:** List of matching dashboards with UIDs and titles.

### 2. get_dashboard_panels

Get all panels and variables from a dashboard.

**Input:**
```json
{
  "dashboard_uid": "your-dashboard-uid"
}
```

**Output:** Panel metadata (IDs, titles, types) and template variables.

### 3. render_panel

Render an interactive Grafana panel with live data.

**Input:**
```json
{
  "dashboard_uid": "your-dashboard-uid",
  "panel_id": 1,
  "from": "now-6h",
  "to": "now",
  "variables": {
    "server": "prod-01"
  },
  "refresh": "30s"
}
```

**Output:** Interactive panel with time controls and variable dropdowns.

## Development

### Watch Mode

For active development with hot reload:

```bash
npm run dev
```

This starts:
- Vite in watch mode (rebuilds UI on changes)
- TypeScript compiler in watch mode (server)
- Server will auto-restart on changes

### Run Tests

```bash
npm test
```

### Type Checking

```bash
npm run typecheck
```

## Project Structure

```
grafana-mcp-app/
├── src/
│   ├── server/
│   │   ├── main.ts              # Entry point (HTTP + stdio)
│   │   ├── server.ts            # MCP server + tool registration
│   │   ├── grafana-client.ts    # Grafana API client
│   │   ├── embed-url-builder.ts # URL construction
│   │   └── types.ts             # Shared types
│   └── ui/
│       ├── grafana-panel.html   # MCP App HTML shell
│       ├── grafana-panel.ts     # MCP App entry point
│       ├── components/          # UI components
│       │   ├── ControlBar.ts    # Time + variable controls
│       │   └── StatusBanner.ts  # Status messages
│       ├── lib/                 # Client-side utilities
│       │   └── url-builder.ts   # Client-side URL building
│       └── styles/              # CSS
│           └── app.css
├── scripts/
│   └── setup-grafana.js         # Grafana setup automation
├── tests/
│   └── unit/                    # Unit tests
├── dist/                        # Build output (generated)
├── tsconfig.json                # TypeScript config (UI)
├── tsconfig.server.json         # TypeScript config (server)
├── vite.config.ts               # Vite bundler config
├── .env.example                 # Environment template
└── package.json
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Type-check, compile server, bundle UI |
| `npm run dev` | Watch mode for development |
| `npm start` | Run production server in HTTP mode |
| `npm test` | Run tests with Vitest |
| `npm run typecheck` | Type-check without building |
| `npm run setup:grafana` | Create TestData datasource and dashboard |

## Troubleshooting

### "Panel shows blank iframe" or "Content-Security-Policy" errors

The MCP App includes CSP metadata to allow Grafana iframes. Ensure:

1. Your `GRAFANA_BASE_URL` is correct in `.env`
2. The MCP server was rebuilt after changing the URL
3. The host (basic-host or Claude Desktop) supports MCP Apps CSP

### "Showing static snapshot. Live panel unavailable."

This means the iframe couldn't load but the fallback PNG is working. Check:

1. Can you access Grafana from the browser running the MCP host?
   ```bash
   curl http://localhost:3000/api/health
   ```

2. Is Grafana configured to allow embedding?
   ```bash
   docker exec grafana grep -A 5 "\[security\]" /etc/grafana/grafana.ini
   # Should show: allow_embedding = true
   ```

3. Check browser console (F12) for specific errors

### "Could not authenticate with Grafana"

Verify service token is valid:

```bash
curl -H "Authorization: Bearer $GRAFANA_SERVICE_TOKEN" \
  http://localhost:3000/api/org
```

Should return org details, not 401. If invalid, create a new token (see step 2 above).

### "Cannot reach Grafana" from another machine

If testing from a different machine (e.g., Mac accessing Linux server):

1. Use network IP in `GRAFANA_BASE_URL`:
   ```bash
   GRAFANA_BASE_URL=http://192.168.x.x:3000
   ```

2. Ensure Grafana is accessible from that IP:
   ```bash
   # From the other machine
   curl http://192.168.x.x:3000/api/health
   ```

3. Check firewall rules if connection fails

### "Unsupported MIME type: text/html"

The MCP server must return `text/html;profile=mcp-app` for MCP App resources. This is handled automatically by the `RESOURCE_MIME_TYPE` constant. If you see this error:

1. Ensure you're using the latest build: `npm run build`
2. Check that the server imported `RESOURCE_MIME_TYPE` from the SDK
3. Verify the resource is registered with the correct MIME type

### Build errors

Type-check separately to see detailed errors:

```bash
npm run typecheck
```

Common issues:
- Missing dependencies: `npm install`
- TypeScript version mismatch: Delete `node_modules` and reinstall
- Path issues: Ensure you're in the project root

## Docker Grafana Management

### Stop Grafana

```bash
docker stop grafana
```

### Start Grafana (if already created)

```bash
docker start grafana
```

### Remove Grafana (WARNING: deletes all data)

```bash
docker stop grafana
docker rm grafana
```

### View Grafana Logs

```bash
docker logs -f grafana
```

### Recreate Grafana with fresh data

```bash
docker stop grafana && docker rm grafana
docker run -d \
  --name grafana \
  -p 3000:3000 \
  -e GF_AUTH_ANONYMOUS_ENABLED=true \
  -e GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer \
  -e GF_SECURITY_ALLOW_EMBEDDING=true \
  -e GF_SECURITY_COOKIE_SAMESITE=none \
  -e GF_SECURITY_COOKIE_SECURE=false \
  grafana/grafana:latest

# Wait for startup
sleep 10

# Run setup script again
npm run setup:grafana
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  MCP Host (Claude Desktop / claude.ai)     │
│                                             │
│  ┌────────┐      ┌──────────────────────┐  │
│  │ Claude │◄────►│  MCP Server (Node)   │  │
│  └────────┘      │  • search_dashboards │  │
│      │           │  • get_panels        │  │
│      │           │  • render_panel      │  │
│      ▼           └──────────────────────┘  │
│  ┌────────────────────┐         │          │
│  │  MCP App (iframe)  │         │ HTTPS    │
│  │  ┌──────────────┐  │         ▼          │
│  │  │ Control Bar  │  │  ┌─────────────┐   │
│  │  ├──────────────┤  │  │   Grafana   │   │
│  │  │ Grafana      │◄─┼──┤  Instance   │   │
│  │  │ Panel Embed  │  │  └─────────────┘   │
│  │  └──────────────┘  │                     │
│  └────────────────────┘                     │
└─────────────────────────────────────────────┘
```

## Security Considerations

### Production Deployment

For production use:

1. **Use HTTPS** for Grafana:
   ```bash
   GRAFANA_BASE_URL=https://grafana.yourcompany.com
   ```

2. **Secure service account tokens**:
   - Store in environment variables, not in code
   - Rotate tokens regularly
   - Use minimal permissions (Viewer role is sufficient)

3. **Enable authentication** if exposing the MCP server:
   - Remove anonymous access from Grafana
   - Add authentication middleware to the MCP server
   - Use HTTPS with valid certificates

4. **Set secure cookies** in production Grafana:
   ```bash
   GF_SECURITY_COOKIE_SECURE=true
   GF_SECURITY_COOKIE_SAMESITE=lax
   ```

5. **Rate limiting**: The server includes basic rate limiting (60 req/min per IP)

### Network Security

- The MCP server binds to `0.0.0.0` for network accessibility
- Consider using `allowedHosts` option in production
- Use firewall rules to restrict access to trusted networks

## License

ISC

## Contributing

Contributions welcome! Please ensure:

1. All tests pass: `npm test`
2. TypeScript compiles: `npm run typecheck`
3. Code is formatted: `npm run format` (if available)
4. Update README for significant changes

## Support

For issues or questions:

1. Check the Troubleshooting section above
2. Review browser console for errors (F12)
3. Check MCP server logs
4. Open an issue with:
   - Environment details (OS, Node version, Grafana version)
   - Steps to reproduce
   - Error messages from console/logs
