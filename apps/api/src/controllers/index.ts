// apps/api/src/controllers/index.ts
// Barrel export — one import for all controllers

import { Request, Response } from 'express';

export const healthController = async (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
};

// Re-export domain controllers
export * from './auth.controller';
export * from './secrets.controller';
export * from './organizations.controller';
export * from './machine-identity.controller';
