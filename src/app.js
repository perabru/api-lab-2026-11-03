import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

class ApiError extends Error {
  constructor(status, code, message) { super(message); Object.assign(this, { status, code }); }
}
const fail = (status, code, message) => { throw new ApiError(status, code, message); };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function fields(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(422, 'validation_error', 'Envie um objeto JSON.');
  const allowed = partial ? ['name', 'description', 'tags', 'url'] : ['slug', 'name', 'description', 'tags', 'url'];
  if (!Object.keys(input).length || Object.keys(input).some(k => !allowed.includes(k))) fail(422, 'validation_error', 'Campos vazios, desconhecidos ou imutáveis.');
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'tags') {
      if (!Array.isArray(value) || value.length > 10 || value.some(t => typeof t !== 'string' || !slugPattern.test(t) || t.length > 30)) fail(422, 'validation_error', 'tags: até 10 identificadores minúsculos, com até 30 caracteres.');
      out.tags = [...new Set(value)].sort(); continue;
    }
    const max = { slug: 80, name: 120, description: 1000, url: 2048 }[key];
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(422, 'validation_error', `${key}: texto inválido ou muito longo.`);
    out[key] = value.trim();
    if ((key === 'name' && !out[key]) || (key === 'slug' && !slugPattern.test(out[key]))) fail(422, 'validation_error', `${key}: valor inválido.`);
    if (key === 'url' && out[key]) {
      let u; try { u = new URL(out[key]); } catch { fail(422, 'validation_error', 'url: informe uma URL HTTPS.'); }
      if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) fail(422, 'validation_error', 'url: HTTPS sem credenciais.');
    }
  }
  if (!partial && (!out.slug || !out.name)) fail(422, 'validation_error', 'slug e name são obrigatórios.');
  return partial ? out : { description: '', tags: [], url: '', ...out };
}
async function body(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'unsupported_media_type', 'Use Content-Type: application/json.');
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) { req.resume(); fail(413, 'payload_too_large', 'Limite do corpo: 16 KiB.'); }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'invalid_json', 'JSON inválido.'); }
}
export function createApp({ dataFile }) {
  let projects = [];
  if (existsSync(dataFile)) {
    const stored = JSON.parse(readFileSync(dataFile, 'utf8'));
    if (stored.version !== 1 || !Array.isArray(stored.projects) || stored.projects.length > 1000) throw new Error('Arquivo de dados inválido.');
    const seen = new Set();
    for (const p of stored.projects) {
      const { created_at, updated_at, ...values } = p;
      fields(values);
      if (!Number.isFinite(Date.parse(created_at)) || !Number.isFinite(Date.parse(updated_at)) || seen.has(p.slug)) throw new Error('Registro persistido inválido.');
      seen.add(p.slug);
    }
    projects = stored.projects;
  }
  function save(next) {
    const temporary = `${dataFile}.tmp`;
    try {
      mkdirSync(dirname(dataFile), { recursive: true });
      writeFileSync(temporary, JSON.stringify({ version: 1, projects: next }, null, 2) + '\n', { mode: 0o600 });
      renameSync(temporary, dataFile);
      projects = next;
    } catch {
      try { rmSync(temporary, { force: true }); } catch { /* preserve original failure */ }
      fail(503, 'storage_unavailable', 'Não foi possível persistir; operação não aplicada.');
    }
  }
  return createServer(async (req, res) => {
    const send = (status, payload, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
      res.end(payload === undefined ? undefined : JSON.stringify(payload));
    };
    try {
      const u = new URL(req.url, 'http://localhost');
      const path = u.pathname;
      if (path === '/health' && req.method === 'GET') return send(200, { status: 'ok' });
      const collection = path === '/projects';
      const match = path.match(/^\/projects\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
      if (!collection && !match) fail(404, 'not_found', 'Rota não encontrada.');
      const methods = collection ? ['GET', 'POST'] : ['GET', 'PATCH', 'DELETE'];
      if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); fail(405, 'method_not_allowed', 'Método não permitido.'); }
      if (req.method === 'GET' && collection) {
        const allowed = ['q', 'tag', 'sort', 'order', 'page', 'per_page'];
        for (const k of u.searchParams.keys()) if (!allowed.includes(k) || u.searchParams.getAll(k).length > 1) fail(400, 'invalid_query', 'Parâmetro desconhecido ou repetido.');
        const get = (k, fallback) => u.searchParams.get(k) ?? fallback;
        const integer = (key, def, max) => { const v = get(key, String(def)); if (!/^[1-9]\d*$/.test(v) || Number(v) > max) fail(400, 'invalid_query', `${key}: inteiro entre 1 e ${max}.`); return Number(v); };
        const page = integer('page', 1, 1000000), perPage = integer('per_page', 20, 100);
        const q = get('q', '').trim().toLowerCase(), tag = get('tag', '');
        const sort = get('sort', 'name'), order = get('order', 'asc');
        if (q.length > 200 || (tag && (!slugPattern.test(tag) || tag.length > 30)) || !['name', 'created_at'].includes(sort) || !['asc', 'desc'].includes(order)) fail(400, 'invalid_query', 'Filtro ou ordenação inválidos.');
        const list = projects.filter(p => (!q || `${p.name} ${p.description}`.toLowerCase().includes(q)) && (!tag || p.tags.includes(tag)));
        const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
        list.sort((a, b) => (compare(a[sort], b[sort]) || compare(a.slug, b.slug)) * (order === 'asc' ? 1 : -1));
        const total = list.length, pages = Math.ceil(total / perPage), links = [];
        const link = (n, rel) => { const params = new URLSearchParams(u.searchParams); params.set('page', n); params.set('per_page', perPage); links.push(`</projects?${params}>; rel="${rel}"`); };
        if (pages && page <= pages) { if (page > 1) { link(1, 'first'); link(page - 1, 'prev'); } if (page < pages) { link(page + 1, 'next'); link(pages, 'last'); } }
        return send(200, { items: list.slice((page - 1) * perPage, page * perPage), total, page, per_page: perPage, pages }, links.length ? { Link: links.join(', ') } : {});
      }
      if (req.method === 'POST') {
        const data = fields(await body(req));
        if (projects.some(p => p.slug === data.slug)) fail(409, 'duplicate_slug', 'Este slug já existe.');
        if (projects.length >= 1000) fail(409, 'catalog_full', 'Limite de 1000 projetos atingido.');
        const now = new Date().toISOString(); const p = { ...data, created_at: now, updated_at: now };
        save([...projects, p]); return send(201, p, { Location: `/projects/${p.slug}` });
      }
      const slug = match[1];
      if (req.method === 'PATCH') {
        const patch = fields(await body(req), true);
        const index = projects.findIndex(p => p.slug === slug);
        if (index < 0) fail(404, 'not_found', 'Projeto não encontrado.');
        const next = [...projects]; next[index] = { ...next[index], ...patch, updated_at: new Date().toISOString() };
        save(next); return send(200, next[index]);
      }
      const p = projects.find(p => p.slug === slug);
      if (!p) fail(404, 'not_found', 'Projeto não encontrado.');
      if (req.method === 'DELETE') { save(projects.filter(p => p.slug !== slug)); return send(204); }
      return send(200, p);
    } catch (error) {
      send(error.status || 500, { error: { code: error.code || 'internal_error', message: error.status ? error.message : 'Erro interno.' } });
    }
  });
}
