import * as vscode from 'vscode';
import { BitwardenSecretsProvider, BitwardenSecretItem } from '../ui/treeProvider';
import { openSecretEditor, openNewSecretEditor } from '../ui/webviewEditors';
import { getEnvVarCommand, getEnvCheckInstructions, getClearCommand } from '../utils/terminalUtils';

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
      const keyValuePair = `${item.label}=${secretValue}`;
      await vscode.env.clipboard.writeText(keyValuePair);
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
      
      // Get or create a terminal
      let terminal = vscode.window.activeTerminal;
      if (!terminal) {
        terminal = vscode.window.createTerminal('Bitwarden Secrets');
      }
      
      // Execute the command silently
      terminal.sendText(command);
      
      // Clear the terminal to hide the command
      terminal.sendText(getClearCommand());
      
      // Show success message without revealing the secret
      vscode.window.showInformationMessage(
        `Environment variable '${item.label}' has been set in the terminal`
      );
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
      const secretNames: string[] = [];
      
      for (const secret of secrets) {
        if (secret.type === 'secret' && secret.id) {
          const secretValue = await provider.getSecretValue(secret.id, '');
          if (secretValue) {
            commands.push(getEnvVarCommand(secret.label, secretValue));
            secretNames.push(secret.label);
          }
        }
      }
      
      if (commands.length > 0) {
        // Get or create a terminal
        let terminal = vscode.window.activeTerminal;
        if (!terminal) {
          terminal = vscode.window.createTerminal('Bitwarden Secrets');
        }
        
        // Execute all commands silently
        for (const command of commands) {
          terminal.sendText(command);
        }
        
        // Clear the terminal to hide the commands
        terminal.sendText(getClearCommand());
        
        // Show success message without revealing the secrets
        vscode.window.showInformationMessage(
          `${commands.length} environment variables have been set in the terminal: ${secretNames.join(', ')}`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load project secrets: ${error}`);
    }
  }
}

/**
 * Parse existing .env file content into key-value pairs
 */
function parseEnvFile(content: string): { [key: string]: string } {
  const result: { [key: string]: string } = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();
        result[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * Format .env file content from key-value pairs
 */
function formatEnvFile(data: { [key: string]: string }): string {
  return Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

/**
 * Command handler for copying all project secrets to clipboard in key=value format
 */
export async function copyProjectSecretsCommand(
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
      
      const keyValuePairs: string[] = [];
      
      for (const secret of secrets) {
        if (secret.type === 'secret' && secret.id) {
          const secretValue = await provider.getSecretValue(secret.id, '');
          if (secretValue) {
            keyValuePairs.push(`${secret.label}=${secretValue}`);
          }
        }
      }
      
      if (keyValuePairs.length > 0) {
        const clipboardContent = keyValuePairs.join('\n');
        await vscode.env.clipboard.writeText(clipboardContent);
        vscode.window.showInformationMessage(
          `${keyValuePairs.length} secrets copied to clipboard in key=value format`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy project secrets: ${error}`);
    }
  }
}

/**
 * Command handler for importing secrets from .env files to Bitwarden
 */
