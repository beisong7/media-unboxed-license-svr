# License Activation Documentation

## Overview

MediaUnboxed uses **AES-256-GCM symmetric encryption** for license keys:
- **Same key encrypts and decrypts** (symmetric)
- Keys stored in `.env` as comma-separated list for rotation

## .env Configuration

```env
# Comma-separated encryption keys (first = primary for new licenses)
# Supports multiple keys for backward compatibility during rotation
LICENSE_ENCRYPTION_KEYS=NewKey2024SecretKey32BytesLong!!,OldKey2023SecretKey32BytesLong!!

# License validation server URL
LICENSE_SERVER_URL=https://api.mediaunboxed.com
```

---

## License Key Structure

### Encrypted Key Format (Base64)
```
[IV: 16 bytes][AuthTag: 16 bytes][Encrypted Data: variable]
```

### Decrypted Payload (JSON)
```json
{
  "licenseId": "LIC-2024-001",
  "expiresAt": "2025-12-14T00:00:00Z",
  "licensedTo": "Organization Name",
  "email": "admin@organization.com",
  "features": ["all"]
}
```

---

## Encryption Code

```javascript
import crypto from 'crypto'

const IV_LENGTH = 16
const ALGORITHM = 'aes-256-gcm'

function encrypt(data, encryptionKey) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = crypto.scryptSync(encryptionKey, 'salt', 32)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const authTag = cipher.getAuthTag()
  
  // Format: IV + AuthTag + EncryptedData
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

function decrypt(encryptedBase64, encryptionKey) {
  const buffer = Buffer.from(encryptedBase64, 'base64')
  const iv = buffer.subarray(0, 16)
  const authTag = buffer.subarray(16, 32)
  const encrypted = buffer.subarray(32)
  
  const key = crypto.scryptSync(encryptionKey, 'salt', 32)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, null, 'utf8')
  decrypted += decipher.final('utf8')
  return JSON.parse(decrypted)
}
```

---

## Server API

### Endpoint
```
POST https://api.mediaunboxed.com/api/license/validate
```

### Request Payload
```json
{
  "licenseId": "LIC-2024-001",
  "machineId": "abc123def456...",
  "payloadHash": "sha256-hash-of-decrypted-json",
  "email": "admin@organization.com"
}
```

### Expected Response (Success)
```json
{
  "valid": true,
  "serverTime": "2024-12-14T15:00:00Z",
  "message": "License activated successfully"
}
```

### Expected Response (Failure)
```json
{
  "valid": false,
  "serverTime": "2024-12-14T15:00:00Z",
  "message": "License has been revoked"
}
```

---

## Key Rotation Workflow

1. **Add new key** to front of `LICENSE_ENCRYPTION_KEYS`:
   ```env
   LICENSE_ENCRYPTION_KEYS=NewKey,OldKey
   ```
2. **Deploy update** - app tries new key first, falls back to old
3. **Generate new licenses** using new key
4. **After transition**, optionally remove old key

---

## Generate Test Key

```bash
cd backend && node utils/generate-license-key.js
```

Output:
```
Encrypted License Key:
+imllU59T41X4452BJ/frZBhQp+16uJ1550Fgj...
```
