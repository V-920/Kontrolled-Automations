import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { validateWorkflow, toN8nCreatePayload } from "./workflow.js";
import { validateRemoteInstanceUrl, testN8nConnection, createN8nWorkflow } from "./n8n-client.js";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
// Small dependency-free .env loader for local development.
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || match[1] in process.env)
            continue;
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
            value = value.slice(1, -1);
        process.env[match[1]] = value;
    }
}
const PUBLIC = join(ROOT, "public");
const PORT = Number(process.env.PORT || 3000);
const ACCESS_TOKEN = process.env.KONTROLLED_ACCESS_TOKEN || "";
const GENERATOR_WEBHOOK_URL = process.env.GENERATOR_WEBHOOK_URL || "";
const WEBSITE_GENERATOR_WEBHOOK_URL = process.env.WEBSITE_GENERATOR_WEBHOOK_URL || "";
const GENERATOR_WEBHOOK_SECRET = process.env.GENERATOR_WEBHOOK_SECRET || "";
const connections = new Map();
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json; charset=utf-8" };
function send(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(body));
}
function equalToken(a, b) {
    if (!a || !b)
        return false;
    const aa = Buffer.from(a), bb = Buffer.from(b);
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function readBody(req, max = 1500000) {
    return new Promise((resolve, reject) => {
        let body = "", size = 0;
        req.on("data", chunk => { size += chunk.length; if (size > max) {
            reject(new Error("Request is too large."));
            req.destroy();
        }
        else
            body += chunk; });
        req.on("end", () => { try {
            resolve(body ? JSON.parse(body) : {});
        }
        catch {
            reject(new Error("Request body must be valid JSON."));
        } });
        req.on("error", reject);
    });
}
function requireAccess(req, res) {
    if (!ACCESS_TOKEN) {
        send(res, 503, { error: "Backend is not configured. Set KONTROLLED_ACCESS_TOKEN in .env." });
        return false;
    }
    if (!equalToken(req.headers["x-kontrolled-token"], ACCESS_TOKEN)) {
        send(res, 401, { error: "Access token is missing or incorrect." });
        return false;
    }
    return true;
}
function safeError(error) {
    return String(error?.message || "Unexpected error").slice(0, 400);
}
function normalizeWebhookPayload(payload) {
    // n8n can return a direct object, an item array, or a wrapped output.
    let value = payload;
    for (let depth = 0; depth < 4; depth += 1) {
        if (Array.isArray(value)) {
            value = value[0] ?? {};
            continue;
        }
        if (typeof value === "string") {
            try {
                value = JSON.parse(value);
                continue;
            }
            catch {
                return value;
            }
        }
        if (value && typeof value === "object") {
            if (value.json !== undefined) {
                value = value.json;
                continue;
            }
            if (value.output !== undefined) {
                value = value.output;
                continue;
            }
            if (value.data !== undefined && !value.workflow && !value.html) {
                value = value.data;
                continue;
            }
        }
        break;
    }
    return value;
}
async function callN8nWebhook(webhookUrl, body, secret = "") {
    let endpoint;
    try {
        endpoint = new URL(webhookUrl);
    }
    catch {
        throw new Error("The configured n8n webhook URL is invalid. Copy the complete Production URL from the n8n Webhook node.");
    }
    const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname);
    if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && isLoopback)) {
        throw new Error("The n8n webhook must use HTTPS unless it is running on this computer.");
    }
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
    };
    if (secret)
        headers["X-Kontrolled-Generator-Key"] = secret;
    let response;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            redirect: "manual",
            signal: AbortSignal.timeout(90000),
        });
    }
    catch (error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
            throw new Error("The n8n workflow took longer than 90 seconds. Check the execution in n8n and try again.");
        }
        throw new Error(`Could not reach the n8n webhook: ${safeError(error)} Check that n8n is running and the webhook URL is correct.`);
    }
    const responseText = await response.text();
    let payload;
    try {
        payload = responseText ? JSON.parse(responseText) : {};
    }
    catch {
        throw new Error(`n8n returned HTTP ${response.status} with a non-JSON response. Check the Respond to Webhook node and its response format.`);
    }
    if (!response.ok) {
        const detail = payload?.message || payload?.error || payload?.description;
        throw new Error(`n8n returned HTTP ${response.status}${detail ? `: ${detail}` : ". Check the n8n execution log for details."}`);
    }
    return normalizeWebhookPayload(payload);
}
function buildManifest(workflow, requirements = []) {
    const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
    const credentials = [];
    const integrations = [];
    for (const node of nodes) {
        const credTypes = Object.keys(node?.credentials || {});
        if (credTypes.length)
            credentials.push({ node: node.name, types: credTypes });
        if (node?.type) {
            const shortType = node.type.replace(/^n8n-nodes-base\./, "");
            const coreNodes = new Set(["if", "set", "code", "webhook", "manualTrigger", "scheduleTrigger", "httpRequest", "merge", "switch", "wait", "noOp", "respondToWebhook", "splitInBatches", "executeWorkflow", "stickyNote", "start"]);
            if (!coreNodes.has(shortType) && !node.type.startsWith("@n8n/"))
                integrations.push(shortType);
        }
    }
    const triggerNodes = nodes.filter(n => /trigger/i.test(n?.type || "") || ["n8n-nodes-base.webhook", "n8n-nodes-base.manualTrigger"].includes(n?.type)).map(n => n.name);
    return { integrations: [...new Set(integrations)], required_credentials: credentials, user_inputs: [], trigger_requirements: triggerNodes, requirements };
}
async function handleApi(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/health")
        return send(res, 200, { ok: true, service: "kontrolled-backend", version: "0.1.0" });
    if (req.method === "POST" && url.pathname === "/api/access/check") {
        const body = await readBody(req);
        return send(res, equalToken(body.token, ACCESS_TOKEN) && !!ACCESS_TOKEN ? 200 : 401, { valid: equalToken(body.token, ACCESS_TOKEN) && !!ACCESS_TOKEN });
    }
    if (!requireAccess(req, res))
        return;
    if (req.method === "POST" && url.pathname === "/api/workflows/validate") {
        const body = await readBody(req);
        const result = validateWorkflow(body.workflow);
        return send(res, result.valid ? 200 : 422, { valid: result.valid, errors: result.errors, warnings: result.warnings, summary: result.workflow ? { name: result.workflow.name, nodes: result.workflow.nodes?.length || 0 } : null });
    }
    if (req.method === "POST" && url.pathname === "/api/generate") {
        if (!GENERATOR_WEBHOOK_URL)
            return send(res, 503, { error: "AI generation is not connected yet. Set GENERATOR_WEBHOOK_URL to your n8n generation webhook. You can still paste a workflow JSON to test deployment." });
        const body = await readBody(req);
        if (typeof body.prompt !== "string" || body.prompt.trim().length < 8 || body.prompt.length > 6000)
            return send(res, 400, { error: "Describe the automation in 8–6,000 characters." });
        const payload = await callN8nWebhook(GENERATOR_WEBHOOK_URL, {
            prompt: body.prompt.trim(),
            request_type: "automation",
            source: "kontrolled",
            output_contract: "workflow_and_manifest_v1",
        }, GENERATOR_WEBHOOK_SECRET);
        if (payload?.success === false || payload?.workflow === null)
            return send(res, 422, { error: payload.message || payload.error || "The AI Workflow Factory could not produce a valid workflow.", details: payload.errors || [] });
        const workflow = payload.workflow || payload.workflow_json || payload;
        const validation = validateWorkflow(workflow);
        if (!validation.valid)
            return send(res, 422, { error: "The generated workflow did not pass validation.", details: validation.errors });
        return send(res, 200, { workflow: validation.workflow, requirements: payload.requirements || [], implementationSummary: payload.implementationSummary || "", manifest: payload.manifest || payload.configuration || buildManifest(validation.workflow, payload.requirements || []), validation: { warnings: validation.warnings } });
    }
    if (req.method === "POST" && url.pathname === "/api/generate/website") {
        if (!WEBSITE_GENERATOR_WEBHOOK_URL)
            return send(res, 503, { error: "Website generation is not connected yet. Set WEBSITE_GENERATOR_WEBHOOK_URL to your website-builder n8n webhook." });
        const body = await readBody(req);
        if (typeof body.prompt !== "string" || body.prompt.trim().length < 8 || body.prompt.length > 6000)
            return send(res, 400, { error: "Describe the website in 8–6,000 characters." });
        const payload = await callN8nWebhook(WEBSITE_GENERATOR_WEBHOOK_URL, {
            prompt: body.prompt.trim(),
            request_type: "website",
            source: "kontrolled",
        }, GENERATOR_WEBHOOK_SECRET);
        const html = typeof payload === "string" ? payload : payload?.html || payload?.index_html || payload?.website_html;
        if (typeof html !== "string" || !html.trim())
            return send(res, 422, { error: "Website generator response must contain an html field." });
        if (html.length > 2000000)
            return send(res, 422, { error: "Generated website is too large (2 MB limit)." });
        return send(res, 200, { html });
    }
    if (req.method === "POST" && url.pathname === "/api/connections/test") {
        const body = await readBody(req);
        const baseUrl = validateRemoteInstanceUrl(body.instanceUrl);
        const result = await testN8nConnection(baseUrl, body.apiKey);
        const id = crypto.randomUUID();
        connections.set(id, { baseUrl, apiKey: body.apiKey, createdAt: Date.now() });
        for (const [key, value] of connections)
            if (Date.now() - value.createdAt > 30 * 60 * 1000)
                connections.delete(key);
        return send(res, 200, { connectionId: id, ...result, note: "This development build keeps the connection in server memory for up to 30 minutes. It is not a multi-user production credential vault." });
    }
    if (req.method === "POST" && url.pathname === "/api/deploy/remote") {
        const body = await readBody(req);
        const connection = connections.get(body.connectionId);
        if (!connection || Date.now() - connection.createdAt > 30 * 60 * 1000)
            return send(res, 401, { error: "Connection expired. Connect your n8n instance again." });
        const payload = toN8nCreatePayload(body.workflow);
        const created = await createN8nWorkflow(connection.baseUrl, connection.apiKey, payload);
        return send(res, 201, { deployed: true, workflowId: created.id || created.data?.id || null, workflowName: created.name || payload.name, active: false, message: "Workflow created in your n8n instance. Review it and activate it inside n8n when ready." });
    }
    return send(res, 404, { error: "API route not found." });
}
async function serveStatic(req, res, url) {
    let requested;
    try {
        requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    }
    catch {
        res.writeHead(400);
        return res.end("Bad request");
    }
    const filePath = normalize(join(PUBLIC, "." + requested));
    const relativePath = relative(PUBLIC, filePath);

    // Cross-platform traversal protection: path separators differ on Windows/Linux.
    if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
        res.writeHead(403);
        return res.end("Forbidden");
    }
    try {
        const data = await readFile(filePath);
        res.writeHead(200, { "Content-Type": mime[extname(filePath)] || "application/octet-stream", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http://127.0.0.1:4317 http://localhost:4317; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" });
        res.end(data);
    }
    catch {
        res.writeHead(404);
        res.end("Not found");
    }
}
const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        if (url.pathname.startsWith("/api/"))
            await handleApi(req, res, url);
        else if (req.method === "GET" || req.method === "HEAD")
            await serveStatic(req, res, url);
        else
            send(res, 405, { error: "Method not allowed." });
    }
    catch (error) {
        if (!res.headersSent) {
            const message = safeError(error);
            const upstreamFailure = /n8n returned|could not reach|took longer|non-JSON response/i.test(message);
            send(res, upstreamFailure ? 502 : 400, { error: message });
        }
    }
});
server.listen(PORT, process.env.HOST || "127.0.0.1", () => console.log(`Kontrolled server listening on ${process.env.HOST || "127.0.0.1"}:${PORT}`));
