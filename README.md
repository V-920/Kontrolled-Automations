# Kontrolled Automations

Kontrolled Automations is a front-end project for a connected website and n8n workflow builder. Users provide two briefs—one for a website and one for an automation workflow—and submit them together to a configured n8n webhook.

> **Project status:** The front end is a starter integration. You must configure the n8n webhook and implement the workflow-generation logic before end-to-end generation will work.

## Features

- Black-and-gold visual design.
- Responsive layout for desktop and mobile screens.
- Animated particle-and-constellation background with pointer interaction.
- Separate inputs for the website brief and workflow brief.
- Both briefs are submitted together in one request.
- Download controls for the generated `index.html` and `workflow.json` response files.
- Modular source files: HTML, CSS, and JavaScript are kept separate.

## Project structure

```text
kontrolled-automations/
├── index.html
├── style.css
├── script.js
├── kontrolled-k-mark.png
└── README.md
```

Keep the logo image in the same project folder as `index.html`, unless you update its path in the HTML.

## Run locally

1. Download or clone this repository.
2. Keep all project files in the same folder.
3. Open `index.html` in a modern browser.

No build step is required for the static front end.

## Configure the n8n webhook

1. Create an n8n workflow with a Webhook trigger.
2. Configure the webhook to accept a `POST` request.
3. Copy the production webhook URL.
4. Open `script.js` and replace the placeholder `N8N_WEBHOOK_URL` with your URL.
5. Configure the workflow to process both prompts and return the generated website HTML and workflow JSON.
6. Activate the n8n workflow and test the site.

Do not publish private credentials in the front-end code. A webhook URL embedded in browser JavaScript is visible to visitors, so use appropriate validation, rate limiting, and access controls in your backend.

## Request format

The front end sends both prompts in one JSON request:

```json
{
  "website_prompt": "Describe the website to generate",
  "workflow_prompt": "Describe the n8n automation to generate",
  "request_type": "connected_website_and_workflow",
  "source": "kontrolled"
}
```

## Expected response

The front end expects a JSON response containing the generated HTML and workflow data. The primary field names are:

```json
{
  "html": "<!doctype html>...",
  "workflow": {
    "name": "Generated workflow",
    "nodes": [],
    "connections": {}
  }
}
```

The integration may also accept the alternate field names supported by the current `script.js` implementation, such as `index_html`, `website_html`, or `workflow_json`. Keep the n8n response aligned with the parser in `script.js`.

The workflow object should be valid n8n workflow JSON for the n8n version where it will be imported. Review generated workflows before activating them.

## Architecture

- **`index.html`** — page structure and links to the stylesheet and JavaScript.
- **`style.css`** — layout, responsive styling, theme, and visual effects.
- **`script.js`** — animation, form handling, webhook request, response parsing, and file downloads.
- **`kontrolled-k-mark.png`** — brand mark used by the page.
- **`README.md`** — project documentation.

## Customization

- Change colors, typography, spacing, and responsive breakpoints in `style.css`.
- Change page copy and structural sections in `index.html`.
- Change the webhook URL, request handling, animation settings, and download parsing in `script.js`.
- Replace `kontrolled-k-mark.png` with your own logo, keeping the filename or updating the reference in `index.html`.

## Deployment

You can host the static front end on GitHub Pages or another static hosting provider. The n8n workflow must be hosted separately and reachable from the deployed site. Configure CORS on the webhook/backend as needed for your site's domain.

## Security and limitations

- The browser-based front end does not itself generate websites or n8n workflows; that work must be implemented in n8n or another backend.
- Do not put API keys, passwords, or other secrets in `index.html` or `script.js`.
- Treat generated HTML and workflow JSON as untrusted output. Inspect and test them before use.
- Add server-side validation, request limits, and abuse protection before making the generator publicly available.
- The webhook must return the response shape expected by the front end.

## License

Copyright (c) 2026 Kontrolled. All Rights Reserved.

Unauthorized copying, modification, distribution, or use of this software, 
via any medium, is strictly prohibited without the express written permission 
of Kontrolled.
