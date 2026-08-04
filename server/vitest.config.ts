import { defineConfig } from 'vitest/config';

// Single source of truth for the test DB shared with test/global-setup.ts;
// override with TEST_DATABASE_URL to run the suite elsewhere (CI, containers).
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://nuru:0553997465@localhost:5432/elektor_pro_test';

export default defineConfig({
  test: {
    env: {
      ACCESS_TOKEN_SECRET: 'test_access_secret_0123456789abcdef0123456789abcdef',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'test',
      CLOUDINARY_CLOUD_NAME: 'test',
      COOKIE_DOMAIN: '',
      CORS_ACCESS: 'http://localhost:3000',
      DATABASE_URL: TEST_DATABASE_URL,
      NODE_ENV: 'test',
      OTP_MODE: 'mock',
      REFRESH_TOKEN_SECRET: 'test_refresh_secret_fedcba9876543210fedcba9876543210',
    },
    fileParallelism: false,
    globals: true,
    globalSetup: './test/global-setup.ts',
    hookTimeout: 30_000,
    include: ['test/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
