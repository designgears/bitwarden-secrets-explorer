import * as vscode from 'vscode';
import { BitwardenSdkService } from '../services/BitwardenSdkService';

/**
 * Welcome view provider that handles different states of the extension
 */
export class BitwardenWelcomeProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'bitwardenWelcome';
  private _view?: vscode.WebviewView;
  private sdkService: BitwardenSdkService;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private context: vscode.ExtensionContext,
    private onStateChange: (hasData: boolean) => void
  ) {
    this.sdkService = new BitwardenSdkService();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    };

    this.updateView();

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'setAccessToken':
          await vscode.commands.executeCommand('bitwardenSecretsExplorer.setAccessToken');
          this.updateView();
          break;
        case 'setOrganizationId':
          await vscode.commands.executeCommand('bitwardenSecretsExplorer.setOrganizationId');
          this.updateView();
          break;
        case 'checkStatus':
          this.updateView();
          break;
        case 'refresh':
          this.updateView();
          break;
      }
    });
  }

  public async updateView() {
    if (!this._view) {
      return;
    }

    // Check if webview is disposed before updating
    try {
      this._view.webview;
    } catch (error) {
      // Webview is disposed, skip update
      return;
    }

    const state = await this.checkCurrentState();
    this._view.webview.html = this.getHtmlForWebview(this._view.webview, state);
    
    // Update the context for when clauses
    vscode.commands.executeCommand('setContext', 'bitwarden.hasData', state.hasData);
    
    // Notify parent about state change
    this.onStateChange(state.hasData);
  }

  private async checkCurrentState(): Promise<{
    hasAccessToken: boolean;
    hasOrganizationId: boolean;
    isAuthenticated: boolean;
    hasProjects: boolean;
    hasData: boolean;
    error?: string;
  }> {
    try {
      // Check access token
      const accessToken = await this.context.secrets.get('bitwardenAccessToken');
      const hasAccessToken = !!accessToken;

      if (!hasAccessToken) {
        return {
          hasAccessToken: false,
          hasOrganizationId: false,
          isAuthenticated: false,
          hasProjects: false,
          hasData: false
        };
      }

      // Check organization ID
      const organizationId = await this.context.secrets.get('bitwardenOrganizationId');
      const hasOrganizationId = !!organizationId;

      if (!hasOrganizationId) {
        return {
          hasAccessToken: true,
          hasOrganizationId: false,
          isAuthenticated: false,
          hasProjects: false,
          hasData: false
        };
      }

      // Test authentication
      try {
        await this.sdkService.testSdkAvailability();
        
        if (!this.sdkService.isClientAuthenticated()) {
          await this.sdkService.authenticate(accessToken);
        }

        // Set the organization ID in the SDK service
        this.sdkService.setOrganizationId(organizationId);

        // Check for projects
        const projects = await this.sdkService.listProjects();
        const hasProjects = projects && projects.length > 0;

        return {
          hasAccessToken: true,
          hasOrganizationId: true,
          isAuthenticated: true,
          hasProjects,
          hasData: hasProjects
        };
      } catch (error) {
        return {
          hasAccessToken: true,
          hasOrganizationId: true,
          isAuthenticated: false,
          hasProjects: false,
          hasData: false,
          error: error instanceof Error ? error.message : 'Authentication failed'
        };
      }
    } catch (error) {
      return {
        hasAccessToken: false,
        hasOrganizationId: false,
        isAuthenticated: false,
        hasProjects: false,
        hasData: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getHtmlForWebview(webview: vscode.Webview, state: any): string {
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'common.css'));
    const styleWelcomeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'welcome.css'));

    const nonce = getNonce();

    if (!state.hasAccessToken) {
      return this.getSetupAccessTokenHtml(webview, styleResetUri, styleVSCodeUri, styleMainUri, styleWelcomeUri, nonce);
    }

    if (!state.hasOrganizationId) {
      return this.getSetupOrganizationHtml(webview, styleResetUri, styleVSCodeUri, styleMainUri, styleWelcomeUri, nonce);
    }

    if (!state.isAuthenticated) {
      return this.getAuthenticationErrorHtml(webview, styleResetUri, styleVSCodeUri, styleMainUri, styleWelcomeUri, nonce, state.error);
    }

    if (!state.hasProjects) {
      return this.getNoProjectsHtml(webview, styleResetUri, styleVSCodeUri, styleMainUri, styleWelcomeUri, nonce);
    }

    // This shouldn't happen as the view should be hidden when hasData is true
    return this.getLoadingHtml(webview, styleResetUri, styleVSCodeUri, styleMainUri, styleWelcomeUri, nonce);
  }

  private getSetupAccessTokenHtml(webview: vscode.Webview, styleResetUri: vscode.Uri, styleVSCodeUri: vscode.Uri, styleMainUri: vscode.Uri, styleWelcomeUri: vscode.Uri, nonce: string): string {
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media/img/logo_trans_sm.png'));
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetUri}" rel="stylesheet">
        <link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <link href="${styleWelcomeUri}" rel="stylesheet">
        <title>Bitwarden Setup</title>
    </head>
    <body>
        <div class="welcome-container">
            <div class="welcome-icon"><img src="${iconUri}" alt="Bitwarden"></div>
            <h2>Welcome to Bitwarden Secrets Explorer</h2>
            <p>To get started, you need to set up your Bitwarden Access Token.</p>
            
            <div class="setup-steps">
                <div class="step active">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h3>Set Access Token</h3>
                        <p>Configure your Bitwarden Secrets Manager access token</p>
                        <button class="primary-button" id="setAccessTokenBtn">Set Access Token</button>
                    </div>
                </div>
                <div class="step disabled">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h3>Set Organization ID</h3>
                        <p>Configure your organization ID</p>
                    </div>
                </div>
                <div class="step disabled">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h3>Access Your Secrets</h3>
                        <p>Browse and manage your secrets</p>
                    </div>
                </div>
            </div>
        </div>

        <script nonce="${nonce}">
            try {
                const vscode = acquireVsCodeApi();

                
                function setAccessToken() {

                    try {
                        vscode.postMessage({ type: 'setAccessToken' });

                    } catch (error) {
                        console.error('Error sending message:', error);
                    }
                }
                
                // Function to add event listener
                function addEventListener() {
                    const button = document.getElementById('setAccessTokenBtn');
                    if (button) {
                        button.addEventListener('click', setAccessToken);

                        return true;
                    } else {

                        return false;
                    }
                }
                
                // Try to add event listener immediately
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', addEventListener);
                } else {
                    // DOM is already loaded
                    if (!addEventListener()) {
                        // If button not found, try again after a short delay
                        setTimeout(addEventListener, 100);
                    }
                }
                
                // Also make function globally available as fallback
                window.setAccessToken = setAccessToken;

            } catch (error) {
                console.error('Error in script initialization:', error);
            }
        </script>
    </body>
    </html>`;
  }

  private getSetupOrganizationHtml(webview: vscode.Webview, styleResetUri: vscode.Uri, styleVSCodeUri: vscode.Uri, styleMainUri: vscode.Uri, styleWelcomeUri: vscode.Uri, nonce: string): string {
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media/img/logo_trans_sm.png'));
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetUri}" rel="stylesheet">
        <link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <link href="${styleWelcomeUri}" rel="stylesheet">
        <title>Bitwarden Setup</title>
    </head>
    <body>
        <div class="welcome-container">
            <div class="welcome-icon"><img src="${iconUri}" alt="Bitwarden"></div>
            <h2>Almost There!</h2>
            <p>Now you need to set your Organization ID.</p>
            
            <div class="setup-steps">
                <div class="step completed">
                    <div class="step-number">✓</div>
                    <div class="step-content">
                        <h3>Access Token Set</h3>
                        <p>Your access token is configured</p>
                    </div>
                </div>
                <div class="step active">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h3>Set Organization ID</h3>
                        <p>Configure your organization ID to access secrets</p>
                        <button class="primary-button" id="setOrganizationIdBtn">Set Organization ID</button>
                    </div>
                </div>
                <div class="step disabled">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h3>Access Your Secrets</h3>
                        <p>Browse and manage your secrets</p>
                    </div>
                </div>
            </div>
        </div>

        <script nonce="${nonce}">
            try {
                const vscode = acquireVsCodeApi();

                
                function setOrganizationId() {

                    try {
                        vscode.postMessage({ type: 'setOrganizationId' });

                    } catch (error) {
                        console.error('Error sending setOrganizationId message:', error);
                    }
                }
                
                // Function to add event listener
                function addEventListener() {
                    const button = document.getElementById('setOrganizationIdBtn');
                    if (button) {
                        button.addEventListener('click', setOrganizationId);

                        return true;
                    } else {

                        return false;
                    }
                }
                
                // Try to add event listener immediately
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', addEventListener);
                } else {
                    // DOM is already loaded
                    if (!addEventListener()) {
                        // If button not found, try again after a short delay
                        setTimeout(addEventListener, 100);
                    }
                }
                
                // Also make function globally available as fallback
                window.setOrganizationId = setOrganizationId;

            } catch (error) {
                console.error('Error in org setup script initialization:', error);
            }
        </script>
    </body>
    </html>`;
  }

  private getAuthenticationErrorHtml(webview: vscode.Webview, styleResetUri: vscode.Uri, styleVSCodeUri: vscode.Uri, styleMainUri: vscode.Uri, styleWelcomeUri: vscode.Uri, nonce: string, error?: string): string {
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media/img/logo_trans_sm.png'));
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetUri}" rel="stylesheet">
        <link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <link href="${styleWelcomeUri}" rel="stylesheet">
        <title>Authentication Error</title>
    </head>
    <body>
        <div class="welcome-container">
            <div class="welcome-icon error"><img src="${iconUri}" alt="Bitwarden"></div>
            <h2>Authentication Error</h2>
            <p>There was an issue authenticating with Bitwarden.</p>
            ${error ? `<div class="error-message">${error}</div>` : ''}
            
            <div class="action-buttons">
                <button class="primary-button" id="updateAccessTokenBtn">Update Access Token</button>
                <button class="secondary-button" id="updateOrganizationIdBtn">Update Organization ID</button>
                <button class="secondary-button" id="tryAgainBtn">Try Again</button>
            </div>
        </div>

        <script nonce="${nonce}">
            try {
                const vscode = acquireVsCodeApi();

                
                function setAccessToken() {

                    try {
                        vscode.postMessage({ type: 'setAccessToken' });

                    } catch (error) {
                        console.error('Error sending message:', error);
                    }
                }
                
                function setOrganizationId() {

                    try {
                        vscode.postMessage({ type: 'setOrganizationId' });

                    } catch (error) {
                        console.error('Error sending message:', error);
                    }
                }
                
                function checkStatus() {

                    try {
                        vscode.postMessage({ type: 'checkStatus' });

                    } catch (error) {
                        console.error('Error sending message:', error);
                    }
                }
                
                // Function to add event listeners
                function addEventListeners() {
                    const updateAccessTokenBtn = document.getElementById('updateAccessTokenBtn');
                    const updateOrganizationIdBtn = document.getElementById('updateOrganizationIdBtn');
                    const tryAgainBtn = document.getElementById('tryAgainBtn');
                    
                    if (updateAccessTokenBtn) {
                        updateAccessTokenBtn.addEventListener('click', setAccessToken);

                    } else {

                    }
                    
                    if (updateOrganizationIdBtn) {
                        updateOrganizationIdBtn.addEventListener('click', setOrganizationId);

                    } else {

                    }
                    
                    if (tryAgainBtn) {
                        tryAgainBtn.addEventListener('click', checkStatus);

                    } else {

                    }
                }
                
                // Robust DOM ready state checking
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', addEventListeners);
                } else {
                    // DOM is already loaded
                    addEventListeners();
                    // Fallback: try again after a short delay if buttons weren't found
                    setTimeout(() => {
                        if (!document.getElementById('updateAccessTokenBtn') || 
                            !document.getElementById('updateOrganizationIdBtn') || 
                            !document.getElementById('tryAgainBtn')) {

                            addEventListeners();
                        }
                    }, 100);
                }
                
            } catch (error) {
                console.error('Error in script initialization:', error);
            }
        </script>
    </body>
    </html>`;
  }

  private getNoProjectsHtml(webview: vscode.Webview, styleResetUri: vscode.Uri, styleVSCodeUri: vscode.Uri, styleMainUri: vscode.Uri, styleWelcomeUri: vscode.Uri, nonce: string): string {
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media/img/logo_trans_sm.png'));
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetUri}" rel="stylesheet">
        <link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <link href="${styleWelcomeUri}" rel="stylesheet">
        <title>No Projects</title>
    </head>
    <body>
        <div class="welcome-container">
            <div class="welcome-icon"><img src="${iconUri}" alt="Bitwarden"></div>
            <h2>No Projects Found</h2>
            <p>You don't have any projects in your Bitwarden Secrets Manager yet.</p>
            
            <div class="info-box">
                <h3>Get Started</h3>
                <p>Create your first project in the Bitwarden web vault or use the command palette to create one here.</p>
            </div>
            
            <div class="action-buttons">
                <button class="primary-button" id="refreshBtn">Refresh</button>
            </div>
        </div>

        <script nonce="${nonce}">
            try {
                const vscode = acquireVsCodeApi();

                
                function refresh() {

                    try {
                        vscode.postMessage({ type: 'refresh' });

                    } catch (error) {
                        console.error('Error sending refresh message:', error);
                    }
                }
                
                // Function to add event listener
                function addEventListener() {
                    const button = document.getElementById('refreshBtn');
                    if (button) {
                        button.addEventListener('click', refresh);

                        return true;
                    } else {

                        return false;
                    }
                }
                
                // Robust DOM ready state checking
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', addEventListener);
                } else {
                    // DOM is already loaded
                    if (!addEventListener()) {
                        // If button not found, try again after a short delay
                        setTimeout(addEventListener, 100);
                    }
                }
                
                // Also make function globally available as fallback
                window.refresh = refresh;

            } catch (error) {
                console.error('Error in no projects script initialization:', error);
            }
        </script>
    </body>
    </html>`;
  }

  private getLoadingHtml(webview: vscode.Webview, styleResetUri: vscode.Uri, styleVSCodeUri: vscode.Uri, styleMainUri: vscode.Uri, styleWelcomeUri: vscode.Uri, nonce: string): string {
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media/img/logo_trans_sm.png'));
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetUri}" rel="stylesheet">
        <link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <link href="${styleWelcomeUri}" rel="stylesheet">
        <title>Loading</title>
    </head>
    <body>
        <div class="welcome-container">
            <div class="welcome-icon"><img src="${iconUri}" alt="Bitwarden"></div>
            <h2>Loading...</h2>
            <p>Checking your Bitwarden configuration...</p>
        </div>
    </body>
    </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}