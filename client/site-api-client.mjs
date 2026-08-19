import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { timingSafeEqual } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const LOCAL_BASE_URLS = new Set([
  'http://127.0.0.1:3001',
  'http://localhost:3001',
]);

/** Production VPS — только явно разрешённые хосты (не любой URL из интернета) */
const ALLOWED_REMOTE_HOSTS = new Set([
  '85.193.88.201',
]);

const ALLOWED_PORTS = new Set(['', '80', '3001']);

/** Фиксированные операции — никаких произвольных path/method */
const OPERATIONS = {
  health: { method: 'GET', path: '/api/agent/health', needsUser: false },
  summary: { method: 'GET', path: '/api/agent/summary', needsUser: true },
  projects: { method: 'GET', path: '/api/agent/projects', needsUser: true },
  folders: { method: 'GET', path: '/api/agent/folders', needsUser: true },
  folder_overview: { method: 'GET', path: '/api/agent/folders/{id}/overview', needsUser: true, idKey: 'folderId' },
  project_overview: { method: 'GET', path: '/api/agent/projects/{id}/overview', needsUser: true, idKey: 'projectId' },
  materials: { method: 'GET', path: '/api/agent/materials', needsUser: true, query: true },
  deliveries: { method: 'GET', path: '/api/agent/deliveries', needsUser: true, query: true },
  suppliers: { method: 'GET', path: '/api/agent/suppliers', needsUser: true, query: true },
  supplier_materials: { method: 'GET', path: '/api/agent/suppliers/{id}/materials', needsUser: true, idKey: 'supplierId', query: true },
  problems: { method: 'GET', path: '/api/agent/problems', needsUser: true, query: true },
};

function isWsl() {
  try {
    return readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

function wslWindowsHostIp() {
  try {
    return execSync("ip route show default | awk '{print $3}'", { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function isPrivateHost(hostname) {
  if (hostname === 'localhost') return true;
  const parts = hostname.split('.').map((p) => Number(p));
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
  }
  return false;
}

function isAllowedHost(hostname) {
  return isPrivateHost(hostname) || ALLOWED_REMOTE_HOSTS.has(hostname);
}

function resolveDefaultBaseUrl(raw) {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  if (trimmed && !LOCAL_BASE_URLS.has(trimmed)) {
    return trimmed;
  }
  if (isWsl()) {
    const gw = wslWindowsHostIp();
    if (gw) return `http://${gw}:3001`;
  }
  return trimmed || 'http://127.0.0.1:3001';
}

function formatBaseUrl(hostname, port) {
  const p = port || '';
  if (p === '80' || p === '') return `http://${hostname}`;
  return `http://${hostname}:${p}`;
}

function normalizeBaseUrl(raw) {
  const candidate = resolveDefaultBaseUrl(raw);
  let url;
  try {
    url = new URL(candidate.includes('://') ? candidate : `http://${candidate}`);
  } catch {
    throw new Error(`SITE_API_BASE_URL некорректен: ${candidate}`);
  }

  if (url.protocol !== 'http:') {
    throw new Error('SITE_API_BASE_URL должен использовать http');
  }
  const port = url.port || '80';
  if (!ALLOWED_PORTS.has(port)) {
    throw new Error('SITE_API_BASE_URL: допустимы порты 80 и 3001');
  }
  if (url.pathname && url.pathname !== '/') {
    throw new Error('SITE_API_BASE_URL не должен содержать path');
  }
  if (!isAllowedHost(url.hostname)) {
    throw new Error(
      `SITE_API_BASE_URL не разрешён: ${candidate}. Локальная сеть или ${[...ALLOWED_REMOTE_HOSTS].join(', ')}`,
    );
  }

  return formatBaseUrl(url.hostname, port);
}

function loadEnvFile() {
  const paths = [
    path.join(ROOT, '.env'),
    path.join(homedir(), '.hermes', '.env'),
  ];
  for (const envPath of paths) {
    if (!existsSync(envPath)) continue;
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
      // optional
    }
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
    const idKey = spec.idKey || 'projectId';
    const id = params[idKey] ?? params.projectId ?? params.id;
    if (id == null || id === '') throw new Error(`Для ${operation} нужен ${idKey}`);
    urlPath = urlPath.replace('{id}', encodeURIComponent(String(id)));
  }
  return urlPath;
}

function buildQueryString(query = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/**
 * Read-only вызов API сайта. Только GET, только фиксированные операции.
 */
export async function callSiteApi(operation, {
  siteUserId = null,
  projectId = null,
  supplierId = null,
  folderId = null,
  query = {},
} = {}) {
  const spec = OPERATIONS[operation];
  if (!spec) throw new Error(`Неизвестная операция: ${operation}`);
  if (spec.method !== 'GET') throw new Error('Разрешён только GET');

  const { baseUrl, token } = getClientConfig();
  if (spec.needsUser && !siteUserId) {
    throw new Error(`Операция ${operation} требует site_user_id`);
  }

  const urlPath = buildPath(operation, { projectId, supplierId, folderId });
  const url = `${baseUrl}${urlPath}${spec.query ? buildQueryString(query) : ''}`;

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

export { LOCAL_BASE_URLS as ALLOWED_BASE_URLS, ALLOWED_REMOTE_HOSTS, OPERATIONS, isWsl, isPrivateHost, isAllowedHost };