export async function importSecretsFromEnvCommand(
  provider: BitwardenSecretsProvider,
  item: BitwardenSecretItem
): Promise<void> {
  if (item.type === 'project' && item.id) {
    try {
      // Find existing .env* files in workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }
      
      const envFiles: vscode.Uri[] = [];
      
      // Search for .env* files in all workspace folders
      for (const folder of workspaceFolders) {
        try {
          const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, '.env*'),
            '**/node_modules/**'
          );
          envFiles.push(...files);
        } catch (error) {
          // Continue if search fails for this folder
        }
      }
      
      if (envFiles.length === 0) {
        vscode.window.showInformationMessage('No .env files found in workspace');
        return;
      }
      
      // Show file selection dialog
      const fileOptions = envFiles.map(file => ({
        label: vscode.workspace.asRelativePath(file),
        description: file.fsPath,
        uri: file
      }));
      
      const selectedOption = await vscode.window.showQuickPick(fileOptions, {
        placeHolder: 'Select .env file to import from'
      });
      
      if (!selectedOption) {
        return;
      }
      
      // Read and parse the selected file
      const fileContent = await vscode.workspace.fs.readFile(selectedOption.uri);
      const contentString = Buffer.from(fileContent).toString('utf8');
      const envData = parseEnvFile(contentString);
      
      const envKeys = Object.keys(envData);
      if (envKeys.length === 0) {
        vscode.window.showInformationMessage('No valid key=value pairs found in the selected file');
        return;
      }
      
      // Check for existing secrets with same keys
      const existingSecrets = await provider.getSecretsForProject(item.id, '');
      const existingKeys = new Set(
        existingSecrets
          .filter(secret => secret.type === 'secret')
          .map(secret => secret.label)
      );
      
      const conflicts = envKeys.filter(key => existingKeys.has(key));
      const newKeys = envKeys.filter(key => !existingKeys.has(key));
      
      let keysToImport = [...newKeys];
      const overwriteChoices = new Map<string, boolean>();
      
      // Handle conflicts if any
      if (conflicts.length > 0) {
        for (const conflictKey of conflicts) {
          const choice = await vscode.window.showQuickPick(
            [
              { label: 'Skip this secret', description: `Keep existing secret "${conflictKey}"` },
              { label: 'Overwrite this secret', description: `Replace existing secret "${conflictKey}"` },
              { label: 'Cancel import', description: 'Cancel the import operation' }
            ],
            { placeHolder: `Secret "${conflictKey}" already exists. What would you like to do?` }
          );
          
          if (!choice || choice.label === 'Cancel import') {
            return;
          }
          
          if (choice.label === 'Overwrite this secret') {
            overwriteChoices.set(conflictKey, true);
            keysToImport.push(conflictKey);
            
            // Delete existing conflicting secret first
            const existingSecret = existingSecrets.find(
              secret => secret.type === 'secret' && secret.label === conflictKey
            );
            if (existingSecret && existingSecret.id) {
              try {
                await provider.sdkService.deleteSecret(existingSecret.id);
              } catch (error) {
                console.warn(`Failed to delete existing secret ${conflictKey}: ${error}`);
              }
            }
          }
        }
      }
      
      if (keysToImport.length === 0) {
        vscode.window.showInformationMessage('No secrets to import');
        return;
      }
      
      // Import secrets with progress indication
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Importing secrets to Bitwarden',
        cancellable: false
      }, async (progress) => {
        const total = keysToImport.length;
        
        for (let i = 0; i < keysToImport.length; i++) {
          const key = keysToImport[i];
          const value = envData[key];
          
          progress.report({
            increment: (100 / total),
            message: `Importing ${key} (${i + 1}/${total})`
          });
          
          try {
            await provider.sdkService.createSecret({
              key: key,
              value: value,
              note: `Imported from ${vscode.workspace.asRelativePath(selectedOption.uri)}`,
              projectId: item.id!
            });
            successCount++;
          } catch (error) {
            errorCount++;
            errors.push(`${key}: ${error}`);
          }
        }
      });
      
      // Refresh the tree to show new secrets
      provider.refresh();
      
      // Show results
      if (successCount > 0 && errorCount === 0) {
        vscode.window.showInformationMessage(
          `Successfully imported ${successCount} secrets from ${vscode.workspace.asRelativePath(selectedOption.uri)}`
        );
      } else if (successCount > 0 && errorCount > 0) {
        vscode.window.showWarningMessage(
          `Imported ${successCount} secrets successfully, ${errorCount} failed. Check output for details.`
        );
        console.error('Import errors:', errors);
      } else {
        vscode.window.showErrorMessage(
          `Failed to import secrets. Check output for details.`
        );
        console.error('Import errors:', errors);
      }
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to import secrets: ${error}`);
    }
  }
}

/**
 * Command handler for exporting project secrets to .env file
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
      
      // Export to .env file with enhanced functionality
      await handleEnvFileExport(secretData);
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export secrets: ${error}`);
    }
  }
}

/**
 * Handle .env file export with conflict resolution and file creation
 */
