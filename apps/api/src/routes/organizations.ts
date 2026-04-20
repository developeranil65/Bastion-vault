// apps/api/src/routes/organizations.ts

import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { rbacMiddleware } from '../middlewares/rbac';
import { getTenantSettings, updateTenantSettings, listTenantSecrets } from '../controllers/organizations.controller';

const router = Router();

router.put(
  '/:tenantId/settings',
  authenticate,
  rbacMiddleware('admin') as any,
  updateTenantSettings as any,
);

router.get(
  '/:tenantId/settings',
  authenticate,
  rbacMiddleware('viewer') as any,
  getTenantSettings as any,
);

router.get(
  '/:tenantId/secrets',
  authenticate,
  rbacMiddleware('viewer') as any,
  listTenantSecrets as any,
);

export default router;
