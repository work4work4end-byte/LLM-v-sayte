#!/usr/bin/env node
/**
 * Сливает переменные из .env репозитория и config.yaml Hermes в ~/.hermes/.env
 * (не затирает существующие ключи, кроме SITE_API_BASE_URL и AGENT_API_TOKEN)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const HERMES_ENV = path.join(os.homedir(), '.hermes', '.env');
const HERMES_CONFIG = path.join(os.homedir(), '.hermes', 'config.yaml');
const REPO_ENV = path.join(ROOT, '.env');

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function sanitizeEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return line;
  let body = trimmed;
  if (body.startsWith('export ')) body = body.slice(7).trim();
  if (/^echo\s+/i.test(body)) return null;
  if (!body.includes('=')) return null;
  const eq = body.indexOf('=');
  const key = body.slice(0, eq).trim();
  const value = body.slice(eq + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  return `${key}=${escapeEnvValue(value.replace(/^["']|["']$/g, ''))}`;
}

function sanitizeEnvText(text) {
  return text
    .split(/\r?\n/)
    .map((line) => sanitizeEnvLine(line))
    .filter((line) => line != null)
    .join('\n');
}

function escapeEnvValue(value) {
  const v = String(value);
  if (/[\s#"'\\=]/.test(v) || v.startsWith('export ')) {
    return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return v;
}

function serializeEnv(map, previousText = '') {
  const prevLines = previousText ? previousText.split(/\r?\n/) : [];
  const out = [];
  const seen = new Set();

  for (const line of prevLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    if (!trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      out.push(`${key}=${escapeEnvValue(map[key])}`);
      seen.add(key);
    } else {
      out.push(line);
    }
  }

  for (const [key, value] of Object.entries(map)) {
    if (!seen.has(key)) out.push(`${key}=${escapeEnvValue(value)}`);
  }

  return out.join('\n').replace(/\n+$/, '') + '\n';
}

function readYamlBotToken(text) {
  const m = text.match(/^\s*bot_token:\s*["']?([^"'\n#]+)["']?\s*$/m);
  return m ? m[1].trim() : null;
}

function loadRepoEnv() {
  if (!existsSync(REPO_ENV)) return {};
  return parseEnv(readFileSync(REPO_ENV, 'utf8'));
}

function loadHermesEnv() {
  if (!existsSync(HERMES_ENV)) return {};
  return parseEnv(readFileSync(HERMES_ENV, 'utf8'));
}

function main() {
  const repo = loadRepoEnv();
  const current = loadHermesEnv();
  const merged = { ...current };

  const keysFromRepo = ['SITE_API_BASE_URL', 'AGENT_API_TOKEN', 'OLLAMA_API_KEY'];
  for (const key of keysFromRepo) {
    if (repo[key]) merged[key] = repo[key];
  }

  if (!merged.TELEGRAM_BOT_TOKEN && existsSync(HERMES_CONFIG)) {
    const token = readYamlBotToken(readFileSync(HERMES_CONFIG, 'utf8'));
    if (token) merged.TELEGRAM_BOT_TOKEN = token;
  }

  if (!merged.TELEGRAM_ALLOWED_USERS) {
    merged.TELEGRAM_ALLOWED_USERS = '458969653,8314552142';
  }

  const order = [
    'SITE_API_BASE_URL',
    'AGENT_API_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_ALLOWED_USERS',
    'TELEGRAM_PROXY',
    'OLLAMA_API_KEY',
  ];
  const lines = [];
  const used = new Set();
  for (const key of order) {
    if (merged[key]) {
      lines.push(`${key}=${escapeEnvValue(merged[key])}`);
      used.add(key);
    }
  }
  for (const [key, value] of Object.entries(merged)) {
    if (used.has(key) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    lines.push(`${key}=${escapeEnvValue(value)}`);
  }

  writeFileSync(HERMES_ENV, `${lines.join('\n')}\n`, 'utf8');

  const status = {
    path: HERMES_ENV,
    SITE_API_BASE_URL: merged.SITE_API_BASE_URL || '(missing)',
    AGENT_API_TOKEN: merged.AGENT_API_TOKEN ? 'set' : 'missing',
    TELEGRAM_BOT_TOKEN: merged.TELEGRAM_BOT_TOKEN ? 'set' : 'missing',
    TELEGRAM_ALLOWED_USERS: merged.TELEGRAM_ALLOWED_USERS || '(missing)',
    OLLAMA_API_KEY: merged.OLLAMA_API_KEY ? 'set' : 'missing',
  };
  console.log(JSON.stringify(status, null, 2));
}

main();
