# Kontrolled build status — 23 November 2026

## Changes in this revision

- Improved n8n webhook handling for direct JSON responses, n8n item arrays, and common `json`, `output`, and `data` wrappers.
- Added clearer errors for connection failures, timeouts, non-JSON responses, and non-success HTTP responses.
- Upstream n8n failures now return HTTP 502 from the Kontrolled API rather than being mislabeled as malformed client requests.
- Kept the automation and website generation flows separate; Website Builder still requires its own n8n webhook.
- Reformatted JavaScript, CSS, and HTML files for easier reading.
- Added `.editorconfig`, Prettier configuration, and `format` / `format:check` scripts for consistent formatting going forward.
- Refined generator-page styling, focus states, responsive layouts, buttons, result panels, and deployment cards.
- Expanded the README with webhook URL setup and troubleshooting instructions.

## Verification performed in this revision

- `npm test`: 9 passed, 0 failed.
- JavaScript syntax checks passed for server, companion, frontend and tests.
- Both CSS files parsed successfully.
- Factory workflow JSON parsed successfully; webhook is configured for POST `/webhook/automation-factory`.
- Automation page, Website Builder page, CSS files, and frontend JavaScript returned HTTP 200 from the local Kontrolled server.
- Mock n8n integration test: Kontrolled sent the prompt to a local mock webhook and successfully normalized its item-array response into a workflow, requirements, and setup manifest.
- Mock upstream failure test: an unreachable n8n endpoint produced a clear HTTP 502 error.

## Still requires the user's real n8n setup

- The supplied AI Workflow Factory has not been run against the user's live n8n instance or Gemini credentials in this environment.
- The user must import and activate the factory, then copy its **Production URL** into `GENERATOR_WEBHOOK_URL` in `.env`.
- The Website Builder requires a separate n8n webhook that returns generated HTML.
- Remote and local deployment still require the user's actual n8n API key(s) and environment setup.
- This remains a development MVP, not a production multi-tenant SaaS. Replace the shared access token, in-memory API-key storage, and basic companion pairing before public launch.
