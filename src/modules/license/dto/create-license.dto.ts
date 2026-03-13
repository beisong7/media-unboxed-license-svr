import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateLicenseDto {
  @IsString()
  licensedTo: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDevices?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  offlineGraceDays?: number;

  @IsDateString()
  expiresAt: string;
}
