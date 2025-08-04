import { ValidationError, ValidationResult, Secret } from '../types/index';
export class ValidationService {

  public static validateSecret(secret: Partial<Secret>): ValidationResult {
    const errors: ValidationError[] = [];


    if (!secret.key || secret.key.trim() === '') {
      errors.push({
        field: 'key',
        message: 'Secret key is required and cannot be empty',
        code: 'REQUIRED_FIELD'
      });
    } else if (secret.key.length > 100) {
      errors.push({
        field: 'key',
        message: 'Secret key cannot exceed 100 characters',
        code: 'MAX_LENGTH_EXCEEDED'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }


  public static validateSecretValue(value: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!value || value.trim() === '') {
      errors.push({
        field: 'value',
        message: 'Secret value is required and cannot be empty',
        code: 'REQUIRED_FIELD'
      });
    } else if (value.length > 10000) {
      errors.push({
        field: 'value',
        message: 'Secret value cannot exceed 10,000 characters',
        code: 'MAX_LENGTH_EXCEEDED'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }


  public static validateProjectId(projectId: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!projectId || projectId.trim() === '') {
      errors.push({
        field: 'projectId',
        message: 'Project ID is required',
        code: 'REQUIRED_FIELD'
      });
    } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      errors.push({
        field: 'projectId',
        message: 'Project ID must be a valid UUID',
        code: 'INVALID_FORMAT'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }


  public static validateNote(note?: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (note && note.length > 1000) {
      errors.push({
        field: 'note',
        message: 'Note cannot exceed 1,000 characters',
        code: 'MAX_LENGTH_EXCEEDED'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }


  public static validateCompleteSecret(secret: Partial<Secret>): ValidationResult {
    const allErrors: ValidationError[] = [];


    const keyValidation = this.validateSecret(secret);
    const valueValidation = this.validateSecretValue(secret.value || '');
    const projectValidation = this.validateProjectId(secret.projectId || '');
    const noteValidation = this.validateNote(secret.note);


    allErrors.push(...keyValidation.errors);
    allErrors.push(...valueValidation.errors);
    allErrors.push(...projectValidation.errors);
    allErrors.push(...noteValidation.errors);

    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }


  public static validateSecretKeyFormat(key: string): ValidationResult {
    const errors: ValidationError[] = [];


    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      errors.push({
        field: 'key',
        message: 'Secret key can only contain letters, numbers, underscores, and hyphens',
        code: 'INVALID_CHARACTERS'
      });
    }


    if (!/^[a-zA-Z_]/.test(key)) {
      errors.push({
        field: 'key',
        message: 'Secret key must start with a letter or underscore',
        code: 'INVALID_START_CHARACTER'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }


  public static validateSecretKeyUniqueness(
    key: string,
    existingKeys: string[],
    excludeKey?: string
  ): ValidationResult {
    const errors: ValidationError[] = [];

    const filteredKeys = excludeKey 
      ? existingKeys.filter(k => k !== excludeKey)
      : existingKeys;

    if (filteredKeys.includes(key)) {
      errors.push({
        field: 'key',
        message: 'A secret with this key already exists in the project',
        code: 'DUPLICATE_KEY'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}