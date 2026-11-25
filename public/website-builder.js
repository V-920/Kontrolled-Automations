(() => {
    const $ = id => document.getElementById(id), prompt = $('websitePrompt'), html = $('websiteHtml');
    const tokenInput = $('accessToken');
    if (tokenInput)
        tokenInput.value = sessionStorage.getItem('kontrolledAccessToken') || '';
    const year = $('year');
    if (year)
        year.textContent = new Date().getFullYear();
    const set = (id, msg, type = '') => { const e = $(id); e.textContent = msg; e.className = `status ${type}`.trim(); };
    prompt.addEventListener('input', () => $('promptCount').textContent = `${prompt.value.length} / 6000`);
    $('websiteExampleBtn').addEventListener('click', () => { prompt.value = 'Build a polished, responsive website for a neighborhood bakery called Morning & Crumb. Audience: local residents and people ordering celebration cakes. Include Home, Menu, Our Story, Custom Cakes and Contact sections. Add a clear order inquiry form, opening hours, location details, product cards and mobile navigation. Visual direction: warm cream background, deep espresso text, muted sage accents, editorial typography and high-quality bakery photography. Make it accessible and mobile-first.'; prompt.dispatchEvent(new Event('input')); prompt.focus(); });
    function getToken() { const t = (tokenInput?.value || sessionStorage.getItem('kontrolledAccessToken') || '').trim(); if (t)
        sessionStorage.setItem('kontrolledAccessToken', t); return t; }
    $('generateWebsiteBtn').addEventListener('click', async () => { if (prompt.value.trim().length < 8) {
        set('websiteStatus', 'Describe the website in a little more detail.', 'error');
        prompt.focus();
        return;
    } const token = getToken(); if (!token) {
        set('websiteStatus', 'Open Developer access settings and enter your backend access token.', 'error');
        return;
    } const btn = $('generateWebsiteBtn'); btn.disabled = true; btn.textContent = 'Generating…'; $('websiteResult').classList.add('hidden'); set('websiteStatus', 'Sending your brief to the website-generation workflow…', 'info'); try {
        const res = await fetch('/api/generate/website', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kontrolled-Token': token }, body: JSON.stringify({ prompt: prompt.value.trim() }) });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || `Generation failed (${res.status}).`);
        const generated = data.html || data.index_html || data.website_html;
        if (typeof generated !== 'string' || !generated.trim())
            throw new Error('The generator did not return HTML. Expected an html field.');
        html.value = generated;
        $('downloadWebsiteBtn').disabled = false;
        $('websiteResult').classList.remove('hidden');
        $('websiteResult').innerHTML = '<h3>Website generated</h3><p>Your HTML is ready. Preview it in the sandbox below or download it as index.html.</p>';
        set('websiteStatus', 'Generation completed. Review the output before publishing.', 'success');
    }
    catch (e) {
        set('websiteStatus', e.message, 'error');
    }
    finally {
        btn.disabled = false;
        btn.textContent = 'Generate website ↗';
    } });
    $('previewWebsiteBtn').addEventListener('click', () => { if (!html.value.trim()) {
        set('previewStatus', 'Generate or paste HTML before previewing.', 'error');
        return;
    } const frame = $('websitePreview'); frame.srcdoc = html.value; $('previewWrap').classList.remove('hidden'); set('previewStatus', 'Preview loaded in a restricted sandbox.', 'success'); });
    $('closePreviewBtn').addEventListener('click', () => $('previewWrap').classList.add('hidden'));
    $('downloadWebsiteBtn').addEventListener('click', () => { if (!html.value.trim())
        return; const url = URL.createObjectURL(new Blob([html.value], { type: 'text/html;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'index.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); });
})();
