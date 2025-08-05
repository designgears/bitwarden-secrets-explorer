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
      
      // Search for .env* files only in the top directory of workspace folders
      for (const folder of workspaceFolders) {
        try {
          const entries = await vscode.workspace.fs.readDirectory(folder.uri);
          for (const [name, type] of entries) {
            if (type === vscode.FileType.File && name.startsWith('.env')) {
              envFiles.push(vscode.Uri.joinPath(folder.uri, name));
            }
          }
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
      // Show file selection immediately without fetching secrets first
      const targetFile = await selectEnvFileForExport();
      if (!targetFile) {
        return; // User cancelled file selection
      }
      
      // Show progress while fetching secrets
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Exporting secrets...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Fetching project secrets...' });
        
        const secrets = await provider.getSecretsForProject(item.id!, '');
        
        if (secrets.length === 0) {
          vscode.window.showInformationMessage('No secrets found in this project');
          return;
        }
        
        progress.report({ message: 'Collecting secret values...' });
        
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
        
        progress.report({ message: 'Writing to file...' });
        
        // Export to the selected file
        await writeSecretsToFile(targetFile, secretData);
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export secrets: ${error}`);
    }
  }
}

/**
 * Select target file for export without fetching secrets
 */
async function selectEnvFileForExport(): Promise<vscode.Uri | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder found');
    return null;
  }

  // Find existing .env files in the top directory
  const envFiles: vscode.Uri[] = [];
  
  for (const folder of workspaceFolders) {
    try {
      const entries = await vscode.workspace.fs.readDirectory(folder.uri);
      for (const [name, type] of entries) {
        if (type === vscode.FileType.File && name.startsWith('.env')) {
          envFiles.push(vscode.Uri.joinPath(folder.uri, name));
        }
      }
    } catch (error) {
      // Continue if search fails for this folder
    }
  }
  
  interface FileOption {
    label: string;
    description: string;
    uri?: vscode.Uri;
    filename?: string;
  }
  
  if (envFiles.length > 0) {
    // Show existing .env files and option to create new
    const fileOptions: FileOption[] = envFiles.map(file => ({
      label: vscode.workspace.asRelativePath(file),
      description: 'Update existing file',
      uri: file
    }));
    
    // Check which files already exist to avoid offering them as creation options
    const existingFileNames = new Set(envFiles.map(file => file.path.split('/').pop()));
    
    if (!existingFileNames.has('.env')) {
      fileOptions.push({
        label: 'Create new .env file',
        description: 'Create a new .env file in workspace root',
        filename: '.env'
      });
    }
    
    if (!existingFileNames.has('.env.local')) {
      fileOptions.push({
        label: 'Create new .env.local file',
        description: 'Create a new .env.local file in workspace root',
        filename: '.env.local'
      });
    }
    
    fileOptions.push({
      label: 'Create custom .env file',
      description: 'Create a new .env file with custom name',
      filename: 'custom'
    });
    
    const selectedOption = await vscode.window.showQuickPick(fileOptions, {
      placeHolder: 'Select .env file to update or create new one'
    });
    
    if (!selectedOption) {
      return null;
    }
    
    if (selectedOption.uri) {
      return selectedOption.uri;
    } else {
      // User wants to create new file
      if (selectedOption.filename === 'custom') {
        const customName = await vscode.window.showInputBox({
          prompt: 'Enter the filename for your .env file',
          placeHolder: '.env.development',
          validateInput: async (value) => {
            if (!value) {
              return 'Filename cannot be empty';
            }
            if (!value.startsWith('.env')) {
              return 'Filename must start with ".env"';
            }
            // Check if file already exists
            try {
              const testFile = vscode.Uri.joinPath(workspaceFolders[0].uri, value);
              await vscode.workspace.fs.stat(testFile);
              return 'File already exists. Please choose a different name.';
            } catch {
              // File doesn't exist, which is what we want
            }
            return null;
          }
        });
        
        if (!customName) {
          return null;
        }
        
        return vscode.Uri.joinPath(workspaceFolders[0].uri, customName);
      } else {
        return vscode.Uri.joinPath(workspaceFolders[0].uri, selectedOption.filename!);
      }
    }
  } else {
    // No .env files found, offer to create one
    const fileChoice = await vscode.window.showQuickPick([
      {
        label: 'Create .env file',
        description: 'Create a new .env file in workspace root',
        filename: '.env'
      },
      {
        label: 'Create .env.local file',
        description: 'Create a new .env.local file in workspace root',
        filename: '.env.local'
      },
      {
        label: 'Create custom .env file',
        description: 'Create a new .env file with custom name',
        filename: 'custom'
      }
    ], {
      placeHolder: 'No .env files found. Choose file type to create:'
    });
    
    if (!fileChoice) {
      return null;
    }
    
    if (fileChoice.filename === 'custom') {
      const customName = await vscode.window.showInputBox({
        prompt: 'Enter the filename for your .env file',
        placeHolder: '.env.development',
        validateInput: async (value) => {
          if (!value) {
            return 'Filename cannot be empty';
          }
          if (!value.startsWith('.env')) {
            return 'Filename must start with ".env"';
          }
          // Check if file already exists
          try {
            const testFile = vscode.Uri.joinPath(workspaceFolders[0].uri, value);
            await vscode.workspace.fs.stat(testFile);
            return 'File already exists. Please choose a different name.';
          } catch {
            // File doesn't exist, which is what we want
          }
          return null;
        }
      });
      
      if (!customName) {
        return null;
      }
      
      return vscode.Uri.joinPath(workspaceFolders[0].uri, customName);
    } else {
      return vscode.Uri.joinPath(workspaceFolders[0].uri, fileChoice.filename!);
    }
  }
}

/**
 * Write secrets to the selected file with conflict resolution
 */
async function writeSecretsToFile(
  targetFile: vscode.Uri,
  secretData: { [key: string]: string }
): Promise<void> {
  let existingContent: { [key: string]: string } = {};
  
  try {
    const fileContent = await vscode.workspace.fs.readFile(targetFile);
    const contentString = Buffer.from(fileContent).toString('utf8');
    existingContent = parseEnvFile(contentString);
  } catch (error) {
    // File might not exist or be readable, continue with empty content
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
    
    if (conflictAction.label === 'Overwrite all conflicts') {
      // Overwrite all conflicts
      for (const key of conflicts) {
        finalContent[key] = secretData[key];
      }
    } else if (conflictAction.label === 'Choose for each conflict') {
      // Handle each conflict individually
      for (const key of conflicts) {
        const choice = await vscode.window.showQuickPick(
          [
            { label: 'Overwrite', description: `Replace existing value for ${key}` },
            { label: 'Keep existing', description: `Keep current value for ${key}` }
          ],
          { placeHolder: `Conflict for "${key}": Choose action` }
        );
        
        if (!choice) {
          return; // User cancelled
        }
        
        if (choice.label === 'Overwrite') {
          finalContent[key] = secretData[key];
        }
        // If 'Keep existing', do nothing (keep current value)
      }
    }
    // If 'Skip conflicts', do nothing for conflicts
  }
  
  // Add new secrets
  for (const key of newSecrets) {
    finalContent[key] = secretData[key];
  }
  
  // Write the final content to file
  const envContent = formatEnvFile(finalContent);
  await vscode.workspace.fs.writeFile(targetFile, Buffer.from(envContent, 'utf8'));
  
  const relativePath = vscode.workspace.asRelativePath(targetFile);
  const totalSecrets = Object.keys(finalContent).length;
  const addedSecrets = newSecrets.length;
  const updatedSecrets = conflicts.filter(key => finalContent[key] === secretData[key]).length;
  
  vscode.window.showInformationMessage(
    `Exported to ${relativePath}: ${addedSecrets} new, ${updatedSecrets} updated, ${totalSecrets} total secrets`
  );
}