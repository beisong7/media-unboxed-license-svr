/**
 * License Model - Represents a license record in the database
 */
export interface License {
  id: number;
  licenseId: string;
  licenseKey?: string; // Encrypted key (optional, may not be returned in all views)
  licensedTo: string;
  email: string;
  features: string[];
  maxDevices: number;
  offlineGraceDays: number;
  expiresAt: Date;
  revoked: boolean;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create License Input
 */
export interface CreateLicenseInput {
  licenseId?: string;
  licensedTo: string;
  email: string;
  features?: string[];
  maxDevices?: number;
  offlineGraceDays?: number;
  expiresAt: Date;
}

/**
 * License with activation count
 */
export interface LicenseWithActivations extends License {
  activationCount: number;
}
