(() => {
    const $ = id => document.getElementById(id);
    const prompt = $('prompt'), workflowBox = $('workflowJson'), generateBtn = $('generateBtn');
    let workflow = null, manifest = null, remoteConnectionId = null, localConnected = false;
    const tokenInput = $('accessToken');
    if (tokenInput)
        tokenInput.value = sessionStorage.getItem('kontrolledAccessToken') || '';
    const year = $('year');
    if (year)
        year.textContent = new Date().getFullYear();
    const count = () => { $('promptCount').textContent = `${prompt.value.length} / 6000`; };
    prompt.addEventListener('input', count);
    count();
    const setStatus = (id, message, type = '') => { const el = $(id); el.textContent = message; el.className = `status ${type}`.trim(); };
    const token = () => { const value = (tokenInput?.value || sessionStorage.getItem('kontrolledAccessToken') || '').trim(); if (value)
        sessionStorage.setItem('kontrolledAccessToken', value); return value; };
    async function api(path, body = {}) {
        const t = token();
        if (!t)
            throw new Error('Open Developer access settings and enter your backend access token first.');
        const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kontrolled-Token': t }, body: JSON.stringify(body) });
        const data = await response.json().catch(() => ({ error: 'The server returned an unreadable response.' }));
        if (!response.ok)
            throw new Error(data.error || `Request failed (${response.status}).`);
        return data;
    }
    function parseWorkflow(value) { if (typeof value === 'string')
        value = JSON.parse(value); if (value?.workflow)
        value = value.workflow; if (!value || !Array.isArray(value.nodes) || !value.connections)
        throw new Error('The response does not contain a complete n8n workflow.'); return value; }
    function renderSummary(data) {
        const el = $('generationResult');
        el.classList.remove('hidden');
        const reqs = data.requirements || [];
        const warns = data.validation?.warnings || [];
        el.innerHTML = `<h3>Workflow generated</h3><p>${escapeHtml(data.workflow.name || 'Untitled workflow')} · ${data.workflow.nodes.length} nodes · ${reqs.length} requirement checks</p><p>${escapeHtml(data.implementationSummary || 'The factory returned a workflow. Review it before deployment.')}</p>${reqs.length ? `<div>${reqs.map(r => `<span class="tag">${escapeHtml(r.description || r.id || 'Requirement')}</span>`).join('')}</div>` : ''}${warns.length ? `<p class="warn">${warns.map(escapeHtml).join('<br>')}</p>` : ''}<p class="microcopy">The factory's structural and requirement checks are not a guarantee that every third-party integration is configured or that the workflow is safe to activate.</p>`;
        const panel = $('configurationPanel'), m = manifest || {};
        panel.classList.remove('hidden');
        const creds = m.required_credentials || [], apps = m.integrations || [], triggers = m.trigger_requirements || [], userInputs = m.user_inputs || [];
        panel.innerHTML = `<h3>Setup checklist</h3><p>Kontrolled found these setup requirements in the generated workflow. Credentials are managed inside your destination n8n instance.</p><div><strong>Apps / node integrations</strong><p>${apps.length ? apps.map(x => `<span class="tag">${escapeHtml(x)}</span>`).join('') : '<span class="microcopy">No additional app integrations were identified automatically.</span>'}</p></div><div><strong>Credentials to configure in n8n</strong>${creds.length ? `<ul>${creds.map(c => `<li>${escapeHtml(c.node)} — ${escapeHtml((c.types || []).join(', '))}</li>`).join('')}</ul>` : '<p class="microcopy">No explicit credential references were found. Some nodes may still require authentication.</p>'}</div><div><strong>Trigger nodes</strong><p>${triggers.length ? triggers.map(escapeHtml).join(', ') : 'Review how this workflow starts in n8n.'}</p></div>${userInputs.length ? `<div><strong>Additional setup</strong><ul>${userInputs.map(x => `<li>${escapeHtml(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul></div>` : ''}<label style="display:flex;align-items:flex-start;gap:9px;margin-top:14px;color:#d2c7af;font-size:11px;letter-spacing:0"><input id="reviewConfirmed" type="checkbox" style="margin-top:2px"> I have reviewed this workflow and understand that required app credentials must be configured inside n8n before testing or activation.</label>`;
    }
    function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    $('exampleBtn').addEventListener('click', () => { prompt.value = 'When a new lead submits my website contact form, validate that their name and email are present, add the lead to a Google Sheets spreadsheet, send me an email notification, and send the lead a confirmation email. If a step fails, record the error and notify me.'; count(); prompt.focus(); });
    generateBtn.addEventListener('click', async () => { if (prompt.value.trim().length < 8) {
        setStatus('generateStatus', 'Describe the automation in a little more detail.', 'error');
        prompt.focus();
        return;
    } generateBtn.disabled = true; generateBtn.textContent = 'Generating…'; setStatus('generateStatus', 'Sending your brief to the n8n AI Workflow Factory. This can take up to 90 seconds.', 'info'); $('generationResult').classList.add('hidden'); try {
        const data = await api('/api/generate', { prompt: prompt.value.trim() });
        workflow = parseWorkflow(data.workflow || data);
        manifest = data.manifest || {};
        workflowBox.value = JSON.stringify(workflow, null, 2);
        $('downloadBtn').disabled = false;
        renderSummary({ ...data, workflow });
        setStatus('generateStatus', 'Generation and factory validation completed. Review the workflow below.', 'success');
        await validateCurrent(false);
    }
    catch (e) {
        setStatus('generateStatus', e.message, 'error');
    }
    finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate workflow ↗';
    } });
    $('validateBtn').addEventListener('click', () => validateCurrent(true));
    async function validateCurrent(show) { try {
        workflow = parseWorkflow(workflowBox.value);
        const data = await api('/api/workflows/validate', { workflow });
        if (!data.valid)
            throw new Error((data.errors || ['Workflow validation failed.']).join('\n'));
        workflow = data.workflow || workflow;
        $('downloadBtn').disabled = false;
        $('workflowSummary').classList.remove('hidden');
        $('workflowSummary').innerHTML = `<strong class="good">✓ Structure looks valid</strong><p>${escapeHtml(data.summary?.name || workflow.name)} · ${data.summary?.nodes ?? workflow.nodes.length} nodes</p>${(data.warnings || []).length ? `<p class="warn">${data.warnings.map(escapeHtml).join('<br>')}</p>` : '<p>No structural warnings were reported.</p>'}<p>Validation checks JSON structure and references. It does not execute the workflow or verify external credentials.</p>`;
        setStatus('validationStatus', 'Workflow structure validated.', 'success');
        return true;
    }
    catch (e) {
        $('workflowSummary').classList.remove('hidden');
        $('workflowSummary').innerHTML = `<strong style="color:var(--red)">Validation needs attention</strong><p>${escapeHtml(e.message).replace(/\n/g, '<br>')}</p>`;
        setStatus('validationStatus', e.message, 'error');
        if (show)
            workflow = null;
        return false;
    } }
    $('workflowFile').addEventListener('change', async (e) => { const file = e.target.files?.[0]; if (!file)
        return; try {
        workflowBox.value = await file.text();
        workflow = parseWorkflow(workflowBox.value);
        $('downloadBtn').disabled = false;
        setStatus('validationStatus', `Loaded ${file.name}. Validate it before deployment.`, 'info');
    }
    catch (err) {
        setStatus('validationStatus', err.message, 'error');
    } e.target.value = ''; });
    $('downloadBtn').addEventListener('click', () => { try {
        const w = parseWorkflow(workflowBox.value);
        download(JSON.stringify(w, null, 2), 'workflow.json', 'application/json');
    }
    catch (e) {
        setStatus('validationStatus', e.message, 'error');
    } });
    function download(content, name, type) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
    async function getValidatedWorkflow() { const ok = await validateCurrent(true); if (!ok)
        throw new Error('Fix workflow validation issues before deployment.'); if (!$('reviewConfirmed')?.checked)
        throw new Error('Review the setup checklist and confirm before deploying.'); return workflow; }
    $('connectRemoteBtn').addEventListener('click', async () => { remoteConnectionId = null; $('deployRemoteBtn').disabled = true; setStatus('remoteStatus', 'Testing connection…', 'info'); try {
        const data = await api('/api/connections/test', { instanceUrl: $('instanceUrl').value.trim(), apiKey: $('apiKey').value });
        remoteConnectionId = data.connectionId;
        setStatus('remoteStatus', `Connected successfully. n8n API responded. ${data.note || ''}`, 'success');
        $('deployRemoteBtn').disabled = false;
    }
    catch (e) {
        setStatus('remoteStatus', e.message, 'error');
    } });
    $('deployRemoteBtn').addEventListener('click', async () => { try {
        const w = await getValidatedWorkflow();
        $('deployRemoteBtn').disabled = true;
        setStatus('remoteStatus', 'Installing workflow…', 'info');
        const data = await api('/api/deploy/remote', { connectionId: remoteConnectionId, workflow: w });
        setStatus('remoteStatus', `${data.message} Workflow ID: ${data.workflowId || 'created'}`, 'success');
    }
    catch (e) {
        setStatus('remoteStatus', e.message, 'error');
    }
    finally {
        $('deployRemoteBtn').disabled = !remoteConnectionId;
    } });
    $('connectLocalBtn').addEventListener('click', async () => { localConnected = false; $('deployLocalBtn').disabled = true; setStatus('localStatus', 'Checking the local companion…', 'info'); try {
        const base = $('companionUrl').value.trim().replace(/\/$/, '');
        const health = await fetch(`${base}/health`);
        if (!health.ok)
            throw new Error('Companion did not respond. Start the Kontrolled Companion first.');
        const response = await fetch(`${base}/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Companion-Token': $('companionToken').value }, body: '{}' });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error || 'Local connection failed.');
        localConnected = true;
        setStatus('localStatus', `Local n8n connected. ${data.message || ''}`, 'success');
        $('deployLocalBtn').disabled = false;
    }
    catch (e) {
        setStatus('localStatus', `${e.message} See the local setup guide if this is your first time.`, 'error');
    } });
    $('deployLocalBtn').addEventListener('click', async () => { try {
        const w = await getValidatedWorkflow();
        $('deployLocalBtn').disabled = true;
        setStatus('localStatus', 'Installing workflow locally…', 'info');
        const base = $('companionUrl').value.trim().replace(/\/$/, '');
        const response = await fetch(`${base}/deploy`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Companion-Token': $('companionToken').value }, body: JSON.stringify({ workflow: w }) });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error || 'Local deployment failed.');
        setStatus('localStatus', `${data.message} Workflow ID: ${data.workflowId || 'created'}`, 'success');
    }
    catch (e) {
        setStatus('localStatus', e.message, 'error');
    }
    finally {
        $('deployLocalBtn').disabled = !localConnected;
    } });
})();
