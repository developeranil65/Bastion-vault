import { z } from 'zod';

export const tenantIdSchema = z.string().uuid('tenantId must be a valid UUID');

export const environmentSchema = z
  .string()
  .trim()
  .min(1, 'environment is required')
  .max(64, 'environment is too long')
  .regex(/^[a-z0-9][a-z0-9-_]*$/i, 'environment must contain only letters, numbers, hyphens, or underscores');

export const secretNameSchema = z
  .string()
  .trim()
  .min(1, 'secretName is required')
  .max(128, 'secretName is too long')
  .regex(/^[A-Z0-9._:-]+$/i, 'secretName contains invalid characters');

export const identityIdSchema = z.string().uuid('identityId must be a valid UUID');

export const emailSchema = z.string().trim().email('email must be valid');

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'password must be at least 8 characters'),
  tenantName: z.string().trim().min(2).max(80).optional(),
});

export const otpSendRequestSchema = z.object({
  email: emailSchema,
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().min(6).max(64),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().trim().min(20),
});

export const switchTenantRequestSchema = z.object({
  tenantId: tenantIdSchema,
});

export const inviteUserRequestSchema = z.object({
  email: emailSchema,
  role: z.enum(['USER', 'ADMIN']).optional(),
});

export const tenantSettingsSchema = z.object({
  defaultRegion: z.string().trim().min(2).max(50).optional(),
  mfaRequired: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440).optional(),
  allowMachineIdentities: z.boolean().optional(),
  auditRetentionDays: z.number().int().min(1).max(3650).optional(),
  secretGuardrails: z.object({
    requireOwnerMetadata: z.boolean().optional(),
    requireRotationDaysMetadata: z.boolean().optional(),
    requireClassificationMetadata: z.boolean().optional(),
    enforceProdCreateConfirmation: z.boolean().optional(),
    enforceProdRotateConfirmation: z.boolean().optional(),
    enforceProdDeleteTypedConfirmation: z.boolean().optional(),
  }).optional(),
}).strict();
