import * as vscode from 'vscode';
import { BitwardenSecretsProvider, BitwardenSecretItem } from '../ui/treeProvider';
import { openSecretEditor, openNewSecretEditor } from '../ui/webviewEditors';
import { getEnvVarCommand, getEnvCheckInstructions } from '../utils/terminalUtils';

/**
 * Command handler for editing a secret
 */
export async function editSecretCommand(
  context: vscode.ExtensionContext,
  provider: BitwardenSecretsProvider,
  item: BitwardenSecretItem
): Promise<void> {
  await openSecretEditor(context, provider, item);
}

/**
 * Command handler for creating a new secret
 */
export async function createSecretCommand(
  context: vscode.ExtensionContext,
  provider: BitwardenSecretsProvider,
  item: BitwardenSecretItem
): Promise<void> {
  if (item.type === 'project' && item.id) {
    await openNewSecretEditor(context, provider, item.id);
  }
}

/**
 * Command handler for copying a secret to clipboard
 */
export async function copySecretCommand(
  provider: BitwardenSecretsProvider,
  item: BitwardenSecretItem
): Promise<void> {
  if (item.type === 'secret' && item.id) {
    const secretValue = await provider.getSecretValue(item.id, '');
    if (secretValue) {
      await vscode.env.clipboard.writeText(secretValue);
      vscode.window.showInformationMessage(`Secret "${item.label}" copied to clipboard`);
    }
  }
}

/**
 * Command handler for deleting a secret
 */
export async function deleteSecretCommand(
  provider: BitwardenSecretsProvider,
  item: BitwardenSecretItem
): Promise<void> {
  if (item.type === 'secret' && item.id) {
    const confirmation = await vscode.window.showWarningMessage(
      `Are you sure you want to delete the secret "${item.label}"?`,
      { modal: true },
      'Delete'
    );
    
    if (confirmation === 'Delete') {
      try {
        await provider.sdkService.deleteSecret(item.id);
        vscode.window.showInformationMessage(`Secret "${item.label}" deleted successfully`);
        provider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete secret: ${error}`);
      }
    }
  }
}

/**
 * Command handler for loading a secret to environment variable
 */
export async function loadSecretToEnvCommand(
  provider: BitwardenSecretsProvider,
  item: BitwardenSecretItem
): Promise<void> {
  if (item.type === 'secret' && item.id) {
    const secretValue = await provider.getSecretValue(item.id, '');
    if (secretValue) {
      const command = getEnvVarCommand(item.label, secretValue);
      const instructions = getEnvCheckInstructions();
      
      // Show the command in a quick pick for easy copying
      const result = await vscode.window.showQuickPick(
        [{
          label: 'Copy Command to Clipboard',
          description: command,
          detail: `Run this in your terminal. ${instructions}`
        }],
        {
          placeHolder: 'Select action for environment variable command'
        }
      );
      
      if (result) {
        await vscode.env.clipboard.writeText(command);
        vscode.window.showInformationMessage(
          `Environment variable command copied to clipboard. ${instructions}`
        );
      }
    }
  }
}

/**
 * Command handler for exporting project secrets to environment variables
 */
export async function loadProjectSecretsToEnvCommand(
  provider: BitwardenSecretsProvider,
  item: BitwardenSecretItem
): Promise<void> {
  if (item.type === 'project' && item.id) {
    try {
      const secrets = await provider.getSecretsForProject(item.id, '');
      
      if (secrets.length === 0) {
        vscode.window.showInformationMessage('No secrets found in this project');
        return;
      }
      
      const commands: string[] = [];
      
      for (const secret of secrets) {
        if (secret.type === 'secret' && secret.id) {
          const secretValue = await provider.getSecretValue(secret.id, '');
          if (secretValue) {
            commands.push(getEnvVarCommand(secret.label, secretValue));
          }
        }
      }
      
      if (commands.length > 0) {
        const allCommands = commands.join('\n');
        const instructions = getEnvCheckInstructions();
        
        const result = await vscode.window.showQuickPick(
          [{
            label: 'Copy All Commands to Clipboard',
            description: `${commands.length} environment variable commands`,
            detail: `Run these in your terminal. ${instructions}`
          }],
          {
            placeHolder: 'Select action for environment variable commands'
          }
        );
        
        if (result) {
          await vscode.env.clipboard.writeText(allCommands);
          vscode.window.showInformationMessage(
            `${commands.length} environment variable commands copied to clipboard. ${instructions}`
          );
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load project secrets: ${error}`);
    }
  }
}

/**
 * Command handler for exporting project secrets to a file
 */
export async function exportProjectSecretsCommand(
  provider: BitwardenSecretsProvider,
  item: BitwardenSecretItem
): Promise<void> {
  if (item.type === 'project' && item.id) {
    try {
      const secrets = await provider.getSecretsForProject(item.id, '');
      
      if (secrets.length === 0) {
        vscode.window.showInformationMessage('No secrets found in this project');
        return;
      }
      
      // Ask user for file format
      const format = await vscode.window.showQuickPick(
        [
          { label: '.env', description: 'Environment file format (KEY=value)' },
          { label: 'JSON', description: 'JSON format' },
          { label: 'YAML', description: 'YAML format' }
        ],
        { placeHolder: 'Select export format' }
      );
      
      if (!format) {
        return;
      }
      
      // Get file save location
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${item.label}-secrets${format.label === '.env' ? '.env' : format.label === 'JSON' ? '.json' : '.yml'}`),
        filters: {
          'All Files': ['*']
        }
      });
      
      if (!uri) {
        return;
      }
      
      // Collect secret values
      const secretData: { [key: string]: string } = {};
      
      for (const secret of secrets) {
        if (secret.type === 'secret' && secret.id) {
          const secretValue = await provider.getSecretValue(secret.id, '');
          if (secretValue) {
            secretData[secret.label] = secretValue;
          }
        }
      }
      
      // Format content based on selected format
      let content: string;
      
      switch (format.label) {
        case '.env':
          content = Object.entries(secretData)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
          break;
        case 'JSON':
          content = JSON.stringify(secretData, null, 2);
          break;
        case 'YAML':
          content = Object.entries(secretData)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
          break;
        default:
          content = JSON.stringify(secretData, null, 2);
      }
      
      // Write file
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
      vscode.window.showInformationMessage(`Secrets exported to ${uri.fsPath}`);
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export secrets: ${error}`);
    }
  }
}