// Write the generated OpenAPI 3.1 document to apps/api/openapi.json without booting
// the server. This committed snapshot is what `pnpm gen:api-types` consumes, so the
// client types can be regenerated offline. Source of truth is the Zod routes.
import '../src/load-env.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from '../src/app.js';

const app = createApp();
const doc = app.getOpenAPI31Document({
  openapi: '3.1.0',
  info: {
    title: 'getvinyls API',
    version: '0.1.0',
    description: 'Read-only public API for vinyl record discovery.',
  },
});

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'openapi.json');
writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
