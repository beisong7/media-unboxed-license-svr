import { registerAs } from '@nestjs/config';

export default registerAs('license', () => ({
  // Comma-separated encryption keys (first = primary for new licenses)
  encryptionKeys: (process.env.LICENSE_ENCRYPTION_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0),

  // API key for admin endpoints
  apiKey: process.env.API_KEY || '',

  // Default offline grace period in days
  defaultOfflineGraceDays: 180,
}));
