import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'project-shelf-')); const file = join(dir, 'projects.json');
  let server; let base;
  const start = async () => { server = createApp({ dataFile: file }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`; };
  const stop = () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  await start(); t.after(async () => { if (server.listening) await stop(); await rm(dir, { recursive: true, force: true }); });
  return { file, start, stop, request: (path, method = 'GET', data, headers = {}) => fetch(base + path, { method, headers: { ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: data === undefined ? undefined : JSON.stringify(data) }), raw: (value, type = 'application/json') => fetch(base + '/projects', { method: 'POST', headers: { 'Content-Type': type }, body: value }) };
}
test('HTTP CRUD: cria, consulta, altera sem perder campos e exclui', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/health')).status, 200);
  const r = await f.request('/projects', 'POST', { slug: 'estufa', name: 'Estufa', tags: ['esp32', 'esp32'] });
  assert.equal(r.status, 201); assert.equal(r.headers.get('location'), '/projects/estufa');
  const p = await r.json(); assert.deepEqual(p.tags, ['esp32']); assert.ok(Date.parse(p.created_at));
  assert.deepEqual(await (await f.request('/projects/estufa')).json(), p);
  const changed = await (await f.request('/projects/estufa', 'PATCH', { description: 'Sensores' })).json();
  assert.equal(changed.description, 'Sensores'); assert.equal(changed.name, 'Estufa'); assert.equal(changed.created_at, p.created_at);
  const deleted = await f.request('/projects/estufa', 'DELETE'); assert.equal(deleted.status, 204); assert.equal(await deleted.text(), '');
  assert.equal((await f.request('/projects/estufa')).status, 404);
});
test('persiste cadastro, alteração e exclusão após reiniciar', async t => {
  const f = await fixture(t);
  await f.request('/projects', 'POST', { slug: 'a', name: 'A' }); await f.request('/projects', 'POST', { slug: 'b', name: 'B' });
  await f.request('/projects/a', 'PATCH', { name: 'Alterado' }); await f.request('/projects/b', 'DELETE');
  await f.stop(); await f.start();
  assert.equal((await (await f.request('/projects/a')).json()).name, 'Alterado');
  assert.equal((await f.request('/projects/b')).status, 404);
});
test('paginação: segue Link preservando filtros; sem perdas ou duplicatas', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) await f.request('/projects', 'POST', { slug: `p-${i}`, name: `Projeto ${i}`, tags: ['node'] });
  await f.request('/projects', 'POST', { slug: 'outro', name: 'Outro', tags: ['java'] });
  const all = []; let path = '/projects?tag=node&q=projeto&per_page=2'; let last;
  while (path) { last = await f.request(path); const data = await last.json(); assert.equal(data.total, 5); all.push(...data.items.map(p => p.slug)); path = last.headers.get('link')?.match(/<([^>]+)>; rel="next"/)?.[1]; }
  assert.deepEqual(all, ['p-0', 'p-1', 'p-2', 'p-3', 'p-4']); assert.match(last.headers.get('link'), /rel="prev"/);
  const outside = await (await f.request('/projects?page=999')).json(); assert.deepEqual(outside.items, []);
});
test('ordenação determinística com desempate por slug e busca sem distinguir caixa', async t => {
  const f = await fixture(t);
  for (const slug of ['z', 'a']) await f.request('/projects', 'POST', { slug, name: 'Igual', description: 'ESP32' });
  const result = await (await f.request('/projects?q=esp32&order=desc')).json(); assert.deepEqual(result.items.map(p => p.slug), ['z', 'a']);
  const empty = await f.request('/projects?tag=node'); assert.equal((await empty.json()).total, 0); assert.equal(empty.headers.get('link'), null);
});
test('validação de campos, URL sem credenciais e slug imutável', async t => {
  const f = await fixture(t);
  for (const bad of [null, [], {}, { slug: 'A A', name: 'A' }, { slug: 'a', name: ' ' }, { slug: 'a', name: 'A', tags: ['Java Script'] }, { slug: 'a', name: 'A', url: 'http://example.org' }, { slug: 'a', name: 'A', url: 'https://user:secret@example.org' }, { slug: 'a', name: 'A', unknown: true }]) assert.equal((await f.request('/projects', 'POST', bad)).status, 422);
  assert.equal((await f.request('/projects', 'POST', { slug: 'a', name: 'A', url: 'https://example.org' })).status, 201);
  assert.equal((await f.request('/projects/a', 'PATCH', { slug: 'b' })).status, 422);
  assert.equal((await f.request('/projects/a', 'PATCH', {})).status, 422);
});
test('parâmetros inválidos e repetidos retornam 400', async t => {
  const f = await fixture(t);
  for (const q of ['page=0', 'page=1.5', 'page=1000001', 'per_page=101', 'order=random', 'sort=other', 'tag=Java%20Script', 'x=1', 'page=1&page=2']) assert.equal((await f.request('/projects?' + q)).status, 400, q);
});
test('JSON inválido, tipo incorreto e corpo acima de 16 KiB', async t => {
  const f = await fixture(t);
  assert.equal((await f.raw('{')).status, 400); assert.equal((await f.raw('{}', 'text/plain')).status, 415);
  assert.equal((await f.raw(JSON.stringify({ name: 'x'.repeat(17000) }))).status, 413);
});
test('duplicação e criações concorrentes não perdem registros', async t => {
  const f = await fixture(t);
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => f.request('/projects', 'POST', { slug: `p-${i}`, name: 'Projeto' })));
  assert.ok(results.every(r => r.status === 201));
  const duplicates = await Promise.all([1, 2].map(() => f.request('/projects', 'POST', { slug: 'p-0', name: 'Duplicado' })));
  assert.ok(duplicates.every(r => r.status === 409)); assert.equal((await (await f.request('/projects')).json()).total, 12);
});
test('rotas e métodos não suportados retornam erro padronizado', async t => {
  const f = await fixture(t);
  const r = await f.request('/projects', 'PUT'); assert.equal(r.status, 405); assert.equal(r.headers.get('allow'), 'GET, POST');
  assert.equal((await r.json()).error.code, 'method_not_allowed'); assert.equal((await f.request('/missing')).status, 404);
  assert.equal((await f.request('/projects/missing', 'PATCH', { name: 'A' })).status, 404);
});
test('falha no disco não aplica mutação em memória', async t => {
  const f = await fixture(t);
  await f.request('/projects', 'POST', { slug: 'a', name: 'A' });
  await writeFile(f.file + '.tmp', 'bloqueio');
  // Um diretório no caminho temporário impede escrever o arquivo, mesmo como root.
  await rm(f.file + '.tmp'); const { mkdir } = await import('node:fs/promises'); await mkdir(f.file + '.tmp');
  assert.equal((await f.request('/projects/a', 'PATCH', { name: 'Não salvar' })).status, 503);
  assert.equal((await (await f.request('/projects/a')).json()).name, 'A');
  assert.equal(JSON.parse(await readFile(f.file, 'utf8')).projects[0].name, 'A');
});
test('arquivo corrompido impede inicialização e não é sobrescrito', async t => {
  const f = await fixture(t); await f.stop(); await writeFile(f.file, '{corrompido');
  assert.throws(() => createApp({ dataFile: f.file })); assert.equal(await readFile(f.file, 'utf8'), '{corrompido');
});
