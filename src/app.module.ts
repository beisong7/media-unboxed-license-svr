import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, databaseConfig, licenseConfig } from './config';
import { DatabaseModule } from './database';
import { EncryptionModule } from './modules/encryption';
import { LicenseModule } from './modules/license';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, licenseConfig],
      envFilePath: ['.env', '.env.example'],
    }),

    // Database
    DatabaseModule,

    // Modules
    EncryptionModule,
    LicenseModule,
  ],
})
export class AppModule {}
