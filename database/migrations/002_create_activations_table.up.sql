-- Migration: 002_create_activations_table
-- Description: Create the activations table for tracking device activations

CREATE TABLE activations (
    id SERIAL PRIMARY KEY,
    license_id VARCHAR(50) NOT NULL REFERENCES licenses(license_id) ON DELETE CASCADE,
    machine_id VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    timezone VARCHAR(100),
    user_agent TEXT,
    platform VARCHAR(100),
    os_version VARCHAR(100),
    app_version VARCHAR(50),
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(license_id, machine_id)
);

-- Indexes for common queries
CREATE INDEX idx_activations_license_id ON activations(license_id);
CREATE INDEX idx_activations_machine_id ON activations(machine_id);
CREATE INDEX idx_activations_last_seen ON activations(last_seen_at);
