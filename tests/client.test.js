import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_BASE_URLS,
  OPERATIONS,
  resolveSiteUser,
  tokensEqual,
  getClientConfig,
} from '../client/site-api-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

test('OPERATIONS — только GET', () => {
  for (const [name, spec] of Object.entries(OPERATIONS)) {
    assert.equal(spec.method, 'GET', `${name} must be GET`);
  }
});

test('resolveSiteUser — находит пользователя', () => {
  const users = {
    '111': { site_user_id: 3, username: 'manager1', display_name: 'Менеджер 1' },
  };
  const u = resolveSiteUser('111', users);
  assert.equal(u.site_user_id, 3);
  assert.equal(u.username, 'manager1');
});

test('resolveSiteUser — неизвестный Telegram ID', () => {
  assert.equal(resolveSiteUser('999', {}), null);
});

test('tokensEqual', () => {
  assert.equal(tokensEqual('abc', 'abc'), true);
  assert.equal(tokensEqual('abc', 'abd'), false);
  assert.equal(tokensEqual('abc', 'ab'), false);
});

test('getClientConfig — отклоняет неразрешённый URL', () => {
  process.env.SITE_API_BASE_URL = 'http://evil.example.com:3001';
  process.env.AGENT_API_TOKEN = 'test-token';
  assert.throws(() => getClientConfig(), /не разрешён/);
  delete process.env.SITE_API_BASE_URL;
  delete process.env.AGENT_API_TOKEN;
});

test('getClientConfig — принимает localhost', () => {
  process.env.SITE_API_BASE_URL = 'http://127.0.0.1:3001';
  process.env.AGENT_API_TOKEN = 'test-token';
  const cfg = getClientConfig();
  assert.equal(cfg.baseUrl, 'http://127.0.0.1:3001');
  delete process.env.SITE_API_BASE_URL;
  delete process.env.AGENT_API_TOKEN;
});

test('ALLOWED_BASE_URLS содержит localhost', () => {
  assert.ok(ALLOWED_BASE_URLS.has('http://127.0.0.1:3001'));
  assert.ok(ALLOWED_BASE_URLS.has('http://localhost:3001'));
});

test('integration: health — skip if API not ready', async (t) => {
  const token = process.env.AGENT_API_TOKEN;
  const base = process.env.SITE_API_BASE_URL || 'http://127.0.0.1:3001';
  if (!token) {
    t.skip('AGENT_API_TOKEN not set — skip integration');
    return;
  }
  process.env.SITE_API_BASE_URL = base;
  process.env.AGENT_API_TOKEN = token;
  const { callSiteApi } = await import('../client/site-api-client.mjs');
  try {
    const res = await callSiteApi('health');
    assert.ok(res);
  } catch (err) {
    if (err.status === 404 || err.message.includes('fetch failed')) {
      t.skip('Site agent API not implemented yet');
      return;
    }
    throw err;
  }
});
