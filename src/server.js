import { resolve } from 'node:path';
import { createApp } from './app.js';
const rawPort = process.env.PORT ?? '3000';
if (!/^\d+$/.test(rawPort) || Number(rawPort) > 65535) throw new Error('PORT inválida.');
const server = createApp({ dataFile: resolve(process.env.DATA_FILE || 'data/projects.json') });
server.listen(Number(rawPort), process.env.HOST || '127.0.0.1', () => console.log(`Project Shelf API: http://${server.address().address}:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
