import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      ACCESS_TOKEN_SECRET: 'test_access_secret_0123456789abcdef0123456789abcdef',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'test',
      CLOUDINARY_CLOUD_NAME: 'test',
      COOKIE_DOMAIN: '',
      CORS_ACCESS: 'http://localhost:3000',
      DATABASE_URL:
        'postgresql://nuru:0553997465@localhost:5432/elektor_pro_test',
      NODE_ENV: 'test',
      OTP_MODE: 'mock',
      REFRESH_TOKEN_SECRET: 'test_refresh_secret_fedcba9876543210fedcba9876543210',
    },
    fileParallelism: false,
    globalSetup: './test/global-setup.ts',
    globals: true,
    hookTimeout: 30_000,
    include: ['test/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
