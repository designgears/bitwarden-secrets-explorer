import * as vscode from 'vscode';
import { BitwardenSecretsProvider, BitwardenSecretItem } from '../ui/treeProvider';

/**
 * Command handler for creating a new project
 */
export async function createProjectCommand(
  provider: BitwardenSecretsProvider
): Promise<void> {
  const projectName = await vscode.window.showInputBox({
    prompt: 'Enter project name',
    placeHolder: 'My Project',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Project name cannot be empty';
      }
      if (value.length > 100) {
        return 'Project name cannot exceed 100 characters';
      }
      return null;
    }
  });
  
  if (projectName) {
    try {
      await provider.sdkService.createProject(projectName.trim());
      vscode.window.showInformationMessage(`Project "${projectName}" created successfully`);
      provider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create project: ${error}`);
    }
  }
}

/**
 * Command handler for editing a project
 */
export async function editProjectCommand(
  provider: BitwardenSecretsProvider,
  item: BitwardenSecretItem
): Promise<void> {
  if (item.type === 'project' && item.id) {
    const newName = await vscode.window.showInputBox({
      prompt: 'Enter new project name',
      value: item.label,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project name cannot be empty';
        }
        if (value.length > 100) {
          return 'Project name cannot exceed 100 characters';
        }
        return null;
      }
    });
    
    if (newName && newName.trim() !== item.label) {
      try {
        await provider.sdkService.updateProject(item.id, newName.trim());
        vscode.window.showInformationMessage(`Project renamed to "${newName}"`);
        provider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update project: ${error}`);
      }
    }
  }
}

/**
 * Command handler for deleting a project
 */
export async function deleteProjectCommand(
  provider: BitwardenSecretsProvider,
  item: BitwardenSecretItem
): Promise<void> {
  if (item.type === 'project' && item.id) {
    const confirmation = await vscode.window.showWarningMessage(
      `Are you sure you want to delete the project "${item.label}"? This will also delete all secrets in this project.`,
      { modal: true },
      'Delete'
    );
    
    if (confirmation === 'Delete') {
      try {
        await provider.sdkService.deleteProject(item.id);
        vscode.window.showInformationMessage(`Project "${item.label}" deleted successfully`);
        provider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete project: ${error}`);
      }
    }
  }
}

/**
 * Command handler for copying project ID
 */
export async function copyProjectIdCommand(
  item: BitwardenSecretItem
): Promise<void> {
  if (item.type === 'project' && item.id) {
    await vscode.env.clipboard.writeText(item.id);
    vscode.window.showInformationMessage(`Project ID "${item.id}" copied to clipboard`);
  }
}