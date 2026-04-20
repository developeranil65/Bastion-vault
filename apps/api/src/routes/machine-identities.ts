/**
 * Machine Identity Routes — Passport Management
 *
 * Admin-only endpoints for managing Machine Identity Passports.
 * Raw token is created and shown ONCE — never stored or shown again.
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { rbacMiddleware } from '../middlewares/rbac';
import { rateLimitMiddleware } from '../middlewares/rate-limit';
import {
  createPassport,
  listPassports,
  getPassport,
  revokePassport,
} from '../controllers/machine-identity.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/identities/{tenantId}/passports:
 *   post:
 *     tags: [Machine Identities]
 *     summary: Create a Machine Identity Passport
 *     description: >
 *       Generates a new Machine Identity and returns the raw Passport token.
 *       IMPORTANT: The token is shown ONCE. Save it immediately.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, scopes]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Acme Prod Payment Service"
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["prod:read", "dev:read"]
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiry. Defaults to 30 days.
 *     responses:
 *       201:
 *         description: Passport created. Token shown once.
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.post(
  '/:tenantId/passports',
  authenticate,
  rbacMiddleware('admin') as any,
  rateLimitMiddleware(5, '60s') as any,
  createPassport as any,
);

/**
 * @openapi
 * /api/v1/identities/{tenantId}/passports:
 *   get:
 *     tags: [Machine Identities]
 *     summary: List all Machine Identities
 *     description: Returns metadata of all Machine Identities for the tenant. Never returns tokens.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of identities
 */
router.get(
  '/:tenantId/passports',
  authenticate,
  rbacMiddleware('admin') as any,
  listPassports as any,
);

/**
 * @openapi
 * /api/v1/identities/{tenantId}/passports/{identityId}:
 *   get:
 *     tags: [Machine Identities]
 *     summary: Get Machine Identity details
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: identityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Identity metadata
 *       404:
 *         description: Not found
 */
router.get(
  '/:tenantId/passports/:identityId',
  authenticate,
  rbacMiddleware('admin') as any,
  getPassport as any,
);

/**
 * @openapi
 * /api/v1/identities/{tenantId}/passports/{identityId}:
 *   delete:
 *     tags: [Machine Identities]
 *     summary: Revoke a Machine Identity (instant kill switch)
 *     description: >
 *       Immediately revokes the Machine Identity. Any subsequent requests
 *       using this token will be rejected.
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: identityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Identity revoked
 *       401:
 *         description: Unauthorized
 */
router.delete(
  '/:tenantId/passports/:identityId',
  authenticate,
  rbacMiddleware('admin') as any,
  revokePassport as any,
);

export default router;
