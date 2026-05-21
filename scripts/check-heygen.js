import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
loadDotEnv(path.join(rootDir, '.env'));

const apiBase = String(process.env.HEYGEN_API_BASE || 'https://api.heygen.com').replace(/\/+$/, '');
const apiKey = process.env.HEYGEN_API_KEY;

if (!apiKey) {
  console.error('缺少 HEYGEN_API_KEY。请先在本地 .env 中配置，不要提交到 GitHub。');
  process.exit(1);
}

const [avatars, voices] = await Promise.all([
  request('/v3/avatars'),
  request('/v3/voices'),
]);

printItems('HeyGen avatars', extractItems(avatars), ['avatar_id', 'id', 'name', 'gender', 'status']);
printItems('HeyGen voices', extractItems(voices), ['voice_id', 'id', 'name', 'language', 'gender', 'status']);

async function request(endpoint) {
  const response = await fetch(`${apiBase}${endpoint}`, {
    headers: { 'x-api-key': apiKey },
  });
  const text = await response.text();
  const data = text ? parseJson(text) : {};
  if (!response.ok) {
    throw new Error(`HeyGen ${endpoint} 请求失败：${extractError(data) || text || `HTTP ${response.status}`}`);
  }
  return data;
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.avatars)) return payload.data.avatars;
  if (Array.isArray(payload?.data?.voices)) return payload.data.voices;
  if (Array.isArray(payload?.avatars)) return payload.avatars;
  if (Array.isArray(payload?.voices)) return payload.voices;
  return [];
}

function printItems(title, items, columns) {
  console.log(`\n${title}`);
  if (!items.length) {
    console.log('  未找到列表数据，请检查 HeyGen 账号权限或接口返回结构。');
    return;
  }
  console.table(items.slice(0, 30).map((item) => {
    const row = {};
    for (const column of columns) row[column] = item[column] ?? '';
    return row;
  }));
  if (items.length > 30) console.log(`  仅显示前 30 条，共 ${items.length} 条。`);
}

function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"|"$/g, '');
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractError(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  return payload.message || payload.error || payload.error_msg || payload.description || payload.raw || '';
}
