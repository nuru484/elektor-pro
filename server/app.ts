// app.ts
import type { NextFunction, Request, Response } from 'express';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

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

app.set('trust proxy', true);
app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(requestContext);
app.use(
  morgan(':method :url :status :response-time ms - :req[x-request-id]') as express.RequestHandler,
);

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
