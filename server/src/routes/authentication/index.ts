// src/routes/authentication/index.ts
import { Router } from 'express';
import loginRoutes from './login.js';
import refreshRoutes from './refresh-token.js';
import logoutRoutes from './logout.js';

const authenticationRoutes = Router();

// authenticationRoutes.use('/', registerRoutes);
authenticationRoutes.use('/', loginRoutes);
authenticationRoutes.use('/', refreshRoutes);
authenticationRoutes.use('/', logoutRoutes);

export default authenticationRoutes;
