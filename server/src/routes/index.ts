// src/routes/index.ts
import express from 'express';
import authenticationRoutes from './authentication/index.js';
import usersRoutes from './users/index.js';

const routes = express.Router();

routes.use('/auth', authenticationRoutes);
routes.use('/', usersRoutes);

export default routes;
