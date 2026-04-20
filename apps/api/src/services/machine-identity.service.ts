/**
 * Machine Identity Service — JSON Passport Management
 *
 * Architectural Constraints:
 * - Admin creates a Machine Identity → raw token is shown ONCE
 * - Token is stored as SHA-256 hash in DB (never plaintext)
 * - CLI/services authenticate via X-Passport-Token header
 * - Scope validation enforces environment access (e.g., "dev:read", "prod:write")
 * - Instant revocation: isActive=false kills all access immediately
 */

import crypto from 'crypto';
import prisma from '../lib/prisma';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PassportPayload {
  /** Raw token — shown to admin exactly once at creation time */
  token: string;
  tenantId: string;
  identityId: string;
  name: string;
  scopes: string[];
  apiUrl: string;
  expiresAt: string | null;
}

export interface ValidatedIdentity {
  identityId: string;
  tenantId: string;
  name: string;
  scopes: string[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class MachineIdentityService {

  /**
   * Create a new Machine Identity and return the raw Passport token.
   *
   * CRITICAL: The raw token is returned EXACTLY ONCE. After this call,
   * only the SHA-256 hash exists in the database. If the admin loses it,
   * they must create a new identity.
   */
  async createPassport(
    tenantId: string,
    name: string,
    scopes: string[],
    expiresAt?: Date,
    apiUrl?: string,
  ): Promise<PassportPayload> {
    // Generate cryptographically secure token
    const rawToken = `bv_${crypto.randomBytes(32).toString('hex')}`;

    // Store only the SHA-256 hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Default expiry: 30 days
    const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const identity = await prisma.machineIdentity.create({
      data: {
        tenantId,
        name,
        scopes,
        tokenHash,
        isActive: true,
        expiresAt: expiresAt || defaultExpiry,
      },
    });

    // Return the raw token — this is the ONLY time it's visible
    return {
      token: rawToken,
      tenantId,
      identityId: identity.id,
      name: identity.name,
      scopes: identity.scopes,
      apiUrl: apiUrl || process.env.API_URL || 'http://localhost:3000',
      expiresAt: identity.expiresAt?.toISOString() || null,
    };
  }

  /**
   * Validate a raw Passport token.
   *
   * 1. Hash the incoming token
   * 2. Look up by tokenHash
   * 3. Check isActive, expiresAt
   * 4. Update lastUsedAt
   */
  async validatePassport(rawToken: string): Promise<ValidatedIdentity | null> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const identity = await prisma.machineIdentity.findUnique({
      where: { tokenHash },
    });

    if (!identity) return null;
    if (!identity.isActive) return null;
    if (identity.revokedAt) return null;
    if (identity.expiresAt && identity.expiresAt < new Date()) return null;

    // Update lastUsedAt (fire-and-forget — don't block the request)
    prisma.machineIdentity.update({
      where: { id: identity.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => { /* non-critical */ });

    return {
      identityId: identity.id,
      tenantId: identity.tenantId,
      name: identity.name,
      scopes: identity.scopes,
    };
  }

  /**
   * Revoke a Machine Identity — instant kill switch.
   * The next request with this token will be rejected.
   */
  async revokePassport(tenantId: string, identityId: string, revokedBy: string): Promise<void> {
    const result = await prisma.machineIdentity.updateMany({
      where: { id: identityId, tenantId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy,
      },
    });

    if (result.count === 0) {
      throw new Error('Machine Identity not found');
    }
  }

  /**
   * List all Machine Identities for a tenant.
   * Constraint: Restricts egress of tokenHash or raw secret material.
   */
  async listPassports(tenantId: string) {
    return prisma.machineIdentity.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        revokedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single Machine Identity's metadata.
   */
  async getPassport(tenantId: string, identityId: string) {
    const identity = await prisma.machineIdentity.findFirst({
      where: { id: identityId, tenantId },
      select: {
        id: true,
        name: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        revokedBy: true,
      },
    });

    if (!identity) throw new Error('Machine Identity not found');
    return identity;
  }

  /**
   * Check if a set of scopes includes the required scope.
   * Scope format: "environment:action" (e.g., "dev:read", "prod:write")
   */
  static canAccess(scopes: string[], requiredScope: string): boolean {
    // Direct match
    if (scopes.includes(requiredScope)) return true;

    // Wildcard: "*:read" allows all envs for read
    const [reqEnv, reqAction] = requiredScope.split(':');
    for (const scope of scopes) {
      const [env, action] = scope.split(':');
      if (env === '*' && action === reqAction) return true;
      if (env === reqEnv && action === '*') return true;
      if (env === '*' && action === '*') return true;
    }

    return false;
  }
}

export const machineIdentityService = new MachineIdentityService();
