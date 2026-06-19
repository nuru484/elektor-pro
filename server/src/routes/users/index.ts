// src/routes/users/index.ts
import { Router } from 'express';

import usersRouter from './usersRoutes.js';

const usersRoutes = Router();

usersRoutes.use('/users', usersRouter);

export default usersRoutes;
