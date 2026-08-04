// src/utils/logger.ts
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Structured JSON logs in production (machine-parseable, cheap); pretty,
 * colorized output in development only. Silent under test so suite output
 * stays readable - tests that assert on logging inject their own fake logger
 * through deps.
 */
const logger = pino({
  level: isTest ? 'silent' : isProduction ? 'info' : 'debug',
  ...(isProduction || isTest
    ? {}
    : {
        transport: {
          options: {
            colorize: true,
            ignore: '',
            singleLine: false,
            translateTime: true,
          },
          target: 'pino-pretty',
        },
      }),
});

export default logger;
