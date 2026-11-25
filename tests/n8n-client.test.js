import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRemoteInstanceUrl, validateLocalInstanceUrl } from '../server/n8n-client.js';
test('requires HTTPS for remote n8n', () => {
    assert.throws(() => validateRemoteInstanceUrl('http://n8n.example.com'), /HTTPS/);
});
test('rejects localhost as a remote destination', () => {
    assert.throws(() => validateRemoteInstanceUrl('https://localhost:5678'), /private hostnames/);
});
test('accepts a valid HTTPS remote URL', () => {
    assert.equal(validateRemoteInstanceUrl('https://n8n.example.com/'), 'https://n8n.example.com');
});
test('local companion only accepts loopback n8n', () => {
    assert.equal(validateLocalInstanceUrl('http://127.0.0.1:5678'), 'http://127.0.0.1:5678');
    assert.throws(() => validateLocalInstanceUrl('http://192.168.1.10:5678'), /localhost/);
});
