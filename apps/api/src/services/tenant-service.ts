/**
 * Tenant Service — Multi-Tenant SaaS Management
 *
 * Handles tenant lifecycle, membership queries, and billing tier enforcement.
 */

import prisma from '../lib/prisma';

export class TenantService {

  /**
   * Create a new Tenant.
   */
  async createTenant(data: { name: string; slug: string }) {
    return prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        settings: { defaultRegion: 'us-east-1' },
      },
    });
  }

  /**
   * Row-Level Security query — secrets for a specific tenant (metadata only).
   */
  async getSecretsForTenant(tenantId: string) {
    return prisma.secret.findMany({
      where: { tenantId, isDeleted: false },
      select: {
        id: true,
        name: true,
        version: true,
        environment: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Check if a user belongs to a tenant (via UserTenant junction).
   */
  async canUserAccessTenant(userId: string, tenantId: string): Promise<boolean> {
    const membership = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    return !!membership;
  }

  /**
   * Get all tenants a user belongs to.
   */
  async getUserTenants(userId: string) {
    return prisma.userTenant.findMany({
      where: { userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            billingTier: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Add a user to a tenant with a specific role.
   */
  async addUserToTenant(userId: string, tenantId: string, role: string = 'USER') {
    return prisma.userTenant.create({
      data: {
        userId,
        tenantId,
        role: role as any,
      },
    });
  }

  /**
   * Check tenant limits (billing tier enforcement).
   * Returns { allowed: boolean, reason?: string }
   */
  async checkSecretLimit(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxSecrets: true, billingTier: true },
    });

    if (!tenant) {
      return { allowed: false, reason: 'Tenant not found' };
    }

    const currentCount = await prisma.secret.count({
      where: { tenantId, isDeleted: false },
    });

    if (currentCount >= tenant.maxSecrets) {
      return {
        allowed: false,
        reason: `Secret limit reached (${currentCount}/${tenant.maxSecrets}). Upgrade your plan from ${tenant.billingTier} to increase limits.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check machine identity limit (billing tier enforcement).
   */
  async checkIdentityLimit(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxIdentities: true, billingTier: true },
    });

    if (!tenant) {
      return { allowed: false, reason: 'Tenant not found' };
    }

    const currentCount = await prisma.machineIdentity.count({
      where: { tenantId, isActive: true },
    });

    if (currentCount >= tenant.maxIdentities) {
      return {
        allowed: false,
        reason: `Machine Identity limit reached (${currentCount}/${tenant.maxIdentities}). Upgrade your plan from ${tenant.billingTier}.`,
      };
    }

    return { allowed: true };
  }
}

export const tenantService = new TenantService();
