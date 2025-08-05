import * as vscode from 'vscode';
import { ApplicationState } from './ApplicationState';
import {
  setAccessTokenCommand,
  setOrganizationIdCommand,
  clearTokensCommand
} from '../commands/authCommands';
import {
  createProjectCommand,
  editProjectCommand,
  deleteProjectCommand,
  copyProjectIdCommand
} from '../commands/projectCommands';
import {
  editSecretCommand,
  createSecretCommand,
  copySecretCommand,
  deleteSecretCommand,
  loadSecretToEnvCommand,
  loadProjectSecretsToEnvCommand,
  copyProjectSecretsCommand,
  exportProjectSecretsCommand,
  importSecretsFromEnvCommand
} from '../commands/secretCommands';

type CommandHandler = (...args: any[]) => Promise<any> | any;

interface CommandDefinition {
  id: string;
  handler: CommandHandler;
  requiresProvider?: boolean;
  refreshAfter?: boolean;
}

/**
 * Centralized command registration and management
 */
export class CommandRegistry {
  private commands: CommandDefinition[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private appState: ApplicationState
  ) {
    this.defineCommands();
  }

  private defineCommands(): void {
    this.commands = [
      // Authentication commands
      {
        id: 'bitwardenSecretsExplorer.setAccessToken',
        handler: async () => {
          const provider = this.appState.getOrCreateProvider();
          await setAccessTokenCommand(this.context, provider);
        },
        refreshAfter: true
      },
      {
        id: 'bitwardenSecretsExplorer.setOrganizationId',
        handler: async () => {
          const provider = this.appState.getOrCreateProvider();
          await setOrganizationIdCommand(this.context, provider);
        },
        refreshAfter: true
      },
      {
        id: 'bitwardenSecretsExplorer.clearTokens',
        handler: async () => {
          await clearTokensCommand(this.context);
        },
        refreshAfter: true
      },
      {
        id: 'bitwardenSecretsExplorer.checkStatus',
        handler: () => {
          this.appState.welcomeProvider?.updateView();
        }
      },

      // Project commands
      {
        id: 'bitwardenSecretsExplorer.createProject',
        handler: async () => {
          await createProjectCommand(this.appState.bitwardenSecretsProvider!);
        },
        requiresProvider: true,
        refreshAfter: true
      },
      {
        id: 'bitwardenSecretsExplorer.editProject',
        handler: (item: any) => {
          return editProjectCommand(this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true
      },
      {
        id: 'bitwardenSecretsExplorer.deleteProject',
        handler: async (item: any) => {
          await deleteProjectCommand(this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true,
        refreshAfter: true
      },
      {
        id: 'bitwardenSecretsExplorer.copyProjectId',
        handler: (item: any) => {
          return copyProjectIdCommand(item);
        },
        requiresProvider: true
      },

      // Secret commands
      {
        id: 'bitwardenSecretsExplorer.editSecret',
        handler: (item: any) => {
          return editSecretCommand(this.context, this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true
      },
      {
        id: 'bitwardenSecretsExplorer.createSecret',
        handler: (item: any) => {
          return createSecretCommand(this.context, this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true
      },
      {
        id: 'bitwardenSecretsExplorer.copySecret',
        handler: (item: any) => {
          return copySecretCommand(this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true
      },
      {
        id: 'bitwardenSecretsExplorer.deleteSecret',
        handler: (item: any) => {
          return deleteSecretCommand(this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true
      },
      {
        id: 'bitwardenSecretsExplorer.loadSecretToEnv',
        handler: (item: any) => {
          return loadSecretToEnvCommand(this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true
      },
      {
        id: 'bitwardenSecretsExplorer.loadProjectSecretsToEnv',
        handler: (item: any) => {
          return loadProjectSecretsToEnvCommand(this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true
      },
      {
        id: 'bitwardenSecretsExplorer.copyProjectSecrets',
        handler: (item: any) => {
          return copyProjectSecretsCommand(this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true
      },
      {
        id: 'bitwardenSecretsExplorer.exportProjectSecrets',
        handler: (item: any) => {
          return exportProjectSecretsCommand(this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true
      },
      {
        id: 'bitwardenSecretsExplorer.importSecretsFromEnv',
        handler: (item: any) => {
          return importSecretsFromEnvCommand(this.appState.bitwardenSecretsProvider!, item);
        },
        requiresProvider: true,
        refreshAfter: true
      },

      // Utility commands
      {
        id: 'bitwardenSecretsExplorer.refreshEntry',
        handler: () => {
          this.appState.refreshAll();
        }
      }
    ];
  }

  registerAll(): void {
    for (const command of this.commands) {
      const disposable = vscode.commands.registerCommand(
        command.id,
        async (...args: any[]) => {
          try {
            // Check if command requires provider and provider exists
            if (command.requiresProvider && !this.appState.bitwardenSecretsProvider) {
              return Promise.resolve();
            }

            const result = await command.handler(...args);

            // Refresh if needed
            if (command.refreshAfter) {
              this.appState.welcomeProvider?.updateView();
            }

            return result;
          } catch (error) {
            console.error(`Error executing command ${command.id}:`, error);
            vscode.window.showErrorMessage(`Failed to execute command: ${error}`);
          }
        }
      );

      this.context.subscriptions.push(disposable);
    }
  }
}