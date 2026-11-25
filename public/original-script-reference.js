/* Original Kontrolled particle-and-constellation background */
(() => {
    const canvas = document.getElementById("universe");
    if (!canvas)
        return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx)
        return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: -1000, y: -1000, active: false };
    let width = 0, height = 0, dpr = 1, particles = [], frame = 0;
    const GOLD = "227,184,92";
    function makeParticles() {
        const count = Math.max(65, Math.min(150, Math.round((width * height) / 10500)));
        particles = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.20,
            vy: (Math.random() - 0.5) * 0.20,
            r: 0.7 + Math.random() * 1.35,
            phase: Math.random() * Math.PI * 2,
            twinkle: 0.35 + Math.random() * 0.65
        }));
    }
    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        makeParticles();
        if (reducedMotion)
            draw();
    }
    function draw() {
        ctx.clearRect(0, 0, width, height);
        const glow = ctx.createRadialGradient(width * 0.5, height * 0.43, 0, width * 0.5, height * 0.43, Math.max(width, height) * 0.72);
        glow.addColorStop(0, "rgba(227,184,92,0.045)");
        glow.addColorStop(1, "rgba(227,184,92,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (!reducedMotion) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < -8)
                    p.x = width + 8;
                if (p.x > width + 8)
                    p.x = -8;
                if (p.y < -8)
                    p.y = height + 8;
                if (p.y > height + 8)
                    p.y = -8;
            }
            if (pointer.active && !reducedMotion) {
                const dx = pointer.x - p.x, dy = pointer.y - p.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 150 && dist > 0) {
                    p.x -= (dx / dist) * (150 - dist) * 0.0018;
                    p.y -= (dy / dist) * (150 - dist) * 0.0018;
                }
            }
            const pulse = reducedMotion ? 0.72 : 0.52 + Math.sin(frame * 0.018 + p.phase) * 0.22;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${GOLD},${Math.max(0.25, pulse * p.twinkle)})`;
            ctx.shadowBlur = 9;
            ctx.shadowColor = `rgba(${GOLD},0.65)`;
            ctx.fill();
            ctx.shadowBlur = 0;
            for (let j = i + 1; j < particles.length; j++) {
                const q = particles[j];
                const dx = p.x - q.x, dy = p.y - q.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 118) {
                    const alpha = (1 - dist / 118) * 0.19;
                    ctx.strokeStyle = `rgba(${GOLD},${alpha})`;
                    ctx.lineWidth = 0.65;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(q.x, q.y);
                    ctx.stroke();
                }
            }
        }
        frame++;
    }
    function animate() {
        draw();
        if (!reducedMotion)
            requestAnimationFrame(animate);
    }
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
    }, { passive: true });
    window.addEventListener("pointerleave", () => { pointer.active = false; });
    resize();
    animate();
})();
/* Kontrolled split-page generator logic.
   Each generator page sets window.KONTROLLED_WEBHOOK_URL in its own HTML file. */
(() => {
    const year = document.getElementById("year");
    if (year)
        year.textContent = new Date().getFullYear();
    const pageType = document.body.dataset.generatorType;
    if (!pageType)
        return;
    const prompt = document.getElementById("projectPrompt");
    const button = document.getElementById("generateBtn");
    const status = document.getElementById("status");
    const results = document.getElementById("results");
    const download = document.getElementById("downloadLink");
    if (!prompt || !button || !status || !results || !download)
        return;
    const webhookUrl = window.KONTROLLED_WEBHOOK_URL || "";
    let currentDownloadUrl = null;
    function saveFile(content, filename, mimeType) {
        if (currentDownloadUrl)
            URL.revokeObjectURL(currentDownloadUrl);
        const blob = new Blob([content], { type: mimeType });
        currentDownloadUrl = URL.createObjectURL(blob);
        download.href = currentDownloadUrl;
        download.download = filename;
        download.textContent = "↓ Download " + filename;
        download.click();
    }
    function unwrapPayload(payload) {
        if (Array.isArray(payload))
            payload = payload[0] || {};
        if (payload && typeof payload === "object" && payload.data !== undefined) {
            payload = payload.data;
            if (Array.isArray(payload))
                payload = payload[0] || {};
        }
        return payload;
    }
    button.addEventListener("click", async () => {
        const brief = prompt.value.trim();
        results.classList.remove("show");
        if (!brief) {
            status.textContent = "Please describe what you want to generate first.";
            prompt.focus();
            return;
        }
        if (!webhookUrl || webhookUrl.includes("PASTE_")) {
            status.textContent = "Setup needed: add this page's webhook URL in its HTML file before generating.";
            return;
        }
        button.disabled = true;
        button.textContent = "Generating…";
        status.textContent = "Sending your brief to the Kontrolled generator…";
        try {
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: brief,
                    request_type: pageType,
                    source: "kontrolled"
                })
            });
            const raw = await response.text();
            if (!response.ok) {
                throw new Error(`Webhook returned ${response.status}: ${raw.slice(0, 240)}`);
            }
            let payload;
            try {
                payload = unwrapPayload(JSON.parse(raw));
            }
            catch (error) {
                throw new Error("The webhook response was not valid JSON.");
            }
            if (pageType === "website") {
                const generatedHtml = typeof payload === "string" ? payload :
                    payload && (payload.html || payload.index_html || payload.website_html);
                if (typeof generatedHtml !== "string" || !generatedHtml.trim()) {
                    throw new Error("Response is missing the generated HTML. Return it in an 'html' field.");
                }
                saveFile(generatedHtml, "index.html", "text/html;charset=utf-8");
            }
            else {
                let workflow = payload && (payload.workflow || payload.workflow_json || payload.json || payload);
                if (typeof workflow === "string") {
                    try {
                        workflow = JSON.parse(workflow);
                    }
                    catch {
                        throw new Error("The workflow response contains invalid JSON.");
                    }
                }
                if (!workflow || typeof workflow !== "object") {
                    throw new Error("Response is missing a valid workflow JSON object.");
                }
                saveFile(JSON.stringify(workflow, null, 2), "workflow.json", "application/json");
            }
            results.classList.add("show");
            status.textContent = "Generation complete. Your file download has started.";
            results.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        catch (error) {
            status.textContent = "Generation failed: " + error.message +
                " Check the webhook URL, response format and n8n CORS settings.";
        }
        finally {
            button.disabled = false;
            button.textContent = "Generate ↗";
        }
    });
})();
