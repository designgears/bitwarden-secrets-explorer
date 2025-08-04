import * as vscode from 'vscode';
import * as path from 'path';
import { BitwardenSecretsProvider, BitwardenSecretItem } from './treeProvider';
import { getLoadingHtml, getErrorHtml, getSecretEditorHtml } from './htmlTemplates';

/**
 * Replace CSS URI placeholders with actual webview URIs
 */
function replaceCssUris(html: string, webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const mediaPath = path.join(context.extensionPath, 'media');
  const commonCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'common.css')));
  const secretEditorCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'secret-editor.css')));
  
  return html
    .replace(/{{COMMON_CSS_URI}}/g, commonCssUri.toString())
    .replace(/{{SECRET_EDITOR_CSS_URI}}/g, secretEditorCssUri.toString());
}

/**
 * Opens the secret editor for editing an existing secret
 */
export async function openSecretEditor(
  context: vscode.ExtensionContext, 
  provider: BitwardenSecretsProvider, 
  item: BitwardenSecretItem
): Promise<void> {
  // Create webview panel immediately with loading state
  const panel = vscode.window.createWebviewPanel(
    'secretEditor',
    'Loading Secret...',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
      portMapping: []
    }
  );

  // Show loading state immediately
  panel.webview.html = replaceCssUris(getLoadingHtml('Loading secret...'), panel.webview, context);
  
  let secret: any;
  try {
    // Fetch data asynchronously
    const [secretData, projects] = await Promise.all([
      provider.sdkService.getSecret(item.id!),
      provider.sdkService.listProjects()
    ]);
    
    secret = secretData;
    
    // Update title and content once data is loaded
    panel.title = `Edit Secret: ${secret.key}`;
    panel.webview.html = replaceCssUris(getSecretEditorHtml(secret, projects, false), panel.webview, context);
  } catch (error) {
    panel.webview.html = replaceCssUris(getErrorHtml(`Failed to load secret: ${error}`), panel.webview, context);
    return;
  }

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'save':
          try {
            await provider.sdkService.updateSecret({
              id: secret.id!,
              key: message.data.key,
              value: message.data.value,
              note: message.data.note,
              projectId: message.data.projectId
            });
            vscode.window.showInformationMessage('Secret updated successfully!');
            provider.refresh();
            panel.dispose();
          } catch (error) {
            panel.webview.postMessage({
              command: 'error',
              message: `Failed to save secret: ${error}`
            });
          }
          break;
        case 'cancel':
          panel.dispose();
          break;
      }
    },
    undefined,
    context.subscriptions
  );
}

/**
 * Opens the secret editor for creating a new secret
 */
export async function openNewSecretEditor(
  context: vscode.ExtensionContext, 
  provider: BitwardenSecretsProvider, 
  projectId: string
): Promise<void> {
  // Create webview panel immediately with loading state
  const panel = vscode.window.createWebviewPanel(
    'newSecretEditor',
    'Loading...',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
      portMapping: []
    }
  );

  // Show loading state immediately
  panel.webview.html = replaceCssUris(getLoadingHtml('Loading projects...'), panel.webview, context);
  
  try {
    // Fetch projects asynchronously
    const projects = await provider.sdkService.listProjects();
    
    // Create a new secret object with default values
    const newSecret = {
      id: '',
      key: '',
      value: '',
      note: '',
      projectId: projectId
    };
    
    // Update title and content once data is loaded
    panel.title = 'Create New Secret';
    panel.webview.html = replaceCssUris(getSecretEditorHtml(newSecret, projects, true), panel.webview, context);
  } catch (error) {
    panel.webview.html = replaceCssUris(getErrorHtml(`Failed to load projects: ${error}`), panel.webview, context);
    return;
  }

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'save':
          try {
            await provider.sdkService.createSecret({
              key: message.data.key,
              value: message.data.value,
              note: message.data.note,
              projectId: message.data.projectId
            });
            vscode.window.showInformationMessage('Secret created successfully!');
            provider.refresh();
            panel.dispose();
          } catch (error) {
            panel.webview.postMessage({
              command: 'error',
              message: `Failed to create secret: ${error}`
            });
          }
          break;
        case 'cancel':
          panel.dispose();
          break;
      }
    },
    undefined,
    context.subscriptions
  );
}