import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkflow, toN8nCreatePayload } from '../server/workflow.js';
const valid = {
    name: 'Lead capture',
    nodes: [
        { id: '1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], parameters: {} },
        { id: '2', name: 'Set lead fields', type: 'n8n-nodes-base.set', typeVersion: 3, position: [220, 0], parameters: {} }
    ],
    connections: { Webhook: { main: [[{ node: 'Set lead fields', type: 'main', index: 0 }]] } }
};
test('accepts a structurally valid workflow', () => {
    const result = validateWorkflow(valid);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});
test('rejects malformed JSON', () => {
    const result = validateWorkflow('{broken');
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /valid JSON/i);
});
test('rejects connections to missing nodes', () => {
    const result = validateWorkflow({ ...valid, connections: { Webhook: { main: [[{ node: 'Missing', type: 'main', index: 0 }]] } } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('missing node')));
});
test('rejects duplicate node names', () => {
    const result = validateWorkflow({ ...valid, nodes: [...valid.nodes, { ...valid.nodes[1], id: '3' }] });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Duplicate node name')));
});
test('creates an inactive-safe payload without imported IDs or active state', () => {
    const payload = toN8nCreatePayload({ ...valid, id: 'old-id', active: true, versionId: 'old-version' });
    assert.equal(payload.id, undefined);
    assert.equal(payload.active, undefined);
    assert.equal(payload.name, valid.name);
});
