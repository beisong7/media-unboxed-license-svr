import { IsString, IsOptional } from 'class-validator';

export class ValidateLicenseDto {
  @IsString()
  licenseKey: string;

  @IsString()
  machineId: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}
