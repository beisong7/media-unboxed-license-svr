-- Migration: 002_create_activations_table (DOWN)
-- Description: Drop the activations table

DROP INDEX IF EXISTS idx_activations_last_seen;
DROP INDEX IF EXISTS idx_activations_machine_id;
DROP INDEX IF EXISTS idx_activations_license_id;
DROP TABLE IF EXISTS activations;
