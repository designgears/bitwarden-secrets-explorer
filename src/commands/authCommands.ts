import * as vscode from 'vscode';
import { BitwardenSecretsProvider } from '../ui/treeProvider';

/**
 * Command handler for setting the Bitwarden access token
 */
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
      // Basic validation - access tokens should be reasonably long
      if (value.length < 10) {
        return 'Access token appears to be too short';
      }
      return null;
    }
  });
  
  if (accessToken) {
    try {
      // Store the token securely
      await context.secrets.store('bitwardenAccessToken', accessToken.trim());
      
      // Test the token by attempting authentication
      await provider.sdkService.authenticate(accessToken.trim());
      
      vscode.window.showInformationMessage('Bitwarden Access Token set successfully!');
      provider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to authenticate with provided token: ${error}`);
      // Don't store invalid tokens
      await context.secrets.delete('bitwardenAccessToken');
    }
  }
}

/**
 * Command handler for setting the organization ID
 */
export async function setOrganizationIdCommand(
  context: vscode.ExtensionContext,
  provider: BitwardenSecretsProvider
): Promise<void> {
  const organizationId = await vscode.window.showInputBox({
    prompt: 'Enter your Bitwarden Organization ID',
    placeHolder: 'Organization UUID from Bitwarden',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Organization ID cannot be empty';
      }
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value.trim())) {
        return 'Organization ID must be a valid UUID format';
      }
      return null;
    }
  });
  
  if (organizationId) {
    try {
      const trimmedOrgId = organizationId.trim();
      
      // Store the organization ID securely
      await context.secrets.store('bitwardenOrganizationId', trimmedOrgId);
      
      // Set it in the SDK service
      provider.sdkService.setOrganizationId(trimmedOrgId);
      
      vscode.window.showInformationMessage('Bitwarden Organization ID set successfully!');
      provider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to set organization ID: ${error}`);
      // Don't store invalid organization IDs
      await context.secrets.delete('bitwardenOrganizationId');
    }
  }
}