#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Mock @shared/const
const mockPackagePath = '/root/tts-srt-generator/node_modules/@shared/const.js';
require.cache[mockPackagePath] = {
  exports: {
    COOKIE_NAME: 'app_session_id',
    ONE_YEAR_MS: 1000 * 60 * 60 * 24 * 365,
    AXIOS_TIMEOUT_MS: 30000,
    UNAUTHED_ERR_MSG: 'Please login (10001)',
    NOT_ADMIN_ERR_MSG: 'You do not have required permission (10002)'
  }
};

// Create the directory structure
import { mkdirSync } from 'node:fs';
try {
  mkdirSync('/root/tts-srt-generator/node_modules/@shared', { recursive: true });
} catch (e) {
  // Directory exists
}

await import('./dist/index.js');
