#!/usr/bin/env bash
# ============================================================
# Bastion Vault — Generate Secure Secrets for Production
# ============================================================
# Usage: bash scripts/generate-secrets.sh
#
# Generates cryptographically secure values for:
#   - JWT_SECRET
#   - JWT_REFRESH_SECRET
#   - ENCRYPTION_MASTER_KEY
#   - POSTGRES_PASSWORD
# ============================================================

set -euo pipefail

echo "-----------------------------------------------------------"
echo "Bastion Vault - Production Secrets Generator"
echo "-----------------------------------------------------------"
echo ""
echo "Add these to your .env or Docker Compose environment:"
echo ""
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo ""
echo "-----------------------------------------------------------"
echo "WARNING: DO NOT commit these values to version control."
echo "-----------------------------------------------------------"
