/**
 * Activation Model - Represents a device activation record
 */
export interface Activation {
  id: number;
  licenseId: string;
  machineId: string;
  ipAddress: string | null;
  timezone: string | null;
  userAgent: string | null;
  platform: string | null;
  osVersion: string | null;
  appVersion: string | null;
  activatedAt: Date;
  lastSeenAt: Date;
}

/**
 * Create Activation Input
 */
export interface CreateActivationInput {
  licenseId: string;
  machineId: string;
  ipAddress?: string;
  timezone?: string;
  userAgent?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
}

/**
 * Device Info from client request
 */
export interface DeviceInfo {
  machineId: string;
  ipAddress?: string;
  timezone?: string;
  userAgent?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
}
