import { register } from 'node:module';

register('import-map', new URL('./import_map.json', import.meta.url));

await import('./dist/index.js');
