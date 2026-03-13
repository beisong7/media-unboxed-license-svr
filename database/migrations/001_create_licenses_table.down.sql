-- Migration: 001_create_licenses_table (DOWN)
-- Description: Drop the licenses table

DROP INDEX IF EXISTS idx_licenses_expires_at;
DROP INDEX IF EXISTS idx_licenses_email;
DROP INDEX IF EXISTS idx_licenses_license_id;
DROP TABLE IF EXISTS licenses;
