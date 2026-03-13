/**
 * Standard API Response Structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: string;
  };
  meta: {
    serverTime: string;
  };
}

/**
 * Error codes used throughout the application
 */
export enum ErrorCode {
  // License errors
  LICENSE_INVALID = 'LICENSE_INVALID',
  LICENSE_NOT_FOUND = 'LICENSE_NOT_FOUND',
  LICENSE_EXPIRED = 'LICENSE_EXPIRED',
  LICENSE_REVOKED = 'LICENSE_REVOKED',
  LICENSE_DEVICE_LIMIT = 'LICENSE_DEVICE_LIMIT',
  LICENSE_DECRYPTION_FAILED = 'LICENSE_DECRYPTION_FAILED',

  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
}

/**
 * HTTP Response Helper - Creates standardized API responses
 */
export class HttpResponse {
  /**
   * Create a success response
   */
  static success<T>(message: string, data?: T): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      meta: {
        serverTime: new Date().toISOString(),
      },
    };
  }

  /**
   * Create an error response
   */
  static error(
    message: string,
    code: ErrorCode | string,
    details?: string,
  ): ApiResponse {
    return {
      success: false,
      message,
      error: {
        code,
        details,
      },
      meta: {
        serverTime: new Date().toISOString(),
      },
    };
  }
}
