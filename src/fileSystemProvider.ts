import * as vscode from 'vscode';
import { BitwardenSdkService } from './services/BitwardenSdkService';


export class SecretDocument {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public key: string,
    public value: string,
    public note: string = '',
    public readonly creationDate?: Date,
    public readonly revisionDate?: Date
  ) {}


  toJSON(): string {
    return JSON.stringify({
      id: this.id,
      projectId: this.projectId,
      key: this.key,
      value: this.value,
      note: this.note
    }, null, 2);
  }


  static fromJSON(jsonStr: string): SecretDocument {
    const data = JSON.parse(jsonStr);
    return new SecretDocument(
      data.id,
      data.projectId,
      data.key,
      data.value,
      data.note || '',
      data.creationDate ? new Date(data.creationDate) : undefined,
      data.revisionDate ? new Date(data.revisionDate) : undefined
    );
  }


  validate(): string[] {
    const errors: string[] = [];
    
    if (!this.key || this.key.trim().length === 0) {
      errors.push('Secret key cannot be empty');
    }
    
    if (this.key && this.key.length > 200) {
      errors.push('Secret key cannot exceed 200 characters');
    }
    
    if (this.value && this.value.length > 10000) {
      errors.push('Secret value cannot exceed 10,000 characters');
    }
    
    if (this.note && this.note.length > 10000) {
      errors.push('Secret note cannot exceed 10,000 characters');
    }
    
    return errors;
  }
}


export class BitwardenFileSystemProvider implements vscode.FileSystemProvider {
  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private _bufferedEvents: vscode.FileChangeEvent[] = [];
  private _fireSoonHandle?: NodeJS.Timeout;
  private _cache = new Map<string, SecretDocument>();
  private sdkService: BitwardenSdkService;
  
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

  constructor(private context: vscode.ExtensionContext) {
    this.sdkService = new BitwardenSdkService();
  }


  clearCache(): void {
    this._cache.clear();
  }


  refresh(uri: vscode.Uri): void {
    this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
  }


  getDocument(uri: vscode.Uri): SecretDocument | undefined {
    return this._cache.get(uri.toString());
  }


