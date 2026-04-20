import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getAuthContext } from '../utils/request';
import { tenantIdSchema } from '../schemas/common-schema';
import { logger } from '../utils/logger';

function readLimit(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function readDate(raw: unknown): Date | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

/** GET /api/v1/projects/:projectId/audit */
export async function listProjectAudit(req: Request, res: Response): Promise<void> {
  const projectId = req.params.projectId;
  const projectCheck = tenantIdSchema.safeParse(projectId);
  if (!projectCheck.success) {
    res.status(400).json({ error: 'Invalid projectId' });
    return;
  }

  const authCtx = getAuthContext(req);
  if (authCtx.tenantId && authCtx.tenantId !== projectCheck.data) {
    res.status(403).json({ error: 'Cross-project access blocked' });
    return;
  }

  const limit = readLimit(req.query.limit);
  const action = typeof req.query.action === 'string' ? req.query.action.trim().toUpperCase() : undefined;
  const actorType = typeof req.query.actorType === 'string' ? req.query.actorType.trim().toUpperCase() : undefined;
  const from = readDate(req.query.from);
  const to = readDate(req.query.to);
  const createdAt =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  try {
    const entries = await prisma.auditLog.findMany({
      where: {
        tenantId: projectCheck.data,
        ...(action ? { action } : {}),
        ...(actorType ? { actorType } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        actorId: true,
        actorType: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        hmacHash: true,
        createdAt: true,
      },
    });

    res.json({
      data: entries,
      chainStatus: entries.length > 0 && entries.every(entry => !!entry.hmacHash) ? 'present' : 'empty',
      filters: {
        action: action || null,
        actorType: actorType || null,
        from: from?.toISOString() || null,
        to: to?.toISOString() || null,
      },
    });
  } catch (err) {
    logger.error('[Audit:List] Read failed', { projectId: projectCheck.data });
    res.status(500).json({ error: 'Failed to read audit logs' });
  }
}
