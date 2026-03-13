import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { LicenseService } from './license.service';
import { CreateLicenseDto, ValidateLicenseDto } from './dto';
import { ApiKeyGuard } from '../../common/guards';
import { HttpResponse } from '../../common/helpers';

@Controller('api/license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) { }

  /**
   * Get all licenses (Admin only)
   * GET /api/license
   */
  @Get()
  @UseGuards(ApiKeyGuard)
  async getAllLicenses() {
    const licenses = await this.licenseService.getAllLicenses();

    return HttpResponse.success('Licenses retrieved successfully', {
      licenses: licenses.map((l) => ({
        licenseId: l.licenseId,
        licensedTo: l.licensedTo,
        email: l.email,
        features: l.features,
        maxDevices: l.maxDevices,
        offlineGraceDays: l.offlineGraceDays,
        expiresAt: l.expiresAt.toISOString(),
        revoked: l.revoked,
        revokedAt: l.revokedAt?.toISOString() || null,
        createdAt: l.createdAt.toISOString(),
        devicesUsed: l.activationCount,
      })),
      total: licenses.length,
    });
  }

  /**
   * Validate a license and register device
   * POST /api/license/validate
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateLicense(
    @Body() dto: ValidateLicenseDto,
    @Req() request: Request,
  ) {
    const deviceInfo = {
      machineId: dto.machineId,
      ipAddress: this.getClientIp(request),
      timezone: dto.timezone,
      userAgent: request.headers['user-agent'],
      platform: dto.platform,
      osVersion: dto.osVersion,
      appVersion: dto.appVersion,
    };

    const result = await this.licenseService.validateLicense(
      dto.licenseKey,
      deviceInfo,
    );

    return HttpResponse.success('License validated successfully', result);
  }

  /**
   * Generate a new license (Admin only)
   * POST /api/license/generate
   */
  @Post('generate')
  @UseGuards(ApiKeyGuard)
  async generateLicense(@Body() dto: CreateLicenseDto) {
    const { license, encryptedKey } = await this.licenseService.createLicense({
      licensedTo: dto.licensedTo,
      email: dto.email,
      features: dto.features,
      maxDevices: dto.maxDevices,
      offlineGraceDays: dto.offlineGraceDays,
      expiresAt: new Date(dto.expiresAt),
    });

    return HttpResponse.success('License generated successfully', {
      licenseId: license.licenseId,
      licensedTo: license.licensedTo,
      email: license.email,
      features: license.features,
      maxDevices: license.maxDevices,
      offlineGraceDays: license.offlineGraceDays,
      expiresAt: license.expiresAt.toISOString(),
      encryptedKey,
    });
  }

  /**
   * Get activations for a license (Admin only)
   * GET /api/license/:licenseId/activations
   */
  @Get(':licenseId/activations')
  @UseGuards(ApiKeyGuard)
  async getActivations(@Param('licenseId') licenseId: string) {
    const activations = await this.licenseService.getActivations(licenseId);

    return HttpResponse.success('Activations retrieved successfully', {
      licenseId,
      activations: activations.map((a) => ({
        machineId: a.machineId,
        ipAddress: a.ipAddress,
        timezone: a.timezone,
        platform: a.platform,
        osVersion: a.osVersion,
        appVersion: a.appVersion,
        activatedAt: a.activatedAt.toISOString(),
        lastSeenAt: a.lastSeenAt.toISOString(),
      })),
      totalDevices: activations.length,
    });
  }

  /**
   * Revoke a device activation (Admin only)
   * DELETE /api/license/:licenseId/activations/:machineId
   */
  @Delete(':licenseId/activations/:machineId')
  @UseGuards(ApiKeyGuard)
  async revokeActivation(
    @Param('licenseId') licenseId: string,
    @Param('machineId') machineId: string,
  ) {
    const revoked = await this.licenseService.revokeActivation(
      licenseId,
      machineId,
    );

    if (!revoked) {
      return HttpResponse.error(
        'Activation not found',
        'NOT_FOUND',
        'No activation found for this device',
      );
    }

    return HttpResponse.success('Device activation revoked successfully', {
      licenseId,
      machineId,
    });
  }

  /**
   * Get license details (Admin only)
   * GET /api/license/:licenseId
   */
  @Get(':licenseId')
  @UseGuards(ApiKeyGuard)
  async getLicense(@Param('licenseId') licenseId: string) {
    const license = await this.licenseService.getLicenseById(licenseId);

    if (!license) {
      return HttpResponse.error(
        'License not found',
        'NOT_FOUND',
        'No license found with this ID',
      );
    }

    const activationCount =
      await this.licenseService.getActivationCount(licenseId);

    return HttpResponse.success('License retrieved successfully', {
      licenseId: license.licenseId,
      licenseKey: license.licenseKey, // Encrypted key
      licensedTo: license.licensedTo,
      email: license.email,
      features: license.features,
      maxDevices: license.maxDevices,
      offlineGraceDays: license.offlineGraceDays,
      expiresAt: license.expiresAt.toISOString(),
      revoked: license.revoked,
      revokedAt: license.revokedAt?.toISOString() || null,
      createdAt: license.createdAt.toISOString(),
      devicesUsed: activationCount,
    });
  }

  /**
   * Revoke a license (Admin only)
   * DELETE /api/license/:licenseId
   */
  @Delete(':licenseId')
  @UseGuards(ApiKeyGuard)
  async revokeLicense(@Param('licenseId') licenseId: string) {
    const revoked = await this.licenseService.revokeLicense(licenseId);

    if (!revoked) {
      return HttpResponse.error(
        'License not found',
        'NOT_FOUND',
        'No license found with this ID',
      );
    }

    return HttpResponse.success('License revoked successfully', {
      licenseId,
    });
  }

  /**
   * Extract client IP from request
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }
    return request.socket.remoteAddress || '';
  }
}
