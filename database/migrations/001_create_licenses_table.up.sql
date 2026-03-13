-- Migration: 001_create_licenses_table
-- Description: Create the licenses table for storing license records

CREATE TABLE licenses (
    id SERIAL PRIMARY KEY,
    license_id VARCHAR(50) UNIQUE NOT NULL,
    licensed_to VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    features JSONB DEFAULT '["all"]',
    max_devices INTEGER DEFAULT 1,
    offline_grace_days INTEGER DEFAULT 180,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_licenses_license_id ON licenses(license_id);
CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_licenses_expires_at ON licenses(expires_at);
