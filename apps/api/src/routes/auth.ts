/**
 * Auth Routes — Thin route definitions + Swagger docs
 *
 * Business logic lives in controllers/auth.controller.ts
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { rbacMiddleware } from '../middlewares/rbac';
import { rateLimitMiddleware } from '../middlewares/rate-limit';
import {
  register,
  sendOtp,
  login,
  refreshToken,
  getMe,
  switchTenant,
  inviteUser,
} from '../controllers/auth.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Creates a new user, auto-creates a tenant, and returns backup recovery codes (shown ONCE).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully. Save recovery codes immediately.
 *       400:
 *         description: Invalid input or user already exists
 */
router.post('/register', rateLimitMiddleware(5, '300s') as any, register as any);

/**
 * @openapi
 * /api/v1/auth/otp/send:
 *   post:
 *     tags: [Authentication]
 *     summary: Send OTP to email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OTPRequest'
 *     responses:
 *       200:
 *         description: OTP sent (or message returned to prevent enumeration)
 */
router.post('/otp/send', rateLimitMiddleware(5, '300s') as any, sendOtp as any);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login with email and OTP (or recovery code)
 *     description: >
 *       Authenticates using a 6-digit OTP or a backup recovery code.
 *       Returns JWT tokens scoped to the user's primary tenant,
 *       plus a list of all tenants the user belongs to.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful, returns JWT tokens + tenant list
 *       400:
 *         description: Invalid credentials or OTP
 */
router.post('/login', rateLimitMiddleware(10, '300s') as any, login as any);

/**
 * @openapi
 * /api/v1/auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', rateLimitMiddleware(20, '300s') as any, refreshToken as any);

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user info
 *     responses:
 *       200:
 *         description: Current user details + active tenant context
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, getMe as any);

/**
 * @openapi
 * /api/v1/auth/switch-tenant:
 *   post:
 *     tags: [Authentication]
 *     summary: Switch active tenant context
 *     description: >
 *       Issues a new JWT scoped to a different tenant the user belongs to.
 *       Requires the user to be an active member of the target tenant.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantId]
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: New JWT tokens scoped to the target tenant
 *       403:
 *         description: Not a member of the target tenant
 */
router.post('/switch-tenant', authenticate, rateLimitMiddleware(30, '300s') as any, switchTenant as any);

/**
 * @openapi
 * /api/v1/auth/invite:
 *   post:
 *     tags: [Authentication]
 *     summary: Invite a user to your tenant
 *     description: >
 *       OWNER or ADMIN can invite a registered user to join their tenant.
 *       The invitee gets the specified role (USER or ADMIN).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *                 default: USER
 *     responses:
 *       200:
 *         description: User added to tenant
 *       400:
 *         description: User not found or already a member
 */
router.post('/invite', authenticate, rbacMiddleware('admin') as any, rateLimitMiddleware(20, '300s') as any, inviteUser as any);

export default router;
