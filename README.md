# Kontrolled — Automation + Website Builder

Kontrolled provides two separate creation experiences:

1. **Automation Builder** — sends a prompt to the user's n8n AI Workflow Factory, validates the returned workflow, and deploys it inactive to either a remote n8n instance or local n8n through the Kontrolled Companion.
2. **Website Builder** — sends a website brief to a separate n8n webhook and supports sandbox preview and HTML download.

n8n remains the only automation engine. Kontrolled does not execute workflows.

## Requirements

- Node.js 20.11+
- n8n instance with public API enabled
- For local deployment: Docker Compose and a local n8n API key

## Run the Kontrolled backend

A configured `.env` file is included. It already points `GENERATOR_WEBHOOK_URL` to `http://localhost:5678/webhook/automation-factory`. The access and companion tokens are generated for this project copy. Paste the value of `KONTROLLED_ACCESS_TOKEN` into the Automation Builder's Developer access settings. Add your n8n API key to `LOCAL_N8N_API_KEY` only if you use the local Companion deployment feature.

```bash
npm start
```

Open http://127.0.0.1:3000.

For local development, the UI's **Developer access settings** accepts `KONTROLLED_ACCESS_TOKEN`. This is a temporary shared-token gate, not customer authentication. Do not expose this MVP as a public multi-user service.

## Configure the AI Workflow Factory

1. Import `AI-Workflow-Factory-Kontrolled-API.json` into your n8n instance. This is the supplied factory with its successful response adjusted to preserve the `workflow`, `requirements`, and `implementationSummary` fields. Your original factory export remains unchanged outside this project.
2. Configure its Google Gemini credentials and confirm the selected Gemini model is available in your n8n installation.
3. Activate the workflow.
4. The included `.env` already sets `GENERATOR_WEBHOOK_URL=http://localhost:5678/webhook/automation-factory`. This is the n8n Production URL on the same computer, not a public URL.
5. Restart Kontrolled after changing `.env`.

The backend accepts the factory's structured wrapper and derives a basic configuration manifest from node credential references and trigger nodes. This is a starting point: users still authorize app credentials inside their own n8n instance. Factory validation is not a security audit or proof that a generated workflow is semantically correct.

## Website Builder

Set `WEBSITE_GENERATOR_WEBHOOK_URL` to a separate n8n webhook that accepts `{ "prompt": "...", "request_type": "website", "source": "kontrolled" }` and returns `{ "html": "<!doctype html>..." }`. The AI Workflow Factory supplied here generates n8n workflows only; it is not the website generator.

## Remote n8n deployment

The Automation Builder accepts an HTTPS n8n instance URL and API key. The API key is sent to the backend and kept in process memory for up to 30 minutes in this development build. Workflow creation uses the n8n public API and creates workflows inactive. The connection store is volatile and is not a production credential vault.

## Local n8n deployment

1. Use the included `.env`; configure `N8N_ENCRYPTION_KEY` before using the local deployment setup in a different environment.
2. Run `docker compose up -d` to start n8n on loopback port 5678.
3. Complete n8n's owner setup and create an n8n API key.
4. Set `LOCAL_N8N_API_KEY` and a unique `COMPANION_TOKEN` in `.env`.
5. Start Kontrolled with `npm start`.
6. In another terminal, run `npm run companion`.
7. Open the Automation Builder, connect the companion and deploy.

Full instructions: `/docs/local-setup.html`.

Local scheduled workflows run only while the computer and Docker service are running. Public webhook triggers require a reachable endpoint. Do not expose the n8n editor, Docker socket or local API directly to the public internet.

## API endpoints

- `GET /api/health`
- `POST /api/access/check`
- `POST /api/generate`
- `POST /api/generate/website`
- `POST /api/workflows/validate`
- `POST /api/connections/test`
- `POST /api/deploy/remote`

Protected routes require `X-Kontrolled-Token: <KONTROLLED_ACCESS_TOKEN>`.

## Important MVP limitations

- Shared access token is for local development only; production needs real user authentication and per-user authorization.
- Remote connection credentials are held in server memory only; production needs encrypted persistent secret storage, audit logs, tenant isolation and revocation.
- Local companion uses a pairing token and loopback binding; production needs stronger pairing, origin validation and signed short-lived deployment requests.
- The website builder needs its own n8n generation workflow and is not supplied by the AI Workflow Factory file.
- Deployment creates inactive workflows. Credential creation, semantic testing and activation remain customer-controlled.
- Review n8n's current licensing and OEM terms for your intended commercial distribution model before launch.

## Code formatting

Install the development dependency once, then format the project consistently:

```bash
npm install
npm run format
npm run format:check
```

## Tests

```bash
npm test
```