  watch(_uri: vscode.Uri): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }


  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const path = uri.path;
    
    if (path === '/' || path === '/projects') {
      return {
        type: vscode.FileType.Directory,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 0
      };
    }
    
    if (path.startsWith('/projects/') && !path.includes('.json')) {
      const projectId = path.split('/')[2];
      try {
        await this._getSecretsForProject(projectId);
        return {
          type: vscode.FileType.Directory,
          ctime: Date.now(),
          mtime: Date.now(),
          size: 0
        };
      } catch (error) {
        throw vscode.FileSystemError.FileNotFound(uri);
      }
    }
    
    if (path.endsWith('.json')) {
      const cacheKey = path;
      if (this._cache.has(cacheKey)) {
        const secret = this._cache.get(cacheKey)!;
        return {
          type: vscode.FileType.File,
          ctime: secret.creationDate?.getTime() || Date.now(),
          mtime: secret.revisionDate?.getTime() || Date.now(),
          size: Buffer.byteLength(secret.toJSON(), 'utf8')
        };
      }
      
      const secret = await this._getSecretFromPath(path);
      
      if (secret) {
        return {
          type: vscode.FileType.File,
          ctime: secret.creationDate?.getTime() || Date.now(),
          mtime: secret.revisionDate?.getTime() || Date.now(),
          size: Buffer.byteLength(secret.toJSON(), 'utf8')
        };
      } else {
        const secretKey = this._getSecretKeyFromPath(path);
        const projectId = this._getProjectIdFromPath(path);
        const newSecret = new SecretDocument('', projectId, secretKey, '', '');
        return {
          type: vscode.FileType.File,
          ctime: Date.now(),
          mtime: Date.now(),
          size: Buffer.byteLength(newSecret.toJSON(), 'utf8')
        };
      }
    }

    throw vscode.FileSystemError.FileNotFound(uri);
  }


  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const path = uri.path;
    
    if (path === '/' || path === '/projects') {
      const projects = await this._getProjects();
      return projects.map(project => [project.id, vscode.FileType.Directory]);
    }
    
    if (path.startsWith('/projects/')) {
      const projectId = path.split('/')[2];
      const secrets = await this._getSecretsForProject(projectId);
      return secrets.map(secret => [`${secret.key}.json`, vscode.FileType.File]);
    }
    
    return [];
  }


  createDirectory(_uri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions('Cannot create directories in Bitwarden file system');
  }


  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const cacheKey = uri.toString();
    

    if (this._cache.has(cacheKey)) {
      const cachedSecret = this._cache.get(cacheKey)!;
      return Buffer.from(cachedSecret.toJSON(), 'utf8');
    }
    

    const secret = await this._getSecretFromPath(uri.path);
    
    let finalSecret: SecretDocument;
    if (!secret) {
      const secretKey = this._getSecretKeyFromPath(uri.path);
      const projectId = this._getProjectIdFromPath(uri.path);
      finalSecret = new SecretDocument('NEW_SECRET', projectId, secretKey || '', '', '');
    } else {
      finalSecret = secret;
    }
    
    this._cache.set(cacheKey, finalSecret);
    
    return Buffer.from(finalSecret.toJSON(), 'utf8');
  }


  async writeFile(uri: vscode.Uri, content: Uint8Array, _options: { create: boolean; overwrite: boolean }): Promise<void> {
    const contentStr = Buffer.from(content).toString('utf8');
    
    try {
      const secret = SecretDocument.fromJSON(contentStr);
      const errors = secret.validate();
      
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }
      

      const isNewSecret = !secret.id || secret.id === '' || secret.id === 'NEW_SECRET';
      
      const updatedSecret = await this._saveSecret(secret, isNewSecret);
      this._cache.set(uri.path, updatedSecret);
      

      if (isNewSecret && updatedSecret.id !== secret.id) {

        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
        

        setTimeout(() => {
          vscode.workspace.openTextDocument(uri).then(doc => {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
              doc.positionAt(0),
              doc.positionAt(doc.getText().length)
            );
            edit.replace(uri, fullRange, updatedSecret.toJSON());
            vscode.workspace.applyEdit(edit);
          });
        }, 100);
      } else {
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
      }
      
      vscode.window.showInformationMessage('Secret saved successfully to Bitwarden!');
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save secret: ${error}`);
      throw vscode.FileSystemError.Unavailable(`Failed to save secret: ${error}`);
    }
  }


  async delete(uri: vscode.Uri): Promise<void> {
    const secret = await this._getSecretFromPath(uri.path);
    if (!secret) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    
    await this._deleteSecret(secret.id);
    this._cache.delete(uri.path);
    
    this._fireSoon({ type: vscode.FileChangeType.Deleted, uri });
  }


  async rename(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {

    const secret = await this._getSecretFromPath(oldUri.path);
    if (!secret) {
      throw vscode.FileSystemError.FileNotFound(oldUri);
    }
    
    const newKey = this._getSecretKeyFromPath(newUri.path);
    secret.key = newKey;
    
    await this._saveSecret(secret, false);
    this._cache.delete(oldUri.path);
    this._cache.set(newUri.path, secret);
    
    this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: oldUri });
    this._fireSoon({ type: vscode.FileChangeType.Created, uri: newUri });
  }


  
  private async _getAccessToken(): Promise<string> {
    const token = await this.context.secrets.get('bitwardenAccessToken');
    if (!token) {
      throw new Error('Bitwarden access token not found');
    }
    return token;
  }

  private async _ensureOrganizationId(): Promise<void> {

    if (this.sdkService.getOrganizationId()) {
      return;
    }


    const storedOrgId = await this.context.secrets.get('bitwardenOrganizationId');
    if (storedOrgId) {
      try {
        this.sdkService.setOrganizationId(storedOrgId);
      } catch (error) {
        throw new Error(`Invalid stored organization ID: ${error}`);
      }
    } else {
      throw new Error('No valid organization ID available. Please authenticate with an organization access token.');
    }
  }

  private async _getProjects(): Promise<any[]> {
    const accessToken = await this._getAccessToken();
    

    if (!this.sdkService.isClientAuthenticated()) {
      await this.sdkService.authenticate(accessToken);
    }
    

    await this._ensureOrganizationId();
    
    const projects = await this.sdkService.listProjects();

    projects.sort((a: any, b: any) => a.name.localeCompare(b.name));
    
    return projects;
  }

  private async _getProjectByName(name: string): Promise<any | null> {
    const projects = await this._getProjects();
    return projects.find(p => p.name === name) || null;
  }

  private async _getSecretsForProject(projectId: string): Promise<SecretDocument[]> {
    const accessToken = await this._getAccessToken();
    

    if (!this.sdkService.isClientAuthenticated()) {
      await this.sdkService.authenticate(accessToken);
    }
    

    await this._ensureOrganizationId();
    
    const secrets = await this.sdkService.listSecrets(projectId);

    secrets.sort((a, b) => a.key.localeCompare(b.key));
    

    const secretDocuments = secrets.map(s => 
      new SecretDocument(
        s.id!,
        projectId,
        s.key,
        s.value || '',
        s.note || '',
        s.creationDate ? new Date(s.creationDate) : undefined,
        s.revisionDate ? new Date(s.revisionDate) : undefined
      )
    );
    
    return secretDocuments;
  }

  private async _getSecretFromPath(path: string): Promise<SecretDocument | null> {

    if (this._cache.has(path)) {
      return this._cache.get(path)!;
    }
    

    const parts = path.split('/');
    if (parts.length !== 4 || !parts[3].endsWith('.json')) {
      return null;
    }
    
    const projectId = parts[2];
    const secretKey = parts[3].replace('.json', '');
    

    const secrets = await this._getSecretsForProject(projectId);
    const secret = secrets.find(s => s.key === secretKey);
    
    if (secret) {
      this._cache.set(path, secret);
    }
    
    return secret || null;
  }

  private _getSecretKeyFromPath(path: string): string {
    const parts = path.split('/');
    return parts[3].replace('.json', '');
  }

  private _getProjectIdFromPath(path: string): string {
    const parts = path.split('/');
    return parts[2];
  }

  private async _saveSecret(secret: SecretDocument, isCreate: boolean): Promise<SecretDocument> {
    const accessToken = await this._getAccessToken();
    

    if (!this.sdkService.isClientAuthenticated()) {
      await this.sdkService.authenticate(accessToken);
    }
    

    await this._ensureOrganizationId();
    
    const isNewSecret = isCreate || !secret.id || secret.id === '' || secret.id === 'NEW_SECRET';
    
    if (isNewSecret) {

      const createdSecret = await this.sdkService.createSecret({
        key: secret.key,
        value: secret.value,
        note: secret.note,
        projectId: secret.projectId
      });
      
      return new SecretDocument(
          createdSecret.id!,
          secret.projectId,
          secret.key,
          secret.value,
          secret.note,
          createdSecret.creationDate ? new Date(createdSecret.creationDate) : new Date(),
          createdSecret.revisionDate ? new Date(createdSecret.revisionDate) : new Date()
        );
    } else {
      try {

        const updatedSecret = await this.sdkService.updateSecret({
          id: secret.id,
          key: secret.key,
          value: secret.value,
          note: secret.note,
          projectId: secret.projectId
        });
        
        return new SecretDocument(
          secret.id,
          secret.projectId,
          updatedSecret.key,
          updatedSecret.value,
          updatedSecret.note || '',
          updatedSecret.creationDate ? new Date(updatedSecret.creationDate) : secret.creationDate,
          updatedSecret.revisionDate ? new Date(updatedSecret.revisionDate) : new Date()
        );
      } catch (editError: any) {

        if (editError.message.includes('404') || editError.message.includes('not found')) {
          const createdSecret = await this.sdkService.createSecret({
            key: secret.key,
            value: secret.value,
            note: secret.note,
            projectId: secret.projectId
          });
          
          return new SecretDocument(
            createdSecret.id!,
            secret.projectId,
            createdSecret.key,
            createdSecret.value,
            createdSecret.note || '',
            createdSecret.creationDate ? new Date(createdSecret.creationDate) : new Date(),
            createdSecret.revisionDate ? new Date(createdSecret.revisionDate) : new Date()
          );
        } else {
          throw editError;
        }
      }
    }
  }

  private async _deleteSecret(secretId: string): Promise<void> {
    const accessToken = await this._getAccessToken();
    

    if (!this.sdkService.isClientAuthenticated()) {
      await this.sdkService.authenticate(accessToken);
    }
    

    await this._ensureOrganizationId();
    
    await this.sdkService.deleteSecret(secretId);
  }

  private _fireSoon(...events: vscode.FileChangeEvent[]): void {

    this._bufferedEvents.push(...events);
    
    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle);
    }
    
    this._fireSoonHandle = setTimeout(() => {

      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 5);
  }
}