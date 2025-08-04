export interface ValidationError {
  field: "key" | "value" | "note" | "projectId";
  message: string;
  code?: string;
}


export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}


export interface Secret {
  id?: string;
  key: string;
  value: string;
  note?: string;
  projectId: string;
  creationDate?: string;
  revisionDate?: string;
}


export interface Project {
  id: string;
  name: string;
  organizationId?: string;
  creationDate?: string;
  revisionDate?: string;
}


export interface CLIResult {
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
}


export interface AuthStatus {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
}


export interface Config {
  cliPath?: string;
  timeout?: number;
  retryAttempts?: number;
}