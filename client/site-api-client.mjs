import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

/** Разрешённые базовые URL — только локальный backend сайта */
const ALLOWED_BASE_URLS = new Set([
  'http://127.0.0.1:3001',
  'http://localhost:3001',
]);

/** Фиксированные операции — никаких произвольных path/method */
const OPERATIONS = {
  health: { method: 'GET', path: '/api/agent/health', needsUser: false },
  summary: { method: 'GET', path: '/api/agent/summary', needsUser: true },
  projects: { method: 'GET', path: '/api/agent/projects', needsUser: true },
  project_overview: { method: 'GET', path: '/api/agent/projects/{id}/overview', needsUser: true },
};

function normalizeBaseUrl(raw) {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  if (!ALLOWED_BASE_URLS.has(trimmed)) {
    throw new Error(
      `SITE_API_BASE_URL не разрешён: ${trimmed || '(пусто)'}. Допустимо: ${[...ALLOWED_BASE_URLS].join(', ')}`,
    );
  }
  return trimmed;
}

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  try {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env optional if vars set in shell
  }
}

export function getClientConfig() {
  loadEnvFile();
  const baseUrl = normalizeBaseUrl(process.env.SITE_API_BASE_URL || 'http://127.0.0.1:3001');
  const token = String(process.env.AGENT_API_TOKEN || '').trim();
  if (!token) {
    throw new Error('AGENT_API_TOKEN не задан. Скопируйте .env.example → .env');
  }
  return { baseUrl, token };
}

export function loadTelegramUsers(configPath = path.join(ROOT, 'config', 'telegram-users.json')) {
  const raw = readFileSync(configPath, 'utf8');
  const data = JSON.parse(raw);
  const users = data.users || data;
  return users;
}

export function resolveSiteUser(telegramUserId, users = null) {
  const map = users ?? loadTelegramUsers();
  const key = String(telegramUserId);
  const entry = map[key];
  if (!entry?.site_user_id) return null;
  return {
    site_user_id: Number(entry.site_user_id),
    username: entry.username || null,
    display_name: entry.display_name || entry.username || `user#${entry.site_user_id}`,
  };
}

function buildPath(operation, params = {}) {
  const spec = OPERATIONS[operation];
  if (!spec) throw new Error(`Неизвестная операция: ${operation}`);
  let urlPath = spec.path;
  if (urlPath.includes('{id}')) {
    const id = params.projectId ?? params.id;
    if (id == null || id === '') throw new Error('Для project_overview нужен projectId');
    urlPath = urlPath.replace('{id}', encodeURIComponent(String(id)));
  }
  return urlPath;
}

/**
 * Read-only вызов API сайта. Только GET, только 4 операции.
 */
export async function callSiteApi(operation, { siteUserId = null, projectId = null } = {}) {
  const spec = OPERATIONS[operation];
  if (!spec) throw new Error(`Неизвестная операция: ${operation}`);
  if (spec.method !== 'GET') throw new Error('Разрешён только GET');

  const { baseUrl, token } = getClientConfig();
  if (spec.needsUser) {
    if (!siteUserId) throw new Error(`Операция ${operation} требует site_user_id`);
  }

  const urlPath = buildPath(operation, { projectId });
  const url = `${baseUrl}${urlPath}`;

  const headers = {
    Accept: 'application/json',
    'X-Agent-Token': token,
  };
  if (spec.needsUser) {
    headers['X-Act-As-User'] = String(siteUserId);
  }

  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(body?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

/** Для тестов: сравнение токенов без timing leak */
export function tokensEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export { ALLOWED_BASE_URLS, OPERATIONS };
