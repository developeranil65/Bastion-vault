import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { rbacMiddleware, scopeMiddleware } from '../middlewares/rbac';
import { rateLimitMiddleware } from '../middlewares/rate-limit';
import { listProjectAudit } from '../controllers/audit.controller';
import { createProject, listProjects, updateProject } from '../controllers/projects.controller';
import { getTenantSettings, listTenantSecrets, updateTenantSettings } from '../controllers/organizations.controller';
import {
  createSecret,
  deleteSecret,
  getSecretValue,
  listSecrets,
  rotateSecret,
} from '../controllers/secrets.controller';
import {
  createPassport,
  getPassport,
  listPassports,
  revokePassport,
} from '../controllers/machine-identity.controller';

const router = Router();

function mapProjectToTenantParam(req: any, _res: any, next: any) {
  req.params.tenantId = req.params.projectId;
  next();
}

router.get(
  '/',
  authenticate,
  listProjects as any,
);

router.post(
  '/',
  authenticate,
  rateLimitMiddleware(20, '300s') as any,
  createProject as any,
);

router.patch(
  '/:projectId',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('admin') as any,
  updateProject as any,
);

router.get(
  '/:projectId/secrets',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('viewer') as any,
  listTenantSecrets as any,
);

router.put(
  '/:projectId/settings',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('admin') as any,
  updateTenantSettings as any,
);

router.get(
  '/:projectId/settings',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('viewer') as any,
  getTenantSettings as any,
);

router.get(
  '/:projectId/environments/:environment/secrets',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('viewer') as any,
  rateLimitMiddleware(120, '60s') as any,
  listSecrets as any,
);

router.post(
  '/:projectId/environments/:environment/secrets',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('admin') as any,
  rateLimitMiddleware(10, '60s') as any,
  createSecret as any,
);

router.get(
  '/:projectId/environments/:environment/secrets/:secretName/value',
  authenticate,
  mapProjectToTenantParam as any,
  scopeMiddleware('read') as any,
  rateLimitMiddleware(60, '60s') as any,
  getSecretValue as any,
);

router.put(
  '/:projectId/environments/:environment/secrets/:secretName/rotate',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('admin') as any,
  rateLimitMiddleware(30, '60s') as any,
  rotateSecret as any,
);

router.delete(
  '/:projectId/environments/:environment/secrets/:secretName',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('admin') as any,
  rateLimitMiddleware(30, '60s') as any,
  deleteSecret as any,
);

router.get(
  '/:projectId/identities',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('admin') as any,
  listPassports as any,
);

router.post(
  '/:projectId/identities',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('admin') as any,
  rateLimitMiddleware(5, '60s') as any,
  createPassport as any,
);

router.get(
  '/:projectId/identities/:identityId',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('admin') as any,
  getPassport as any,
);

router.delete(
  '/:projectId/identities/:identityId',
  authenticate,
  mapProjectToTenantParam as any,
  rbacMiddleware('admin') as any,
  revokePassport as any,
);

router.get(
  '/:projectId/audit',
  authenticate,
  rbacMiddleware('viewer') as any,
  listProjectAudit as any,
);

export default router;
