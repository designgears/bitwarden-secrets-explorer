import * as vscode from 'vscode';
import { BitwardenSecretsProvider } from '../ui/treeProvider';

export async function setAccessTokenCommand(
  context: vscode.ExtensionContext,
  provider: BitwardenSecretsProvider
): Promise<void> {
  
  const accessToken = await vscode.window.showInputBox({
    prompt: 'Enter your Bitwarden Access Token',
    password: true,
    placeHolder: 'Access token from Bitwarden Secrets Manager',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Access token cannot be empty';
      }
      return null;
    }
  });
  
  if (accessToken) {
    try {
      await context.secrets.store('bitwardenAccessToken', accessToken.trim());
      await provider.sdkService.authenticate(accessToken.trim());
      provider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to authenticate with provided token: ${error}`);
      await context.secrets.delete('bitwardenAccessToken');
    }
  }
}

export async function clearTokensCommand(
  context: vscode.ExtensionContext
): Promise<void> {
  
  const confirmation = await vscode.window.showWarningMessage(
    'Are you sure you want to clear all stored Bitwarden tokens? This will log you out.',
    { modal: true },
    'Yes, Clear Tokens',
    'Cancel'
  );
  
  if (confirmation === 'Yes, Clear Tokens') {
    try {
      await context.secrets.delete('bitwardenAccessToken');
      await context.secrets.delete('bitwardenOrganizationId');
      vscode.window.showInformationMessage('Bitwarden tokens cleared successfully. You will need to re-authenticate.');
      vscode.commands.executeCommand('setContext', 'bitwarden.hasData', false);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to clear tokens: ${error}`);
    }
  }
}

export async function setOrganizationIdCommand(
  context: vscode.ExtensionContext,
  provider: BitwardenSecretsProvider
): Promise<void> {
  
  const organizationId = await vscode.window.showInputBox({
    prompt: 'Enter your Bitwarden Organization ID',
    placeHolder: 'Organization ID from Bitwarden',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Organization ID cannot be empty';
      }
      return null;
    }
  });
  
  if (organizationId) {
    try {
      const trimmedOrgId = organizationId.trim();
      await context.secrets.store('bitwardenOrganizationId', trimmedOrgId);
      provider.sdkService.setOrganizationId(trimmedOrgId);
      provider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to set organization ID: ${error}`);
      await context.secrets.delete('bitwardenOrganizationId');
    }
  }
}