import express from 'express';
import { healthController } from '../controllers';

import authRoutes from './auth';
import secretsRoutes from './secrets';
import orgRoutes from './organizations';
import machineIdentityRoutes from './machine-identities';
import projectRoutes from './projects';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/secrets', secretsRoutes);
router.use('/identities', machineIdentityRoutes);
router.use('/projects', projectRoutes);
router.use('/', orgRoutes);

// Health check endpoint
router.get('/health', healthController as any);

export default router;
