import { z } from 'zod';

export const SecretSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Z0-9._:-]+$/i, 'Secret name contains invalid characters'),
  value: z.string().min(1).max(16384, 'Secret value is too large'),
  metadata: z.record(z.any()).default({}).refine((v) => JSON.stringify(v).length <= 8192, {
    message: 'Metadata is too large',
  }),
});

export const ZodSchema = {
  secret: {
    create: (data: any) => SecretSchema.parse(data),
  }
};
export const secretSchema = SecretSchema;
