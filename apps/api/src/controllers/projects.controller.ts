import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import prisma from '../lib/prisma';
import { getAuthContext } from '../utils/request';
import { logger } from '../utils/logger';

function slugifyProjectName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'project';
}

function uniqueSlug(base: string): string {
  return `${base}-${randomBytes(3).toString('hex')}`;
}

/** GET /api/v1/projects */
export async function listProjects(req: Request, res: Response): Promise<void> {
  const authCtx = getAuthContext(req);
  if (authCtx.actorType !== 'USER' || !authCtx.actorId) {
    res.status(403).json({ error: 'Only human users can list projects' });
    return;
  }

  try {
    const memberships = await prisma.userTenant.findMany({
      where: { userId: authCtx.actorId },
      select: {
        role: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      data: memberships.map(m => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role,
        createdAt: m.tenant.createdAt,
        updatedAt: m.tenant.updatedAt,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Failed to list projects' });
  }
}

/** POST /api/v1/projects */
export async function createProject(req: Request, res: Response): Promise<void> {
  const authCtx = getAuthContext(req);
  if (authCtx.actorType !== 'USER' || !authCtx.actorId) {
    res.status(403).json({ error: 'Only human users can create projects' });
    return;
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length < 2 || name.length > 80) {
    res.status(400).json({ error: 'name must be between 2 and 80 characters' });
    return;
  }

  const base = slugifyProjectName(name);

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug: uniqueSlug(base),
        settings: { defaultRegion: 'us-east-1' },
      },
    });

    await prisma.userTenant.create({
      data: {
        userId: authCtx.actorId,
        tenantId: tenant.id,
        role: 'OWNER',
      },
    });

    logger.audit('Project created', { projectId: tenant.id, userId: authCtx.actorId });

    res.status(201).json({
      project: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role: 'OWNER',
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'Project slug conflict. Retry request.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create project' });
  }
}

/** PATCH /api/v1/projects/:projectId */
export async function updateProject(req: Request, res: Response): Promise<void> {
  const projectId = req.params.projectId;
  const projectName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!projectName || projectName.length < 2 || projectName.length > 80) {
    res.status(400).json({ error: 'name must be between 2 and 80 characters' });
    return;
  }

  try {
    const updated = await prisma.tenant.update({
      where: { id: projectId },
      data: { name: projectName },
      select: { id: true, name: true, slug: true, updatedAt: true },
    });

    logger.audit('Project updated', { projectId: updated.id, name: updated.name });
    res.json({ project: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update project' });
  }
}
