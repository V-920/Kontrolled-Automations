import net from "node:net";
import { lookup } from "node:dns/promises";
function isPrivateIPv4(host) {
    const p = host.split(".").map(Number);
    if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255))
        return false;
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
        (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
        (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}
function isPrivateAddress(address) {
    const family = net.isIP(address);
    if (family === 4)
        return isPrivateIPv4(address) || address.startsWith("192.0.0.") || address.startsWith("198.18.") || address.startsWith("198.19.") || address.startsWith("203.0.113.") || address.startsWith("192.0.2.") || address.startsWith("198.51.100.") || address.startsWith("255.");
    if (family === 6) {
        const value = address.toLowerCase();
        return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:") || value.startsWith("ff") || value.startsWith("2001:db8:");
    }
    return true;
}
async function assertPublicDns(baseUrl) {
    const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host)) {
        if (isPrivateAddress(host))
            throw new Error("Remote n8n URL must resolve to a public address.");
        return;
    }
    const records = await lookup(host, { all: true, verbatim: true });
    if (!records.length || records.some(record => isPrivateAddress(record.address)))
        throw new Error("Remote n8n hostname resolves to a private or reserved network address, which is not allowed.");
}
export function validateRemoteInstanceUrl(value) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new Error("Enter a valid n8n instance URL.");
    }
    if (url.protocol !== "https:")
        throw new Error("Remote n8n connections must use HTTPS.");
    if (url.username || url.password)
        throw new Error("Do not put credentials in the instance URL.");
    if (url.search || url.hash)
        throw new Error("The instance URL must not contain a query string or fragment.");
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
        throw new Error("Local and private hostnames cannot be used for remote connections.");
    }
    if (net.isIP(host) === 4 && (isPrivateIPv4(host) || host.startsWith("192.0.0."))) {
        throw new Error("Private IP addresses cannot be used for remote connections.");
    }
    if (net.isIP(host) === 6 && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:"))) {
        throw new Error("Private IPv6 addresses cannot be used for remote connections.");
    }
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
}
export function validateLocalInstanceUrl(value) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new Error("Enter a valid local n8n URL.");
    }
    const allowedHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
    if (!allowedHosts.has(url.hostname) || !["http:", "https:"].includes(url.protocol)) {
        throw new Error("The companion only accepts n8n running on this computer (localhost).");
    }
    if (url.port && url.port !== "5678")
        throw new Error("The default local n8n port is 5678 in this setup.");
    return url.toString().replace(/\/$/, "");
}
async function n8nRequest(baseUrl, apiKey, path, options = {}) {
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
        ...options,
        redirect: "manual",
        headers: {
            "X-N8N-API-KEY": apiKey,
            "Accept": "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        },
        signal: AbortSignal.timeout(12000)
    });
    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    }
    catch {
        data = { message: text.slice(0, 300) };
    }
    if (response.status >= 300 && response.status < 400)
        throw new Error("n8n redirected the API request. Check the instance URL and reverse-proxy configuration.");
    if (!response.ok) {
        const detail = data.message || data.error || `HTTP ${response.status}`;
        throw new Error(`n8n API error: ${String(detail).slice(0, 240)}`);
    }
    return data;
}
export async function testN8nConnection(baseUrl, apiKey) {
    await assertPublicDns(baseUrl);
    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 12 || apiKey.length > 500)
        throw new Error("Enter a valid n8n API key.");
    const result = await n8nRequest(baseUrl, apiKey, "/workflows?limit=1");
    return { connected: true, workflowCountReturned: Array.isArray(result.data) ? result.data.length : null };
}
export async function createN8nWorkflow(baseUrl, apiKey, workflowPayload) {
    return n8nRequest(baseUrl, apiKey, "/workflows", { method: "POST", body: JSON.stringify(workflowPayload) });
}
