// Error definitions and handling for the Bitwarden Secrets Explorer

/**
 * Error codes for different types of errors
 */
export const ERROR_CODES = {
  // CLI related errors
  CLI_NOT_FOUND: 'CLI_NOT_FOUND',
  CLI_TIMEOUT: 'CLI_TIMEOUT',
  CLI_AUTHENTICATION_FAILED: 'CLI_AUTHENTICATION_FAILED',
  CLI_NETWORK_ERROR: 'CLI_NETWORK_ERROR',
  CLI_UNKNOWN_ERROR: 'CLI_UNKNOWN_ERROR',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_SECRET_KEY: 'INVALID_SECRET_KEY',
  INVALID_SECRET_VALUE: 'INVALID_SECRET_VALUE',
  INVALID_PROJECT_ID: 'INVALID_PROJECT_ID',
  
  // File system errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Base error class for all application errors
 */
export class BitwardenError extends Error {
  public readonly code: ErrorCode;
  public readonly timestamp: Date;

  constructor(message: string, code: ErrorCode = ERROR_CODES.UNKNOWN_ERROR) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * CLI related errors
 */
export class CLIError extends BitwardenError {
  constructor(message: string, code: ErrorCode = ERROR_CODES.CLI_UNKNOWN_ERROR) {
    super(message, code);
  }
}

/**
 * Validation related errors
 */
export class ValidationError extends BitwardenError {
  public readonly field: string;

  constructor(field: string, message: string, code: ErrorCode = ERROR_CODES.VALIDATION_ERROR) {
    super(message, code);
    this.field = field;
  }
}

/**
 * File system related errors
 */
export class FileSystemError extends BitwardenError {
  public readonly path?: string;

  constructor(message: string, path?: string, code: ErrorCode = ERROR_CODES.FILE_NOT_FOUND) {
    super(message, code);
    this.path = path;
  }
}

/**
 * Authentication related errors
 */
export class AuthenticationError extends CLIError {
  constructor(message: string = 'Authentication failed') {
    super(message, ERROR_CODES.CLI_AUTHENTICATION_FAILED);
  }
}

/**
 * Network related errors
 */
export class NetworkError extends CLIError {
  constructor(message: string = 'Network error occurred') {
    super(message, ERROR_CODES.CLI_NETWORK_ERROR);
  }
}

/**
 * CLI timeout errors
 */
export class TimeoutError extends CLIError {
  constructor(message: string = 'Operation timed out') {
    super(message, ERROR_CODES.CLI_TIMEOUT);
  }
}

/**
 * CLI not found errors
 */
export class CLINotFoundError extends CLIError {
  constructor(message: string = 'Bitwarden CLI not found') {
    super(message, ERROR_CODES.CLI_NOT_FOUND);
  }
}

/**
 * Helper function to create appropriate error based on CLI output
 */
export function createCLIError(message: string, stderr?: string): CLIError {
  let code: ErrorCode = ERROR_CODES.CLI_UNKNOWN_ERROR;
  
  if (stderr) {
    const lowerStderr = stderr.toLowerCase();
    
    if (lowerStderr.includes('not found') || lowerStderr.includes('command not found')) {
      code = ERROR_CODES.CLI_NOT_FOUND;
    } else if (lowerStderr.includes('timeout') || lowerStderr.includes('timed out')) {
      code = ERROR_CODES.CLI_TIMEOUT;
    } else if (lowerStderr.includes('authentication') || lowerStderr.includes('unauthorized')) {
      code = ERROR_CODES.CLI_AUTHENTICATION_FAILED;
    } else if (lowerStderr.includes('network') || lowerStderr.includes('connection')) {
      code = ERROR_CODES.CLI_NETWORK_ERROR;
    }
  }
  
  return new CLIError(message, code);
}

/**
 * Helper function to check if an error is a specific type
 */
export function isErrorOfType(error: unknown, errorType: typeof BitwardenError): boolean {
  return error instanceof errorType;
}

/**
 * Helper function to get error code from any error
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof BitwardenError) {
    return error.code;
  }
  return ERROR_CODES.UNKNOWN_ERROR;
}