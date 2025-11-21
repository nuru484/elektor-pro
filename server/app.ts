import type { NextFunction, Request, Response } from 'express';

import cookieParser from 'cookie-parser';
import cors from 'cors';
// app.ts
import express from 'express';
import morgan from 'morgan';

import ENV from './src/config/env.js';
import {
  errorHandler,
  UnauthorizedError,
} from './src/middlewares/error-handler.js';
import { NotFoundError } from './src/middlewares/error-handler.js';
import { apiLimiter } from './src/middlewares/rateLimit.js';
import routes from './src/routes/index.js';

const app = express();

const allowedOrigins = new Set(
  ENV.CORS_ACCESS ? ENV.CORS_ACCESS.split(',') : [],
);

type CorsCallback = (err: Error | null, allow: boolean) => void;

const corsOptions = {
  allowedHeaders: ['Content-Type', 'Authorization'],

  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
  origin: function (origin: string | undefined, callback: CorsCallback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(
        new UnauthorizedError('Not allowed by CORS', {
          code: 'CORS_NOT_ALLOWED',
          context: { origin },
          layer: 'cors',
        }),
        false,
      );
    }
  },
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser() as express.RequestHandler);
app.set('trust proxy', true); // Enable trust proxy for proper IP handling behind proxies
app.use(
  morgan(':method :url :status :response-time ms') as express.RequestHandler,
);
app.use(apiLimiter);
app.use('/api/v1', routes);

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'API is working',
    success: true,
  });
});

// Unknown route
app.use((req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
});
app.use(errorHandler);

export default app;
