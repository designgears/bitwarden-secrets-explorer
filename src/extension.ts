import * as vscode from 'vscode';
import { BitwardenSecretsProvider } from './ui/treeProvider';
import {
  setAccessTokenCommand,
  setOrganizationIdCommand,
  createProjectCommand,
  editProjectCommand,
  deleteProjectCommand,
  copyProjectIdCommand,
  editSecretCommand,
  createSecretCommand,
  copySecretCommand,
  deleteSecretCommand,
  loadSecretToEnvCommand,
  loadProjectSecretsToEnvCommand,
  exportProjectSecretsCommand
} from './commands';

/**
 * Activates the extension
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
  // Create the tree data provider
  const bitwardenSecretsProvider = new BitwardenSecretsProvider(context);

  // Register the tree view
  vscode.window.createTreeView('bitwardenSecretsExplorer', {
    treeDataProvider: bitwardenSecretsProvider,
    showCollapseAll: true
  });

  // Register authentication commands
  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.setAccessToken', () => 
      setAccessTokenCommand(context, bitwardenSecretsProvider)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.setOrganizationId', () => 
      setOrganizationIdCommand(context, bitwardenSecretsProvider)
    )
  );

  // Register project commands
  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.createProject', () => 
      createProjectCommand(bitwardenSecretsProvider)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.editProject', (item) => 
      editProjectCommand(bitwardenSecretsProvider, item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.deleteProject', (item) => 
      deleteProjectCommand(bitwardenSecretsProvider, item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.copyProjectId', (item) => 
      copyProjectIdCommand(item)
    )
  );

  // Register secret commands
  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.editSecret', (item) => 
      editSecretCommand(context, bitwardenSecretsProvider, item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.createSecret', (item) => 
      createSecretCommand(context, bitwardenSecretsProvider, item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.copySecret', (item) => 
      copySecretCommand(bitwardenSecretsProvider, item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.deleteSecret', (item) => 
      deleteSecretCommand(bitwardenSecretsProvider, item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.loadSecretToEnv', (item) => 
      loadSecretToEnvCommand(bitwardenSecretsProvider, item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.loadProjectSecretsToEnv', (item) => 
      loadProjectSecretsToEnvCommand(bitwardenSecretsProvider, item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.exportProjectSecrets', (item) => 
      exportProjectSecretsCommand(bitwardenSecretsProvider, item)
    )
  );

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('bitwardenSecretsExplorer.refreshEntry', () => 
      bitwardenSecretsProvider.refresh()
    )
  );
}

/**
 * Deactivates the extension
 */
export function deactivate() {}