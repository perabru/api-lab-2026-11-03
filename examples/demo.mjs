// Demonstração isolada: não toca no arquivo de dados do servidor habitual.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
const dir = await mkdtemp(join(tmpdir(), 'shelf-demo-'));
const server = createApp({ dataFile: join(dir, 'data.json') });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [slug, name] of [['estufa', 'Estufa ESP32'], ['sumo', 'Robô sumô']]) {
    const r = await fetch(base + '/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, name, tags: ['esp32'] }) });
    console.log('POST', r.status, r.headers.get('location'));
  }
  const r = await fetch(base + '/projects?tag=esp32&per_page=1');
  console.log('GET', r.status, 'Link:', r.headers.get('link'));
  console.log(JSON.stringify(await r.json(), null, 2));
} finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
