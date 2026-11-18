(() => {
  const canvas = document.getElementById("universe");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

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
    if (reducedMotion) draw();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Very subtle central illumination keeps the black-and-gold palette restrained.
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
        if (p.x < -8) p.x = width + 8;
        if (p.x > width + 8) p.x = -8;
        if (p.y < -8) p.y = height + 8;
        if (p.y > height + 8) p.y = -8;
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
    if (!reducedMotion) requestAnimationFrame(animate);
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

/*
  SETUP: Paste your n8n Production Webhook URL below.
  The webhook should accept POST JSON and respond with:
  {
    "html": "<!doctype html>...complete generated website...",
    "workflow": { ...valid n8n workflow JSON... }
  }
  It may also respond with { "data": { "html": "...", "workflow": {...} } }.
*/
const N8N_WEBHOOK_URL = "PASTE_YOUR_N8N_WEBHOOK_URL_HERE";

const $ = (id) => document.getElementById(id);
function downloadBlob(content, filename, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
$("generateBtn").addEventListener("click", async () => {
  const website = $("websitePrompt").value.trim();
  const workflow = $("workflowPrompt").value.trim();
  const status = $("status"), button = $("generateBtn"), results = $("results");
  results.classList.remove("show");
  if (!website || !workflow) {
    status.textContent = "Please complete both prompts so the website and workflow can be designed together.";
    (!website ? $("websitePrompt") : $("workflowPrompt")).focus();
    return;
  }
  if (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL.startsWith("PASTE_")) {
    status.textContent = "Setup needed: add your n8n Production Webhook URL in the N8N_WEBHOOK_URL setting near the top of script.js.";
    return;
  }
  button.disabled = true; button.textContent = "Generating your project…";
  status.textContent = "Sending both briefs to n8n. This may take a little while…";
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        website_prompt: website,
        workflow_prompt: workflow,
        request_type: "connected_website_and_workflow",
        source: "kontrolled"
      })
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`n8n returned ${response.status}: ${raw.slice(0,250)}`);
    let payload;
    try { payload = JSON.parse(raw); } catch { throw new Error("The webhook response was not valid JSON."); }
    payload = payload.data || payload;
    const html = payload.html || payload.index_html || payload.website_html;
    const workflowJson = payload.workflow || payload.workflow_json;
    if (typeof html !== "string" || !html.trim()) throw new Error("Response is missing the generated HTML. Return it in the 'html' field.");
    if (!workflowJson || (typeof workflowJson !== "object" && typeof workflowJson !== "string")) throw new Error("Response is missing the n8n workflow JSON in the 'workflow' field.");
    let workflowText;
    if (typeof workflowJson === "string") {
      try { workflowText = JSON.stringify(JSON.parse(workflowJson), null, 2); }
      catch { throw new Error("The 'workflow' field contains a string that is not valid JSON."); }
    } else workflowText = JSON.stringify(workflowJson, null, 2);
    $("htmlDownload").href = URL.createObjectURL(new Blob([html], {type:"text/html"}));
    $("jsonDownload").href = URL.createObjectURL(new Blob([workflowText], {type:"application/json"}));
    $("results").classList.add("show");
    status.textContent = "Generation complete. Both connected project files are ready to download.";
    results.scrollIntoView({behavior:"smooth", block:"nearest"});
  } catch (err) {
    status.textContent = "Could not complete generation: " + err.message + " Check the webhook URL, response format and n8n CORS settings.";
  } finally {
    button.disabled = false; button.textContent = "Generate connected project ↗";
  }
});
$("year").textContent = new Date().getFullYear();
