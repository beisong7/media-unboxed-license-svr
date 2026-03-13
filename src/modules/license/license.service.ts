import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import {
  EncryptionService,
  LicensePayload,
} from '../encryption/encryption.service';
import { License, CreateLicenseInput, Activation, DeviceInfo } from './models';
import { ErrorCode } from '../../common/helpers/http-response.helper';
import { v4 as uuidv4 } from 'uuid';

export interface ValidationResult {
  valid: boolean;
  licenseId: string;
  licensedTo: string;
  features: string[];
  expiresAt: string;
  offlineGraceDays: number;
  devicesUsed: number;
  maxDevices: number;
}

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly defaultOfflineGraceDays: number;

  constructor(
    private databaseService: DatabaseService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {
    this.defaultOfflineGraceDays = this.configService.get<number>(
      'license.defaultOfflineGraceDays',
      180,
    );
  }

  /**
   * Generate a new license ID
   */
  private generateLicenseId(): string {
    const year = new Date().getFullYear();
    const random = uuidv4().substring(0, 8).toUpperCase();
    return `LIC-${year}-${random}`;
  }

  /**
   * Create a new license and return the encrypted key
   */
  async createLicense(
    input: CreateLicenseInput,
  ): Promise<{ license: License; encryptedKey: string }> {
    const licenseId = input.licenseId || this.generateLicenseId();
    const features = input.features || ['all'];
    const maxDevices = input.maxDevices || 1;
    const offlineGraceDays =
      input.offlineGraceDays || this.defaultOfflineGraceDays;

    // Create encrypted license key
    const payload: LicensePayload = {
      licenseId,
      licensedTo: input.licensedTo,
      email: input.email,
      features,
      maxDevices,
      offlineGraceDays,
      expiresAt: input.expiresAt.toISOString(),
    };

    const encryptedKey = this.encryptionService.encrypt(payload);

    // DEBUG: Log encryption details for troubleshooting
    this.logger.debug(`=== LICENSE CREATION DEBUG ===`);
    this.logger.debug(`Payload: ${JSON.stringify(payload, null, 2)}`);
    this.logger.debug(`Encrypted Key: ${encryptedKey}`);
    this.logger.debug(`Encrypted Key Length: ${encryptedKey.length}`);
    this.logger.debug(`==============================`);

    // Insert into database
    const result = await this.databaseService.query<any>(
      `INSERT INTO licenses (
        license_id, licensed_to, email, features, max_devices, 
        offline_grace_days, expires_at, license_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        licenseId,
        input.licensedTo,
        input.email,
        JSON.stringify(features),
        maxDevices,
        offlineGraceDays,
        input.expiresAt,
        encryptedKey,
      ],
    );

    const license = this.mapRowToLicense(result.rows[0]);

    this.logger.log(`Created license: ${licenseId}`);

    return { license, encryptedKey };
  }

  // ... (existing code)

  /**
   * Validate a license and register/update device activation
   */
  async validateLicense(
    encryptedKey: string,
    deviceInfo: DeviceInfo,
  ): Promise<ValidationResult> {
    // Step 1: Decrypt the license key
    const payload = this.encryptionService.decrypt(encryptedKey);

    if (!payload) {
      throw new HttpException(
        {
          message: 'Invalid license key',
          code: ErrorCode.LICENSE_DECRYPTION_FAILED,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Step 2: Get license from database
    const license = await this.getLicenseById(payload.licenseId);

    if (!license) {
      throw new HttpException(
        {
          message: 'License not found',
          code: ErrorCode.LICENSE_NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Step 3: Check if license is revoked
    if (license.revoked) {
      throw new HttpException(
        {
          message: 'License has been revoked',
          code: ErrorCode.LICENSE_REVOKED,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Step 4: Check if license is expired
    if (new Date() > license.expiresAt) {
      throw new HttpException(
        {
          message: 'License has expired',
          code: ErrorCode.LICENSE_EXPIRED,
          details: `License expired on ${license.expiresAt.toISOString()}`,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Step 5: Check device activation
    const existingActivation = await this.getActivation(
      license.licenseId,
      deviceInfo.machineId,
    );

    const activationCount = await this.getActivationCount(license.licenseId);

    if (existingActivation) {
      // Update last seen for existing device
      await this.updateLastSeen(
        license.licenseId,
        deviceInfo.machineId,
        deviceInfo,
      );

      this.logger.log(
        `License ${license.licenseId} validated for existing device ${deviceInfo.machineId}`,
      );
    } else {
      // Check device limit for new device
      if (activationCount >= license.maxDevices) {
        throw new HttpException(
          {
            message: 'Device limit reached',
            code: ErrorCode.LICENSE_DEVICE_LIMIT,
            details: `Maximum of ${license.maxDevices} devices already activated`,
          },
          HttpStatus.FORBIDDEN,
        );
      }

      // Register new device
      await this.createActivation(license.licenseId, deviceInfo);

      this.logger.log(
        `License ${license.licenseId} activated on new device ${deviceInfo.machineId}`,
      );
    }

    const newActivationCount = existingActivation
      ? activationCount
      : activationCount + 1;

    return {
      valid: true,
      licenseId: license.licenseId,
      licensedTo: license.licensedTo,
      features: license.features,
      expiresAt: license.expiresAt.toISOString(),
      offlineGraceDays: license.offlineGraceDays,
      devicesUsed: newActivationCount,
      maxDevices: license.maxDevices,
    };
  }

  /**
   * Get license by ID
   */
  async getLicenseById(licenseId: string): Promise<License | null> {
    const result = await this.databaseService.query<any>(
      'SELECT * FROM licenses WHERE license_id = $1',
      [licenseId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToLicense(result.rows[0]);
  }

  /**
   * Get all licenses with activation counts
   */
  async getAllLicenses(): Promise<(License & { activationCount: number })[]> {
    const result = await this.databaseService.query<any>(
      `SELECT l.*, COUNT(a.id) as activation_count
       FROM licenses l
       LEFT JOIN activations a ON l.license_id = a.license_id
       GROUP BY l.id
       ORDER BY l.created_at DESC`,
    );

    return result.rows.map((row) => ({
      ...this.mapRowToLicense(row),
      activationCount: parseInt(row.activation_count, 10),
    }));
  }

  /**
   * Get all activations for a license
   */
  async getActivations(licenseId: string): Promise<Activation[]> {
    const result = await this.databaseService.query<any>(
      'SELECT * FROM activations WHERE license_id = $1 ORDER BY activated_at DESC',
      [licenseId],
    );

    return result.rows.map(this.mapRowToActivation);
  }

  /**
   * Get specific activation
   */
  async getActivation(
    licenseId: string,
    machineId: string,
  ): Promise<Activation | null> {
    const result = await this.databaseService.query<any>(
      'SELECT * FROM activations WHERE license_id = $1 AND machine_id = $2',
      [licenseId, machineId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToActivation(result.rows[0]);
  }

  /**
   * Get activation count for a license
   */
  async getActivationCount(licenseId: string): Promise<number> {
    const result = await this.databaseService.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM activations WHERE license_id = $1',
      [licenseId],
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create a new activation record
   */
  async createActivation(
    licenseId: string,
    deviceInfo: DeviceInfo,
  ): Promise<Activation> {
    const result = await this.databaseService.query<any>(
      `INSERT INTO activations (
        license_id, machine_id, ip_address, timezone, user_agent,
        platform, os_version, app_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        licenseId,
        deviceInfo.machineId,
        deviceInfo.ipAddress || null,
        deviceInfo.timezone || null,
        deviceInfo.userAgent || null,
        deviceInfo.platform || null,
        deviceInfo.osVersion || null,
        deviceInfo.appVersion || null,
      ],
    );

    return this.mapRowToActivation(result.rows[0]);
  }

  /**
   * Update last seen timestamp and device info
   */
  async updateLastSeen(
    licenseId: string,
    machineId: string,
    deviceInfo: DeviceInfo,
  ): Promise<void> {
    await this.databaseService.query(
      `UPDATE activations SET 
        last_seen_at = NOW(),
        ip_address = COALESCE($3, ip_address),
        timezone = COALESCE($4, timezone),
        user_agent = COALESCE($5, user_agent),
        platform = COALESCE($6, platform),
        os_version = COALESCE($7, os_version),
        app_version = COALESCE($8, app_version)
      WHERE license_id = $1 AND machine_id = $2`,
      [
        licenseId,
        machineId,
        deviceInfo.ipAddress,
        deviceInfo.timezone,
        deviceInfo.userAgent,
        deviceInfo.platform,
        deviceInfo.osVersion,
        deviceInfo.appVersion,
      ],
    );
  }

  /**
   * Revoke a device activation
   */
  async revokeActivation(
    licenseId: string,
    machineId: string,
  ): Promise<boolean> {
    const result = await this.databaseService.query(
      'DELETE FROM activations WHERE license_id = $1 AND machine_id = $2',
      [licenseId, machineId],
    );

    return result.rowCount > 0;
  }

  /**
   * Revoke a license
   */
  async revokeLicense(licenseId: string): Promise<boolean> {
    const result = await this.databaseService.query(
      `UPDATE licenses SET revoked = true, revoked_at = NOW(), updated_at = NOW()
       WHERE license_id = $1`,
      [licenseId],
    );

    return result.rowCount > 0;
  }

  /**
   * Map database row to License model
   */
  private mapRowToLicense(row: any): License {
    return {
      id: row.id,
      licenseId: row.license_id,
      licenseKey: row.license_key,
      licensedTo: row.licensed_to,
      email: row.email,
      features:
        typeof row.features === 'string'
          ? JSON.parse(row.features)
          : row.features,
      maxDevices: row.max_devices,
      offlineGraceDays: row.offline_grace_days,
      expiresAt: new Date(row.expires_at),
      revoked: row.revoked,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map database row to Activation model
   */
  private mapRowToActivation(row: any): Activation {
    return {
      id: row.id,
      licenseId: row.license_id,
      machineId: row.machine_id,
      ipAddress: row.ip_address,
      timezone: row.timezone,
      userAgent: row.user_agent,
      platform: row.platform,
      osVersion: row.os_version,
      appVersion: row.app_version,
      activatedAt: new Date(row.activated_at),
      lastSeenAt: new Date(row.last_seen_at),
    };
  }
}
