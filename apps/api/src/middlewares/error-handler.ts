import { Request, Response, NextFunction } from 'express';

/**
 * Global Error Handler — Sanitized for Production
 *
 * Design Constraints: Explicitly restricts egress of stack trace material,
 * underlying system diagnostics, database schema structure, or Prisma ORM
 * All errors are logged server-side only.
 */
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // ── SERVER-SIDE ONLY LOGGING ────────────────────────────────────────────
  // Log a sanitized version — never log request bodies (may contain secrets)
  console.error('[ErrorHandler]', {
    message: err.message,
    type: err.type,
    code: err.code,
    // Only include stack in non-production for debugging
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });

  // ── HANDLE KNOWN ERROR TYPES ────────────────────────────────────────────

  // Payload Too Large (body exceeds limit)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
    });
  }

  // Malformed JSON in request body
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Bad Request: Invalid JSON format',
    });
  }

  // CORS rejection
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({
      error: 'Forbidden: Origin not allowed',
    });
  }

  // Prisma / Database errors — NEVER expose to client
  if (err.code && err.code.startsWith('P')) {
    return res.status(500).json({
      error: 'Internal Server Error',
    });
  }

  // ── GENERIC FALLBACK ────────────────────────────────────────────────────
  // Standardized fallback mechanism mitigating disclosure vectors. Explicit avoidance
  // of appending err.message, err.stack, err.code, or associated diagnostics.
  res.status(500).json({
    error: 'Internal Server Error',
  });
};
