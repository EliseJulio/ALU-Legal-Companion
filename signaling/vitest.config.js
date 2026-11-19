import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: { CALL_TICKET_SECRET: 'test-only-secret-value-for-signaling-tests', ALLOWED_ORIGINS: 'https://example.invalid' },
      },
    }),
  ],
});
