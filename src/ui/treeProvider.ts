import * as vscode from 'vscode';
import { BitwardenSdkService } from '../services/BitwardenSdkService';
import { Project, Secret } from '../types';

/**
 * Represents an item in the Bitwarden secrets tree view
 */
export class BitwardenSecretItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'project' | 'secret',
    public readonly id?: string, // Bitwarden ID (project ID or secret ID)
    public readonly projectId?: string, // Project ID for secrets
  ) {
    super(label, collapsibleState);
    this.tooltip = description; // Show description on hover

    // Set context value for context menus
    this.contextValue = type;

    // Set icons
    if (type === 'project') {
      this.iconPath = new vscode.ThemeIcon('folder');
    } else if (type === 'secret') {
      this.iconPath = new vscode.ThemeIcon('key');
      // Set command for double-click behavior - use the HTML editor
      this.command = {
        command: 'bitwardenSecretsExplorer.editSecret',
        title: 'Edit Secret',
        arguments: [this]
      };
    }
  }
}

/**
 * Tree data provider for Bitwarden secrets and projects
 */
export class BitwardenSecretsProvider implements vscode.TreeDataProvider<BitwardenSecretItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BitwardenSecretItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  public sdkService: BitwardenSdkService;

  constructor(private context: vscode.ExtensionContext) {
    this.sdkService = new BitwardenSdkService();
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BitwardenSecretItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BitwardenSecretItem): Promise<BitwardenSecretItem[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return this.createNoTokenItem();
    }

    const authResult = await this.authenticateSDK(accessToken);
    if (!authResult.success) {
      return authResult.errorItem ? [authResult.errorItem] : [];
    }

    return this.getTreeItems(element, accessToken);
  }

  /**
   * Get the stored access token
   */
  private async getAccessToken(): Promise<string | undefined> {
    const accessToken = await this.context.secrets.get('bitwardenAccessToken');
    if (!accessToken) {
      vscode.window.showInformationMessage('Bitwarden Access Token not set. Use "Set Bitwarden Access Token" command.');
    }
    return accessToken;
  }

  /**
   * Create a tree item indicating no token is set
   */
  private createNoTokenItem(): BitwardenSecretItem[] {
    const placeholder = new BitwardenSecretItem(
      'No Access Token', 
      'Please set your Bitwarden Access Token', 
      vscode.TreeItemCollapsibleState.None, 
      'project'
    );
    // Make placeholder non-clickable
    placeholder.contextValue = 'placeholder';
    placeholder.command = undefined;
    return [placeholder];
  }

  /**
   * Authenticate with the SDK
   */
  private async authenticateSDK(accessToken: string): Promise<{ success: boolean; errorItem?: BitwardenSecretItem }> {
    try {
      await this.sdkService.testSdkAvailability();
      
      if (!this.sdkService.isClientAuthenticated()) {
        await this.sdkService.authenticate(accessToken);
      }
      
      await this.ensureOrganizationId();
      return { success: true };
    } catch (error: any) {
      vscode.window.showErrorMessage(
        'Bitwarden SDK authentication failed. ' +
        'Please check your access token. ' +
        'Error: ' + error.message
      );
      const errorItem = new BitwardenSecretItem(
        'Authentication Failed',
        'Check your access token',
        vscode.TreeItemCollapsibleState.None,
        'project'
      );
      // Make error item non-clickable
      errorItem.contextValue = 'placeholder';
      errorItem.command = undefined;
      return {
        success: false,
        errorItem: errorItem
      };
    }
  }

  /**
   * Get tree items based on the current element
   */
  private async getTreeItems(element: BitwardenSecretItem | undefined, accessToken: string): Promise<BitwardenSecretItem[]> {
    if (element) {
      // If an element is provided, it's a project, so get its secrets
      if (element.type === 'project' && element.id) {
        return this.getSecretsForProject(element.id, accessToken);
      }
      // No children for secrets or unknown types - return empty array as secrets don't have children
      return [];
    } else {
      // No element means root, so get all projects
      return this.getProjects(accessToken);
    }
  }

  /**
   * Load and return all projects
   */
  private async getProjects(_accessToken: string): Promise<BitwardenSecretItem[]> {
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: 'Loading Bitwarden projects',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ increment: 0, message: 'Connecting to Bitwarden...' });
        
        progress.report({ increment: 50, message: 'Fetching projects...' });
        
        // Use SDK to list projects
        const projects = await this.sdkService.listProjects();
        // Sort projects alphabetically by name
        projects.sort((a, b) => a.name.localeCompare(b.name));
        
        progress.report({ increment: 100, message: 'Complete' });
        
        const projectItems = projects.map((proj) =>
          new BitwardenSecretItem(
            proj.name,
            undefined, // Hide project ID from display
            vscode.TreeItemCollapsibleState.Collapsed, // Projects can be expanded
            'project',
            proj.id
          )
        );
        
        // Add placeholder if no projects exist
        if (projectItems.length === 0) {
          const placeholder = new BitwardenSecretItem(
            'No Projects Found',
            'Create a project in Bitwarden to get started',
            vscode.TreeItemCollapsibleState.None,
            'project'
          );
          // Make placeholder non-clickable
          placeholder.contextValue = 'placeholder';
          placeholder.command = undefined;
          return [placeholder];
        }
        
        return projectItems;
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to load projects: ${error.message}`);
        const errorItem = new BitwardenSecretItem(
          'Error Loading Projects',
          error.message,
          vscode.TreeItemCollapsibleState.None,
          'project'
        );
        // Make error item non-clickable
        errorItem.contextValue = 'placeholder';
        errorItem.command = undefined;
        return [errorItem];
      }
    });
  }

  /**
   * Load and return secrets for a specific project
   */
  public async getSecretsForProject(projectId: string, _accessToken: string): Promise<BitwardenSecretItem[]> {
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: 'Loading project secrets',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ increment: 0, message: 'Fetching secrets...' });
        
        // Use SDK to list secrets for project
        const secrets = await this.sdkService.listSecrets(projectId);
        
        progress.report({ increment: 80, message: 'Sorting secrets...' });
        
        // Sort secrets alphabetically by key
        secrets.sort((a, b) => a.key.localeCompare(b.key));
        
        progress.report({ increment: 100, message: 'Complete' });
        
        const secretItems = secrets.map((secret) =>
          new BitwardenSecretItem(
            secret.key,
            undefined, // Hide secret ID from description
            vscode.TreeItemCollapsibleState.None, // Secrets don't have children
            'secret',
            secret.id,
            projectId // Pass project ID for context menu operations
          )
        );
        
        // Add placeholder if no secrets exist in this project
        if (secretItems.length === 0) {
          const placeholder = new BitwardenSecretItem(
            'No Secrets Found',
            'Create a secret in this project to get started',
            vscode.TreeItemCollapsibleState.None,
            'secret'
          );
          // Make placeholder non-clickable
          placeholder.contextValue = 'placeholder';
          placeholder.command = undefined;
          return [placeholder];
        }
        
        return secretItems;
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to load secrets for project ${projectId}: ${error.message}`);
        const errorItem = new BitwardenSecretItem(
          'Error Loading Secrets',
          error.message,
          vscode.TreeItemCollapsibleState.None,
          'secret'
        );
        // Make error item non-clickable
        errorItem.contextValue = 'placeholder';
        errorItem.command = undefined;
        return [errorItem];
      }
    });
  }

  /**
   * Get the value of a specific secret
   */
  public async getSecretValue(secretId: string, _accessToken: string): Promise<string | undefined> {
    try {
      const secret = await this.sdkService.getSecret(secretId);
      return secret.value;
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to retrieve secret value: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Ensure organization ID is available
   */
  private async ensureOrganizationId(): Promise<void> {
    // Check if organization ID is already set in the SDK service
    if (this.sdkService.getOrganizationId()) {
      return;
    }

    // Try to get manually stored organization ID
    const storedOrgId = await this.context.secrets.get('bitwardenOrganizationId');
    if (storedOrgId) {
      try {
        this.sdkService.setOrganizationId(storedOrgId);
      } catch (error) {
        throw new Error(`Invalid stored organization ID: ${error}`);
      }
    } else {
      throw new Error('No organization ID available. Please set your organization ID using "Bitwarden: Set Organization ID" command.');
    }
  }
}