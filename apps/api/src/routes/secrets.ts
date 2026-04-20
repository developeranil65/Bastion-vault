/**
 * Secrets Route Components
 *
 * KISS: Routes are thin — only paths, middleware chains, and Swagger docs.
 * Business logic lives in controllers/secrets.controller.ts
 *
 * Route structure:
 *   /:tenantId/envs/:environment/secrets          — CRUD operations
 *   /:tenantId/envs/:environment/secrets/:name/value  — Plaintext access
 *   /:tenantId/envs/:environment/secrets/:name/rotate — Rotation
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { rbacMiddleware, scopeMiddleware } from '../middlewares/rbac';
import { rateLimitMiddleware } from '../middlewares/rate-limit';
import {
  createSecret,
  listSecrets,
  getSecretValue,
  rotateSecret,
  deleteSecret,
} from '../controllers/secrets.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/secrets/{tenantId}/envs/{environment}/secrets:
 *   post:
 *     tags: [Secrets]
 *     summary: Create a new secret
 *     description: Creates a new encrypted secret in the specified tenant and environment scope.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
 *       - in: path
 *         name: environment
 *         required: true
 *         schema:
 *           type: string
 *           enum: [dev, staging, prod]
 *         description: Environment scope
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSecretRequest'
 *     responses:
 *       201:
 *         description: Secret created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — insufficient role
 *       409:
 *         description: Secret name already exists in this scope
 */
router.post(
  '/:tenantId/envs/:environment/secrets',
  authenticate,
  rbacMiddleware('admin') as any,
  rateLimitMiddleware(10, '60s') as any,
  createSecret as any,
);

/**
 * @openapi
 * /api/v1/secrets/{tenantId}/envs/{environment}/secrets:
 *   get:
 *     tags: [Secrets]
 *     summary: List all secrets (metadata only)
 *     description: Returns metadata of all active secrets. Does NOT return decrypted values.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: environment
 *         required: true
 *         schema:
 *           type: string
 *           enum: [dev, staging, prod]
 *     responses:
 *       200:
 *         description: List of secrets (metadata only)
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/:tenantId/envs/:environment/secrets',
  authenticate,
  rbacMiddleware('viewer') as any,
  rateLimitMiddleware(120, '60s') as any,
  listSecrets as any,
);

/**
 * @openapi
 * /api/v1/secrets/{tenantId}/envs/{environment}/secrets/{secretName}/value:
 *   get:
 *     tags: [Secrets]
 *     summary: Get decrypted secret value (Memory-Only)
 *     description: >
 *       Returns the decrypted secret value. The value exists only in RAM —
 *       never logged, never cached. Designed for CLI/Passport injection.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: environment
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: secretName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plaintext secret value
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Secret not found
 */
router.get(
  '/:tenantId/envs/:environment/secrets/:secretName/value',
  authenticate,
  scopeMiddleware('read') as any,
  rateLimitMiddleware(60, '60s') as any,
  getSecretValue as any,
);

/**
 * @openapi
 * /api/v1/secrets/{tenantId}/envs/{environment}/secrets/{secretName}/rotate:
 *   put:
 *     tags: [Secrets]
 *     summary: Rotate a secret
 *     description: Re-encrypts the secret with a new DEK and increments the version.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: environment
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: secretName
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newValue:
 *                 type: string
 *                 description: Optional new secret value. If omitted, same value is re-encrypted with new DEK.
 *     responses:
 *       200:
 *         description: Secret rotated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Secret not found
 */
router.put(
  '/:tenantId/envs/:environment/secrets/:secretName/rotate',
  authenticate,
  rbacMiddleware('admin') as any,
  rateLimitMiddleware(30, '60s') as any,
  rotateSecret as any,
);

/**
 * @openapi
 * /api/v1/secrets/{tenantId}/envs/{environment}/secrets/{secretName}:
 *   delete:
 *     tags: [Secrets]
 *     summary: Soft-delete a secret
 *     description: Marks a secret as deleted (90-day retention). The old value becomes inaccessible immediately.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: environment
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: secretName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Secret soft-deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Secret not found
 */
router.delete(
  '/:tenantId/envs/:environment/secrets/:secretName',
  authenticate,
  rbacMiddleware('admin') as any,
  rateLimitMiddleware(30, '60s') as any,
  deleteSecret as any,
);

export default router;
