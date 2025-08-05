import * as vscode from 'vscode';
import { ApplicationState } from './ApplicationState';
import { CommandRegistry } from './CommandRegistry';
import { UIManager } from './UIManager';

/**
 * Main extension manager that orchestrates all components
 */
export class ExtensionManager {
  private appState: ApplicationState;
  private commandRegistry: CommandRegistry;
  private uiManager: UIManager;

  constructor(private context: vscode.ExtensionContext) {
    this.appState = new ApplicationState(context);
    this.commandRegistry = new CommandRegistry(context, this.appState);
    this.uiManager = new UIManager(context, this.appState);
  }

  activate(): void {
    // Initialize UI components
    this.uiManager.initialize();

    // Register all commands
    this.commandRegistry.registerAll();

    // Set up cleanup on extension deactivation
    this.context.subscriptions.push({
      dispose: () => this.dispose()
    });
  }

  private dispose(): void {
    this.appState.dispose();
    this.uiManager.dispose();
  }
}