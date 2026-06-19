// src/utils/logger.ts
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport: {
    options: {
      colorize: true,
      ignore: '',
      singleLine: false,
      translateTime: true,
    },
    target: 'pino-pretty',
  },
});

export default logger;
