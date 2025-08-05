import * as vscode from 'vscode';
import { ApplicationState } from './ApplicationState';
import { BitwardenWelcomeProvider } from '../ui/welcomeprovider';

/**
 * Manages UI components and their lifecycle
 */
export class UIManager {
  private welcomeProvider: BitwardenWelcomeProvider;

  constructor(
    private context: vscode.ExtensionContext,
    private appState: ApplicationState
  ) {
    this.welcomeProvider = new BitwardenWelcomeProvider(
      context.extensionUri,
      context,
      this.handleStateChange.bind(this)
    );
    
    this.appState.setWelcomeProvider(this.welcomeProvider);
  }

  initialize(): void {
    // Register the welcome view provider
    const welcomeViewDisposable = vscode.window.registerWebviewViewProvider(
      BitwardenWelcomeProvider.viewType,
      this.welcomeProvider
    );
    this.context.subscriptions.push(welcomeViewDisposable);

    // Initialize the welcome view
    this.welcomeProvider.updateView();
  }

  private async handleStateChange(hasData: boolean): Promise<void> {
    await this.appState.setHasData(hasData);
  }

  dispose(): void {
    // UI components are disposed through context subscriptions
  }
}