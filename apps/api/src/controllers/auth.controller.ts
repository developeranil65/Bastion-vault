/**
 * Auth Controller — HTTP request/response handlers for authentication
 *
 * Endpoints:
 *   POST /register       — Create user + auto-create tenant
 *   POST /otp/send       — Send OTP to registered email
 *   POST /login          — Login with email + OTP (or recovery code)
 *   POST /refresh        — Refresh access token
 *   GET  /me             — Get current user info
 *   POST /switch-tenant  — Switch active tenant context
 *   POST /invite         — Invite a user to your tenant
 */

import { Request, Response } from 'express';
import { authService } from '../services/user-auth';
import {
  inviteUserRequestSchema,
  loginRequestSchema,
  otpSendRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  switchTenantRequestSchema,
} from '../schemas/common-schema';

/** POST /register */
export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { email, password, tenantName } = parsed.data;
  const result = await authService.register({ email, password, tenantName });

  if (!result.success) {
    res.status(400).json({ error: result.message });
    return;
  }

  res.status(201).json(result);
}

/** POST /otp/send */
export async function sendOtp(req: Request, res: Response): Promise<void> {
  const parsed = otpSendRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { email } = parsed.data;
  const result = await authService.sendOTP(email);

  if (result.success) {
    res.json({ message: result.message });
  } else {
    res.status(400).json({ error: result.message });
  }
}

/** POST /login */
export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { email, otp } = parsed.data;
  const result = await authService.login(email, otp);

  if (!result.success) {
    res.status(400).json({ error: result.message });
    return;
  }

  res.json(result);
}

/** POST /refresh */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const parsed = refreshRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const result = await authService.refreshAccessToken(parsed.data.refreshToken);

  if (!result.success) {
    res.status(401).json({ error: result.message });
    return;
  }

  res.json(result);
}

/** GET /me */
export function getMe(req: Request, res: Response): void {
  const user = (req as any).user;
  res.json({
    user,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    permissions: user.permissions,
  });
}

/** POST /switch-tenant */
export async function switchTenant(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const parsed = switchTenantRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { tenantId } = parsed.data;
  const result = await authService.switchTenant(user.sub, tenantId);

  if (!result.success) {
    res.status(403).json({ error: result.message });
    return;
  }

  res.json(result);
}

/** POST /invite */
export async function inviteUser(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const parsed = inviteUserRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { email, role } = parsed.data;
  const tenantId = user.tenantId;
  if (!tenantId) {
    res.status(403).json({ error: 'No tenant context in your session' });
    return;
  }

  const result = await authService.inviteUserToTenant(user.sub, tenantId, email, role);

  if (!result.success) {
    res.status(400).json({ error: result.message });
    return;
  }

  res.json(result);
}
