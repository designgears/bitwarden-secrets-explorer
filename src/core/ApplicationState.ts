import * as vscode from 'vscode';
import { BitwardenSecretsProvider } from '../ui/treeProvider';
import { BitwardenWelcomeProvider } from '../ui/welcomeProvider';

/**
 * Centralized application state management
 */
export class ApplicationState {
  private _bitwardenSecretsProvider?: BitwardenSecretsProvider;
  private _treeView?: vscode.TreeView<any>;
  private _welcomeProvider?: BitwardenWelcomeProvider;
  private _hasData = false;
  private _onStateChange = new vscode.EventEmitter<boolean>();

  public readonly onStateChange = this._onStateChange.event;

  constructor(private context: vscode.ExtensionContext) {}

  get bitwardenSecretsProvider(): BitwardenSecretsProvider | undefined {
    return this._bitwardenSecretsProvider;
  }

  get treeView(): vscode.TreeView<any> | undefined {
    return this._treeView;
  }

  get welcomeProvider(): BitwardenWelcomeProvider | undefined {
    return this._welcomeProvider;
  }

  get hasData(): boolean {
    return this._hasData;
  }

  setWelcomeProvider(provider: BitwardenWelcomeProvider): void {
    this._welcomeProvider = provider;
  }

  async setHasData(hasData: boolean): Promise<void> {
    if (this._hasData === hasData) {
      return;
    }

    this._hasData = hasData;

    if (hasData && !this._treeView) {
      await this.createTreeView();
    } else if (!hasData && this._treeView) {
      this.disposeTreeView();
    }

    this._onStateChange.fire(hasData);
  }

  private async createTreeView(): Promise<void> {
    this._bitwardenSecretsProvider = new BitwardenSecretsProvider(this.context);
    
    try {
      await this._bitwardenSecretsProvider.getChildren();
    } catch (error) {
      console.warn('Failed to pre-populate tree data:', error);
    }
    
    this._treeView = vscode.window.createTreeView('bitwardenSecretsExplorer', {
      treeDataProvider: this._bitwardenSecretsProvider,
      showCollapseAll: true
    });
    
    this.context.subscriptions.push(this._treeView);
  }

  private disposeTreeView(): void {
    if (this._treeView) {
      this._treeView.dispose();
      this._treeView = undefined;
      this._bitwardenSecretsProvider = undefined;
    }
  }

  getOrCreateProvider(): BitwardenSecretsProvider {
    return this._bitwardenSecretsProvider || new BitwardenSecretsProvider(this.context);
  }

  refreshAll(): void {
    if (this._bitwardenSecretsProvider) {
      this._bitwardenSecretsProvider.refresh();
    }
    if (this._welcomeProvider) {
      this._welcomeProvider.updateView();
    }
  }

  dispose(): void {
    this.disposeTreeView();
    this._onStateChange.dispose();
  }
}