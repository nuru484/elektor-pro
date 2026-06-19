// src/routes/index.ts
import express from 'express';

import authenticationRoutes from './authentication/index.js';
import dashboardRoutes from './dashboard/index.js';
import domainRoutes from './domain/index.js';
import resultsRoutes from './results/index.js';
import usersRoutes from './users/index.js';
import votingRoutes from './voting/index.js';

const routes = express.Router();

routes.use('/auth', authenticationRoutes);
routes.use('/', domainRoutes);
routes.use('/', votingRoutes);
routes.use('/', resultsRoutes);
routes.use('/', dashboardRoutes);
routes.use('/users', usersRoutes);

export default routes;
