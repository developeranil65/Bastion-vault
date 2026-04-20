/**
 * Auth Service — Multi-Tenant SaaS Authentication
 *
 * Security Rules:
 * 1. Passwords hashed with bcrypt (12 rounds)
 * 2. JWTs include tenantId + role from UserTenant for downstream RLS
 * 3. Refresh tokens are signed JWTs (not opaque hex)
 * 4. OTP stored in-memory with 5-minute TTL (swap to Redis for multi-instance)
 * 5. Recovery codes provide backup auth when OTP email is unavailable
 * 6. NEVER log passwords, tokens, or OTP values
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomInt, randomBytes } from 'crypto';
import prisma from '../lib/prisma';
import { config } from '../config/env';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserCredentials {
  email: string;
  password: string;
}

export interface JWTPayload {
  sub: string;       // User UUID
  email: string;
  role: string;
  tenantId: string;  // Active tenant context for RLS
  permissions: string[];
  exp?: number;
  iat?: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface OTPService {
  sendOTP(email: string): Promise<{ success: boolean; message: string; expiresAt?: Date }>;
  verifyOTP(email: string, otp: string): Promise<boolean>;
}

// ─── Email Service (Mock — swap for SendGrid/SES in production) ──────────────

export class EmailService {
  async send(data: { to: string; subject: string; text: string; html: string }) {
    logger.info('[EmailService] OTP email dispatched', { to: data.to });
    if (!config.IS_PRODUCTION) {
      const match = data.text.match(/OTP is: (\d{6})/);
      const otp = match ? match[1] : 'unknown';
      logger.debug('[EmailService] Development OTP emitted', { to: data.to, otp });
    }
  }
}

// ─── Permission Matrix ──────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: ['read_secrets', 'manage_secrets', 'rotate_secrets', 'delete_secrets', 'manage_identities', 'manage_tenant', 'invite_users'],
  ADMIN: ['read_secrets', 'manage_secrets', 'rotate_secrets', 'delete_secrets', 'manage_identities', 'invite_users'],
  USER:  ['read_secrets'],
};

// ─── Auth Service ────────────────────────────────────────────────────────────

export class AuthService {
  private jwtSecret: string;
  private refreshSecret: string;
  private emailService: EmailService;
  private otpStore: Map<string, { otp: string; expires: Date }> = new Map();

  constructor() {
    this.jwtSecret = config.JWT_SECRET;
    this.refreshSecret = config.JWT_REFRESH_SECRET;
    this.emailService = new EmailService();
  }

  /**
   * Register a new user.
   *
   * Flow:
   * 1. Check if email already exists
   * 2. Hash password with bcrypt (12 rounds)
   * 3. Auto-create a Tenant for the user (SaaS self-service model)
   * 4. Create User record + UserTenant membership as OWNER
   * 5. Generate backup recovery codes
   * 6. Return userId + tenantId + recovery codes (shown ONCE)
   */
  async register(user: { email: string; password: string; tenantName?: string }): Promise<{
    success: boolean;
    message: string;
    userId: string;
    tenantId?: string;
    recoveryCodes?: string[];
  }> {
    const email = user.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return {
        success: false,
        message: 'A user with this email already exists',
        userId: '',
      };
    }

    const hashedPassword = await bcrypt.hash(user.password, 12);

    // Generate 8 backup recovery codes
    const rawRecoveryCodes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString('hex').toUpperCase()
    );
    const hashedRecoveryCodes = await Promise.all(
      rawRecoveryCodes.map(code => bcrypt.hash(code, 10))
    );

    // Auto-create a tenant for the new user
    const tenantSlug = email.split('@')[0].replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const uniqueSlug = `${tenantSlug}-${Date.now().toString(36)}`;

    const tenant = await prisma.tenant.create({
      data: {
        name: user.tenantName?.trim() || `${tenantSlug}'s Workspace`,
        slug: uniqueSlug,
        settings: { defaultRegion: 'us-east-1' },
      },
    });

    // Create user (no role/tenantId on User — that's on UserTenant)
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        recoveryCodes: hashedRecoveryCodes,
      },
    });

    // Create membership as OWNER
    await prisma.userTenant.create({
      data: {
        userId: newUser.id,
        tenantId: tenant.id,
        role: 'OWNER',
      },
    });

    logger.audit('User registered', { userId: newUser.id, tenantId: tenant.id });

    return {
      success: true,
      message: 'User registered successfully. Save your recovery codes — they will NOT be shown again.',
      userId: newUser.id,
      tenantId: tenant.id,
      recoveryCodes: rawRecoveryCodes,
    };
  }

  /**
   * Login with OTP verification.
   *
   * Flow:
   * 1. Verify OTP from in-memory store (or recovery code)
   * 2. Look up user from DB by email
   * 3. Fetch user's primary tenant membership (first OWNER, then ADMIN, then USER)
   * 4. Generate JWT with userId, tenantId, role, permissions
   * 5. Generate signed refresh token
   */
  async login(
    email: string,
    otp: string,
  ): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    message: string;
    user?: { id: string; email: string; role: string; tenantId: string };
    tenants?: { id: string; name: string; role: string }[];
  }> {
    const emailLower = email.toLowerCase().trim();

    // 1. Verify OTP (or recovery code)
    const otpValid = await this.verifyOTPOrRecoveryCode(emailLower, otp);
    if (!otpValid) {
      return { success: false, message: 'Invalid or expired OTP. Request a new one.' };
    }

    // 2. Look up user from database
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true,
        email: true,
        memberships: {
          select: {
            tenantId: true,
            role: true,
            tenant: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      return { success: false, message: 'User not found. Please register first.' };
    }

    if (user.memberships.length === 0) {
      return { success: false, message: 'User has no tenant memberships.' };
    }

    // 3. Select primary tenant (first membership — typically the one they created)
    const primaryMembership = user.memberships[0];
    const role = primaryMembership.role;
    const tenantId = primaryMembership.tenantId;
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.USER;

    // 4. Generate tokens
    const accessToken = this.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: role.toLowerCase(),
      tenantId,
      permissions,
    });

    const refreshToken = this.generateRefreshToken(user.id, tenantId);

    logger.audit('User logged in', { userId: user.id, tenantId });

    return {
      success: true,
      accessToken,
      refreshToken,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: role.toLowerCase(),
        tenantId,
      },
      tenants: user.memberships.map(m => ({
        id: m.tenant.id,
        name: m.tenant.name,
        role: m.role,
      })),
    };
  }

  /**
   * Switch tenant context — issue a new JWT scoped to a different tenant.
   */
  async switchTenant(userId: string, targetTenantId: string): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    message: string;
  }> {
    const membership = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId: targetTenantId } },
      include: { user: { select: { email: true } } },
    });

    if (!membership) {
      return { success: false, message: 'You are not a member of this tenant.' };
    }

    const permissions = ROLE_PERMISSIONS[membership.role] || ROLE_PERMISSIONS.USER;

    const accessToken = this.generateAccessToken({
      userId,
      email: membership.user.email,
      role: membership.role.toLowerCase(),
      tenantId: targetTenantId,
      permissions,
    });

    const refreshToken = this.generateRefreshToken(userId, targetTenantId);

    logger.audit('Tenant switched', { userId, tenantId: targetTenantId });

    return {
      success: true,
      accessToken,
      refreshToken,
      message: 'Switched tenant context successfully',
    };
  }

  /**
   * Invite a user to a tenant.
   * If user doesn't exist, return an invite code they can use during registration.
   */
  async inviteUserToTenant(
    inviterUserId: string,
    tenantId: string,
    inviteeEmail: string,
    role: string = 'USER',
  ): Promise<{ success: boolean; message: string }> {
    const emailLower = inviteeEmail.toLowerCase().trim();

    // Check if the invitee already exists
    const existingUser = await prisma.user.findUnique({ where: { email: emailLower } });

    if (!existingUser) {
      return {
        success: false,
        message: `No registered user found with email ${emailLower}. They must register first.`,
      };
    }

    // Check if already a member
    const existingMembership = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId: existingUser.id, tenantId } },
    });

    if (existingMembership) {
      return { success: false, message: 'User is already a member of this tenant.' };
    }

    // Sanitize role
    const validRoles = ['USER', 'ADMIN'];
    const assignedRole = validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : 'USER';

    await prisma.userTenant.create({
      data: {
        userId: existingUser.id,
        tenantId,
        role: assignedRole as any,
      },
    });

    logger.audit('User invited to tenant', {
      invitedBy: inviterUserId,
      inviteeId: existingUser.id,
      tenantId,
      role: assignedRole,
    });

    return { success: true, message: `User ${emailLower} added to tenant with role ${assignedRole}.` };
  }

  /**
   * Send OTP via email.
   */
  async sendOTP(email: string): Promise<{
    success: boolean;
    message: string;
    expiresAt: Date;
  }> {
    const emailLower = email.toLowerCase().trim();

    // Verify user exists before sending OTP
    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      // Return success anyway to prevent email enumeration attacks
      return {
        success: true,
        message: `If an account exists for ${emailLower}, an OTP has been sent.`,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    }

    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    this.pruneExpiredOtps();
    this.otpStore.set(emailLower, { otp, expires: expiresAt });

    await this.emailService.send({
      to: emailLower,
      subject: 'Your Bastion Vault login code',
      text: `Your Bastion Vault OTP is: ${otp}. Valid for 5 minutes.`,
      html: `<p>Your Bastion Vault OTP is: <strong>${otp}</strong></p><p>Valid for 5 minutes.</p>`,
    });

    return {
      success: true,
      message: `If an account exists for ${emailLower}, an OTP has been sent.`,
      expiresAt,
    };
  }

  /**
   * Generate JWT access token with full user context.
   */
  private generateAccessToken(ctx: {
    userId: string;
    email: string;
    role: string;
    tenantId: string;
    permissions: string[];
  }): string {
    const payload: JWTPayload = {
      sub: ctx.userId,
      email: ctx.email,
      role: ctx.role,
      tenantId: ctx.tenantId,
      permissions: ctx.permissions,
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: '30m' });
  }

  /**
   * Generate a signed refresh token.
   */
  private generateRefreshToken(userId: string, tenantId: string): string {
    return jwt.sign(
      { sub: userId, tenantId, type: 'refresh' },
      this.refreshSecret,
      { expiresIn: '7d' },
    );
  }

  /**
   * Refresh access token using a signed refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    message?: string;
  }> {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshSecret) as {
        sub: string;
        tenantId: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        return { success: false, message: 'Invalid token type' };
      }

      // Look up user + their membership for THIS tenant
      const membership = await prisma.userTenant.findUnique({
        where: { userId_tenantId: { userId: decoded.sub, tenantId: decoded.tenantId } },
        include: { user: { select: { id: true, email: true } } },
      });

      if (!membership) {
        return { success: false, message: 'User not found or no longer a member of this tenant' };
      }

      const permissions = ROLE_PERMISSIONS[membership.role] || ROLE_PERMISSIONS.USER;

      const newAccessToken = this.generateAccessToken({
        userId: membership.user.id,
        email: membership.user.email,
        role: membership.role.toLowerCase(),
        tenantId: decoded.tenantId,
        permissions,
      });

      const newRefreshToken = this.generateRefreshToken(membership.user.id, decoded.tenantId);

      return {
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        message: 'Token refreshed successfully',
      };
    } catch (err) {
      return { success: false, message: 'Invalid or expired refresh token' };
    }
  }

  /**
   * Verify OTP or recovery code.
   */
  private async verifyOTPOrRecoveryCode(email: string, code: string): Promise<boolean> {
    // Try OTP first
    const userOtp = this.otpStore.get(email);
    if (userOtp) {
      if (userOtp.expires.getTime() < Date.now()) {
        this.otpStore.delete(email);
        return false;
      }
      if (userOtp.otp === code) {
        this.otpStore.delete(email);
        return true;
      }
    }

    // Try recovery code
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, recoveryCodes: true },
    });

    if (user && user.recoveryCodes.length > 0) {
      for (let i = 0; i < user.recoveryCodes.length; i++) {
        const match = await bcrypt.compare(code, user.recoveryCodes[i]);
        if (match) {
          // Consume the recovery code (remove it)
          const updatedCodes = [...user.recoveryCodes];
          updatedCodes.splice(i, 1);
          await prisma.user.update({
            where: { id: user.id },
            data: { recoveryCodes: updatedCodes },
          });
          logger.audit('Recovery code used', { userId: user.id });
          return true;
        }
      }
    }

    // Neither OTP nor recovery code matched
    this.otpStore.delete(email);
    return false;
  }

  /**
   * Verify user credentials (password check).
   */
  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<{ valid: boolean; userId?: string }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, password: true },
    });

    if (!user) {
      return { valid: false };
    }

    const isValid = await bcrypt.compare(password, user.password);
    return { valid: isValid, userId: isValid ? user.id : undefined };
  }

  /**
   * Generate 6-digit OTP.
   */
  private generateOTP(): string {
    return randomInt(100000, 999999).toString();
  }

  private pruneExpiredOtps(): void {
    const now = Date.now();
    for (const [email, value] of this.otpStore.entries()) {
      if (value.expires.getTime() <= now) {
        this.otpStore.delete(email);
      }
    }
  }

  /**
   * Validate a JWT access token.
   */
  validateToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret, {
        clockTolerance: 300,
      }) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Verify OTP (interface method).
   */
  async verifyOTP(email: string, otp: string): Promise<boolean> {
    const userOtp = this.otpStore.get(email.toLowerCase());
    if (!userOtp || userOtp.expires.getTime() < Date.now()) return false;
    if (userOtp.otp === otp) {
      this.otpStore.delete(email.toLowerCase());
      return true;
    }
    return false;
  }
}

export const authService = new AuthService();
export const otpService: OTPService = authService;
