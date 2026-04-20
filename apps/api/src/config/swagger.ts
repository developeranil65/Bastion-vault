import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Bastion Vault API',
      version: '1.0.0',
      description: `
# Bastion Vault — Open Source Secrets Management Platform

Zero-trust, multi-tenant secrets management with envelope encryption (AES-256-GCM), 
RBAC, HMAC-chained audit logging, and Machine Identity Passports.

## Authentication

Bastion Vault supports two authentication methods:

### 1. Bearer JWT (Human Users)
Obtain a JWT via the \`/api/v1/auth/login\` endpoint (email + OTP flow).
Include it in the \`Authorization: Bearer <token>\` header.

### 2. Machine Identity Passport (CLI / Services)  
Create a Machine Identity via \`POST /api/v1/identities/{tenantId}/passports\` (admin only).
The raw token is shown **once**. Use it in the \`X-Passport-Token\` header.

## Tenant Isolation
All data is scoped to a Tenant. The \`tenantId\` is embedded in the JWT and validated 
on every request. Cross-tenant access is always denied.

## Environment Scoping
Secrets are scoped to environments: \`dev\`, \`staging\`, \`prod\`.
Machine Identities use scope strings like \`"dev:read"\`, \`"prod:write"\`, \`"*:read"\`.
`,
      contact: {
        name: 'Bastion Vault Team',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from POST /api/v1/auth/login',
        },
        passportAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Passport-Token',
          description: 'Machine Identity Passport token. Created via POST /api/v1/identities/{tenantId}/passports (admin only). Token is shown ONCE at creation time.',
        },
      },
      schemas: {
        // ─── Enums ──────────────────────────────────────────────────────────
        Environment: {
          type: 'string',
          enum: ['dev', 'staging', 'prod'],
          description: 'Environment scope for secrets',
          example: 'dev',
        },
        Role: {
          type: 'string',
          enum: ['OWNER', 'ADMIN', 'USER', 'SERVICE'],
          description: 'User role for RBAC',
        },

        // ─── Auth ───────────────────────────────────────────────────────────
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', minLength: 8, example: 'secureP@ss123' },
            tenantName: {
              type: 'string',
              description: 'Optional workspace name. Auto-generated from email if omitted.',
              example: 'Acme Corp',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'otp'],
          properties: {
            email: { type: 'string', format: 'email' },
            otp: { type: 'string', example: '123456' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            accessToken: { type: 'string', description: 'JWT access token (30m TTL)' },
            refreshToken: { type: 'string', description: 'JWT refresh token (7d TTL)' },
            message: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string', format: 'email' },
                role: { type: 'string' },
                tenantId: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
        OTPRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },

        // ─── Secrets ────────────────────────────────────────────────────────
        Secret: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'DATABASE_URL' },
            version: { type: 'integer', example: 1 },
            environment: { $ref: '#/components/schemas/Environment' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          description: 'Secret metadata. NEVER includes the encrypted or plaintext value.',
        },
        CreateSecretRequest: {
          type: 'object',
          required: ['name', 'value'],
          properties: {
            name: { type: 'string', minLength: 1, example: 'API_KEY' },
            value: { type: 'string', minLength: 1, example: 'sk-abc123...' },
            metadata: {
              type: 'object',
              additionalProperties: true,
              example: { team: 'backend', service: 'payment-api' },
            },
          },
        },
        SecretValueResponse: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              description: 'Decrypted secret value. Exists only in RAM — never cached or logged.',
            },
          },
        },
        RotateSecretRequest: {
          type: 'object',
          properties: {
            newValue: {
              type: 'string',
              description: 'Optional new plaintext value. If omitted, the existing value is re-encrypted with a new DEK.',
            },
          },
        },

        // ─── Machine Identities ─────────────────────────────────────────────
        CreatePassportRequest: {
          type: 'object',
          required: ['name', 'scopes'],
          properties: {
            name: {
              type: 'string',
              example: 'Acme Prod Payment Service',
              description: 'Human-readable name for this Machine Identity',
            },
            scopes: {
              type: 'array',
              items: { type: 'string' },
              example: ['prod:read', 'dev:read'],
              description: 'Access scopes in "env:action" format. Wildcard: "*:read"',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Optional expiry. Defaults to 30 days.',
            },
          },
        },
        PassportResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'Raw passport token — shown ONCE. Save immediately.',
              example: 'bv_a1b2c3d4e5f6...',
            },
            tenantId: { type: 'string', format: 'uuid' },
            identityId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            scopes: {
              type: 'array',
              items: { type: 'string' },
            },
            apiUrl: { type: 'string', format: 'uri' },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        MachineIdentity: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            scopes: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
            revokedAt: { type: 'string', format: 'date-time', nullable: true },
          },
          description: 'Machine Identity metadata. NEVER includes the tokenHash.',
        },

        // ─── Service Tokens ─────────────────────────────────────────────────
        ServiceTokenRequest: {
          type: 'object',
          required: ['serviceId'],
          properties: {
            serviceId: { type: 'string', example: 'my-backend-service' },
            allowedIps: {
              type: 'array',
              items: { type: 'string' },
              example: ['10.0.0.0/8'],
            },
          },
        },

        // ─── Common ─────────────────────────────────────────────────────────
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