async function handleEnvFileExport(
  secretData: { [key: string]: string }
): Promise<void> {
  try {
    // Find existing .env files in workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }
    
    const envFiles: vscode.Uri[] = [];
    
    // Search for .env* files in all workspace folders
    for (const folder of workspaceFolders) {
      try {
        const files = await vscode.workspace.findFiles(
          new vscode.RelativePattern(folder, '.env*'),
          '**/node_modules/**'
        );
        envFiles.push(...files);
      } catch (error) {
        // Continue if search fails for this folder
      }
    }
    
    let targetFile: vscode.Uri;
    let existingContent: { [key: string]: string } = {};
    
    if (envFiles.length > 0) {
      // Show existing .env files and option to create new
      const fileOptions = envFiles.map(file => ({
        label: vscode.workspace.asRelativePath(file),
        description: 'Update existing file',
        uri: file
      }));
      
      fileOptions.push({
        label: 'Create new .env file',
        description: 'Create a new .env file in workspace root',
        uri: undefined as any
      });
      
      const selectedOption = await vscode.window.showQuickPick(fileOptions, {
        placeHolder: 'Select .env file to update or create new one'
      });
      
      if (!selectedOption) {
        return;
      }
      
      if (selectedOption.uri) {
        // User selected existing file
        targetFile = selectedOption.uri;
        
        try {
          const fileContent = await vscode.workspace.fs.readFile(targetFile);
          const contentString = Buffer.from(fileContent).toString('utf8');
          existingContent = parseEnvFile(contentString);
        } catch (error) {
          // File might not exist or be readable, continue with empty content
        }
      } else {
        // User wants to create new file
        targetFile = vscode.Uri.joinPath(workspaceFolders[0].uri, '.env');
      }
    } else {
      // No .env files found, offer to create one
      const createNew = await vscode.window.showInformationMessage(
        'No .env files found in workspace. Create a new .env file?',
        'Yes',
        'No'
      );
      
      if (createNew !== 'Yes') {
        return;
      }
      
      targetFile = vscode.Uri.joinPath(workspaceFolders[0].uri, '.env');
    }
    
    // Check for conflicts and handle them
    const conflicts: string[] = [];
    const newSecrets: string[] = [];
    
    for (const key of Object.keys(secretData)) {
      if (existingContent.hasOwnProperty(key)) {
        conflicts.push(key);
      } else {
        newSecrets.push(key);
      }
    }
    
    let finalContent = { ...existingContent };
    
    if (conflicts.length > 0) {
      // Handle conflicts
      const conflictAction = await vscode.window.showQuickPick(
        [
          { label: 'Overwrite all conflicts', description: `Replace ${conflicts.length} existing secrets` },
          { label: 'Choose for each conflict', description: 'Decide individually for each conflict' },
          { label: 'Skip conflicts', description: 'Only add new secrets, keep existing ones' }
        ],
        { placeHolder: 'How to handle existing secrets?' }
      );
      
      if (!conflictAction) {
        return;
      }
      
      switch (conflictAction.label) {
        case 'Overwrite all conflicts':
          // Overwrite all conflicts
          for (const key of conflicts) {
            finalContent[key] = secretData[key];
          }
          break;
          
        case 'Choose for each conflict':
          // Ask for each conflict individually
          for (const key of conflicts) {
            const overwrite = await vscode.window.showQuickPick(
              [
                { label: 'Yes', description: `Overwrite ${key}` },
                { label: 'No', description: `Keep existing ${key}` }
              ],
              { placeHolder: `Overwrite existing secret '${key}'?` }
            );
            
            if (overwrite?.label === 'Yes') {
              finalContent[key] = secretData[key];
            }
          }
          break;
          
        case 'Skip conflicts':
          // Don't overwrite any conflicts
          break;
      }
    }
    
    // Add new secrets (non-conflicting)
    for (const key of newSecrets) {
      finalContent[key] = secretData[key];
    }
    
    // Write the final content
    const finalEnvContent = formatEnvFile(finalContent);
    await vscode.workspace.fs.writeFile(targetFile, Buffer.from(finalEnvContent, 'utf8'));
    
    const relativePath = vscode.workspace.asRelativePath(targetFile);
    const addedCount = newSecrets.length;
    const updatedCount = conflicts.filter(key => finalContent[key] === secretData[key]).length;
    
    let message = `Secrets exported to ${relativePath}`;
    if (addedCount > 0) {
      message += ` (${addedCount} new)`;
    }
    if (updatedCount > 0) {
      message += ` (${updatedCount} updated)`;
    }
    
    vscode.window.showInformationMessage(message);
    
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to export to .env file: ${error}`);
  }
}