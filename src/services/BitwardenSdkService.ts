import { BitwardenClient, LogLevel, ClientSettings, DeviceType } from '@bitwarden/sdk-napi';
import { Secret, Project } from '../types';

export class BitwardenSdkService {
  private client: BitwardenClient | null = null;
  private isAuthenticated = false;
  private organizationId: string | null = null;

  constructor() {
    const settings: ClientSettings = {
      apiUrl: 'https://api.bitwarden.com',
      identityUrl: 'https://identity.bitwarden.com',
      userAgent: 'Bitwarden Secrets Explorer VSCode Extension',
      deviceType: DeviceType.SDK
    };
    
    this.client = new BitwardenClient(settings, LogLevel.Info);
    

  }

  private isUuid(v: string | null | undefined): v is string {
    if (!v) {
      return false;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(v);
  }


  private extractOrganizationIdFromToken(accessToken: string): string | null {
    try {
      const parts = accessToken.split('.');
      if (parts.length >= 3) {
        const potentialOrgId = parts[1];
        if (this.isUuid(potentialOrgId)) {
          return potentialOrgId;
        }
      }
      if (parts.length >= 2) {
        const potentialOrgId = parts[0];
        if (this.isUuid(potentialOrgId)) {
          return potentialOrgId;
        }
      }
      return null;
    } catch (error) {
      console.error('Error extracting organization ID from token:', error);
      return null;
    }
  }

  private async runCommand(command: any): Promise<any> {
    if (!this.client) {
      throw new Error('SDK client not initialized');
    }
    
    const response = await this.client.client.runCommand(JSON.stringify(command));
    const parsed = JSON.parse(response);
    
    if (!parsed.success) {
      throw new Error(`Server returned error: ${parsed.errorMessage}`);
    }
    
    return parsed;
  }



  async authenticate(accessToken: string): Promise<void> {
    if (!this.client) {
      throw new Error('SDK client not initialized');
    }

    try {
      await this.client!.auth().loginAccessToken(accessToken);
      this.isAuthenticated = true;
    } catch (error) {
      this.isAuthenticated = false;
      const hint = ' Verify the access token belongs to an organization with Secrets Manager and that the token has the correct scope.';
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}.${hint}`);
    }
  }

  async testSdkAvailability(): Promise<boolean> {
    try {
      if (!this.client) {
        this.client = new BitwardenClient(undefined, LogLevel.Info);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  isClientAuthenticated(): boolean {
    return this.isAuthenticated && this.client !== null;
  }

  setOrganizationId(orgId: string): void {
    if (this.isUuid(orgId)) {
      this.organizationId = orgId;
    } else {
      throw new Error('Invalid organization ID format. Must be a valid UUID.');
    }
  }


  getOrganizationId(): string | null {
    return this.organizationId;
  }

  async listProjects(): Promise<Project[]> {
    if (!this.isClientAuthenticated()) {
      throw new Error('Client not authenticated');
    }

    const orgId = this.organizationId;
    if (!orgId) {
      throw new Error('Organization ID not available. Please ensure you are using a valid organization access token.');
    }

    try {
      const command = { projects: { list: { organizationId: orgId } } };
      const parsedResponse = await this.runCommand(command);
      
      if (!parsedResponse.success) {
        throw new Error(`Failed to list projects: ${parsedResponse.errorMessage}`);
      }
      
      const projects = parsedResponse.data?.data || parsedResponse.data || [];
      
      if (!Array.isArray(projects)) {
        throw new Error('Invalid response format: projects data is not an array');
      }
      
      return projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        organizationId: p.organizationId
      }));
    } catch (error) {
      throw error;
    }
  }

  async listSecrets(projectId?: string): Promise<Secret[]> {
    if (!this.isClientAuthenticated()) {
      throw new Error('Client not authenticated');
    }

    if (!this.isUuid(this.organizationId)) {
      throw new Error('No valid organization ID available. Please authenticate with an organization access token.');
    }

    try {
      const orgId = this.organizationId!;
      const listCmd = { secrets: { list: { organizationId: orgId } } };
      const listRes = await this.runCommand(listCmd);

      const secretIdentifiers = (listRes?.data?.data || listRes?.data || []);

      const detailedSecrets = await Promise.all(
        (secretIdentifiers as any[]).map(async (secretIdentifier: any) => {
          const getCmd = { secrets: { get: { id: secretIdentifier.id } } };
          const getRes = await this.runCommand(getCmd);

          const fullSecret = getRes?.data || getRes || {};
          return {
              id: fullSecret.id,
              key: fullSecret.key,
              value: fullSecret.value,
              note: fullSecret.note || '',
              projectId: fullSecret.projectId || '',
              creationDate: fullSecret.creationDate ? new Date(fullSecret.creationDate).toISOString() : undefined,
              revisionDate: fullSecret.revisionDate ? new Date(fullSecret.revisionDate).toISOString() : undefined
            } as Secret;
        })
      );
      
      if (projectId) {
        return detailedSecrets.filter(secret => secret.projectId === projectId);
      }
      
      return detailedSecrets;
    } catch (error) {
      throw new Error(`Failed to list secrets: ${error}`);
    }
  }

  async getSecret(secretId: string): Promise<Secret> {
    if (!this.isClientAuthenticated()) {
      throw new Error('Client not authenticated');
    }

    if (!this.organizationId) {
      throw new Error('Organization ID not available. Please ensure you are using a valid organization access token.');
    }

    try {
      const cmd = { secrets: { get: { id: secretId } } };
      const res = await this.runCommand(cmd);

      const response = res?.data || res || {};
      return {
         id: response.id,
         key: response.key,
         value: response.value,
         note: response.note || '',
         projectId: response.projectId || '',
         creationDate: response.creationDate ? new Date(response.creationDate).toISOString() : undefined,
         revisionDate: response.revisionDate ? new Date(response.revisionDate).toISOString() : undefined
       };
    } catch (error) {
      throw new Error(`Failed to get secret: ${error}`);
    }
  }

  async createSecret(secret: {
    key: string;
    value: string;
    note: string;
    projectId: string;
  }): Promise<Secret> {
    if (!this.isClientAuthenticated()) {
      throw new Error('Client not authenticated');
    }

    if (!this.isUuid(this.organizationId)) {
      throw new Error('No valid organization ID available. Please authenticate with an organization access token.');
    }

    try {
      const orgId = this.organizationId!;
      const cmd = { secrets: { create: { organizationId: orgId, key: secret.key, value: secret.value, note: secret.note, projectIds: [secret.projectId] } } };
      const res = await this.runCommand(cmd);

      const response = res?.data || res || {};
      return {
        id: response.id,
        key: response.key,
        value: response.value,
        note: response.note || '',
        projectId: response.projectId || '',
        creationDate: response.creationDate ? new Date(response.creationDate).toISOString() : undefined,
        revisionDate: response.revisionDate ? new Date(response.revisionDate).toISOString() : undefined
      } as Secret;
    } catch (error) {
      throw new Error(`Failed to create secret: ${error}`);
    }
  }

  async updateSecret(secret: {
    id: string;
    key: string;
    value: string;
    note: string;
    projectId: string;
  }): Promise<Secret> {
    if (!this.isClientAuthenticated()) {
      throw new Error('Client not authenticated');
    }

    if (!this.organizationId) {
      throw new Error('Organization ID not available. Please ensure you are using a valid organization access token.');
    }

    if (!secret?.id) {
      throw new Error('Secret ID is required for update');
    }

    try {
      const orgId = this.organizationId!;
      const cmd = { secrets: { update: { organizationId: orgId, id: secret.id, key: secret.key, value: secret.value, note: secret.note, projectIds: [secret.projectId] } } };
      const res = await this.runCommand(cmd);

      const response = res?.data || res || {};
      return {
        id: response.id,
        key: response.key,
        value: response.value,
        note: response.note || '',
        projectId: response.projectId || '',
        creationDate: response.creationDate ? new Date(response.creationDate).toISOString() : undefined,
        revisionDate: response.revisionDate ? new Date(response.revisionDate).toISOString() : undefined
      } as Secret;
    } catch (error) {
      throw new Error(`Failed to update secret: ${error}`);
    }
  }

  async deleteSecret(secretId: string): Promise<void> {
    if (!this.isClientAuthenticated()) {
      throw new Error('Client not authenticated');
    }

    if (!this.organizationId) {
      throw new Error('Organization ID not available. Please ensure you are using a valid organization access token.');
    }

    if (!secretId) {
      throw new Error('Secret ID is required for delete');
    }

    try {
      const cmd = { secrets: { delete: { ids: [secretId] } } };
      const res = await this.runCommand(cmd);


      const ok = res?.success ?? true;
      if (!ok) {
        const msg = res?.errorMessage || res?.error || 'Unknown error';
        throw new Error(`Delete failed: ${msg}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete secret: ${error}`);
    }
  }

  async createProject(name: string): Promise<Project> {
    if (!this.isClientAuthenticated()) {
      throw new Error('Client not authenticated');
    }

    if (!this.isUuid(this.organizationId)) {
      throw new Error('No valid organization ID available. Please authenticate with an organization access token.');
    }

    if (!name || name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    try {
      const orgId = this.organizationId!;
      const cmd = { projects: { create: { organizationId: orgId, name: name.trim() } } };
      const res = await this.runCommand(cmd);

      const response = res?.data || res || {};
      return {
        id: response.id,
        name: response.name,
        organizationId: response.organizationId,
        creationDate: response.creationDate ? new Date(response.creationDate).toISOString() : undefined,
        revisionDate: response.revisionDate ? new Date(response.revisionDate).toISOString() : undefined
      } as Project;
    } catch (error) {
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  async updateProject(projectId: string, name: string): Promise<Project> {
    if (!this.isClientAuthenticated()) {
      throw new Error('Client not authenticated');
    }

    if (!this.isUuid(this.organizationId)) {
      throw new Error('No valid organization ID available. Please authenticate with an organization access token.');
    }

    if (!projectId) {
      throw new Error('Project ID is required for update');
    }

    if (!name || name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    try {
      const orgId = this.organizationId!;
      const cmd = { projects: { update: { id: projectId, organizationId: orgId, name: name.trim() } } };
      const res = await this.runCommand(cmd);

      const response = res?.data || res || {};
      return {
        id: response.id,
        name: response.name,
        organizationId: response.organizationId,
        creationDate: response.creationDate ? new Date(response.creationDate).toISOString() : undefined,
        revisionDate: response.revisionDate ? new Date(response.revisionDate).toISOString() : undefined
      } as Project;
    } catch (error) {
      throw new Error(`Failed to update project: ${error}`);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    if (!this.isClientAuthenticated()) {
      throw new Error('Client not authenticated');
    }

    if (!this.organizationId) {
      throw new Error('Organization ID not available. Please ensure you are using a valid organization access token.');
    }

    if (!projectId) {
      throw new Error('Project ID is required for delete');
    }

    try {
      const cmd = { projects: { delete: { ids: [projectId] } } };
      const res = await this.runCommand(cmd);


      const ok = res?.success ?? true;
      if (!ok) {
        const msg = res?.errorMessage || res?.error || 'Unknown error';
        throw new Error(`Delete failed: ${msg}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete project: ${error}`);
    }
  }
}