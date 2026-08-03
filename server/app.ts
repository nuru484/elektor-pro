// app.ts
import type { NextFunction, Request, Response } from 'express';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import ENV from './src/config/env.js';
import {
  errorHandler,
  NotFoundError,
  UnauthorizedError,
} from './src/middlewares/error-handler.js';
import { apiLimiter } from './src/middlewares/rateLimit.js';
import { requestContext } from './src/middlewares/request-context.js';
import healthRoutes from './src/routes/health.js';
import routes from './src/routes/index.js';
import logger from './src/utils/logger.js';

const app = express();

const allowedOrigins = new Set(
  ENV.CORS_ACCESS ? ENV.CORS_ACCESS.split(',').map((o) => o.trim()) : [],
);

type CorsCallback = (err: Error | null, allow?: boolean) => void;

const corsOptions = {
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
  origin(origin: string | undefined, callback: CorsCallback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(
        new UnauthorizedError('Not allowed by CORS', {
          code: 'CORS_NOT_ALLOWED',
          context: { origin },
          layer: 'cors',
        }),
      );
    }
  },
};

// Trust exactly one proxy hop (the platform load balancer) so req.ip reflects
// the real client for rate limiting. Trusting all proxies (`true`) would let
// clients spoof X-Forwarded-For and bypass IP-based limits. Adjust the hop
// count if additional proxies (e.g. a CDN) sit in front of the platform.
app.set('trust proxy', 1);

// Correlation id first, so every later middleware (access log, error handler)
// can stamp it on its output and the response always echoes X-Request-Id.
app.use(requestContext);

app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));

// Access logging runs BEFORE the body parsers so parser rejections (413
// payload-too-large, 400 malformed JSON) still produce an access-log line.
// One lean entry per response (method/path/status/latency + requestId), not
// full req/res dumps. Skipped under test: the logger is silenced there and
// per-request logging would only slow the suite.
if (ENV.NODE_ENV !== 'test') {
  app.use(
    // Explicit generics: without them TS infers a narrowed custom-level union
    // from customLogLevel's return literals and rejects the plain pino logger.
    pinoHttp<Request, Response>({
      // Health probes fire constantly (platform pollers); logging them is noise.
      autoLogging: {
        ignore: (req) => req.url.startsWith('/health'),
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      genReqId: (req) => req.requestId ?? '',
      logger,
      serializers: {
        // Log the path only: query strings can carry tokens/OTP codes, which
        // must never land in access logs.
        req: (req: { method?: string; url?: string }) => ({
          method: req.method,
          url: (req.url ?? '').split('?')[0],
        }),
        res: (res: { statusCode?: number }) => ({
          statusCode: res.statusCode,
        }),
      },
    }),
  );
}

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Health/readiness are not rate-limited.
app.use('/', healthRoutes);

app.use(apiLimiter);
app.use('/api/v1', routes);

// Unknown route
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

app.use(errorHandler);

export default app;
