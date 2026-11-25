import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = join(HERE, "..", ".env");
if (existsSync(ENV)) {
    for (const line of readFileSync(ENV, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m || m[1] in process.env)
            continue;
        process.env[m[1]] = m[2].replace(/^['\"]|['\"]$/g, "");
    }
}
import crypto from "node:crypto";
import { validateLocalInstanceUrl, testN8nConnection, createN8nWorkflow } from "../server/n8n-client.js";
import { toN8nCreatePayload } from "../server/workflow.js";
const PORT = Number(process.env.COMPANION_PORT || 4317);
const TOKEN = process.env.COMPANION_TOKEN || "";
const N8N_URL = process.env.LOCAL_N8N_URL || "http://127.0.0.1:5678";
const API_KEY = process.env.LOCAL_N8N_API_KEY || "";
const ALLOWED_ORIGINS = new Set(["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3001", "http://127.0.0.1:3001"]);
function reply(res, status, data) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": res.allowedOrigin || "null", "Vary": "Origin", "Access-Control-Allow-Headers": "Content-Type, X-Companion-Token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(data)); }
function same(a, b) { if (!a || !b)
    return false; const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function body(req) { return new Promise((resolve, reject) => { let raw = ""; req.on("data", c => { raw += c; if (raw.length > 1500000)
    reject(new Error("Request too large.")); }); req.on("end", () => { try {
    resolve(raw ? JSON.parse(raw) : {});
}
catch {
    reject(new Error("Invalid JSON."));
} }); req.on("error", reject); }); }
const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin))
        return reply(res, 403, { error: "Origin is not allowed." });
    res.allowedOrigin = origin;
    if (req.method === "OPTIONS")
        return reply(res, 204, {});
    try {
        const url = new URL(req.url, "http://127.0.0.1");
        if (req.method === "GET" && url.pathname === "/health")
            return reply(res, 200, { ok: true, service: "kontrolled-local-companion", n8nConfigured: !!API_KEY });
        if (!TOKEN || !same(req.headers["x-companion-token"], TOKEN))
            return reply(res, 401, { error: "Companion token missing or incorrect." });
        if (req.method === "POST" && url.pathname === "/connect") {
            if (!API_KEY)
                return reply(res, 503, { error: "Set LOCAL_N8N_API_KEY in your local .env file first." });
            const localUrl = validateLocalInstanceUrl(N8N_URL);
            const result = await testN8nConnection(localUrl, API_KEY);
            return reply(res, 200, { connected: true, ...result, message: "Your local n8n instance is reachable." });
        }
        if (req.method === "POST" && url.pathname === "/deploy") {
            if (!API_KEY)
                return reply(res, 503, { error: "Set LOCAL_N8N_API_KEY in your local .env file first." });
            const input = await body(req);
            const workflow = toN8nCreatePayload(input.workflow);
            const created = await createN8nWorkflow(validateLocalInstanceUrl(N8N_URL), API_KEY, workflow);
            return reply(res, 201, { deployed: true, workflowId: created.id || created.data?.id || null, workflowName: created.name || workflow.name, active: false, message: "Workflow installed locally. Review it and activate it in n8n when ready." });
        }
        return reply(res, 404, { error: "Companion route not found." });
    }
    catch (error) {
        return reply(res, 400, { error: String(error.message || "Unexpected error").slice(0, 300) });
    }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Kontrolled Companion listening at http://127.0.0.1:${PORT}`));
