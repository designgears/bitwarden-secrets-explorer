/**
 * HTML template utilities for webview content generation
 */

/**
 * Common CSS styles for HTML pages
 */
function getCommonStylesLink(): string {
  return '<link rel="stylesheet" type="text/css" href="{{COMMON_CSS_URI}}">';
}

/**
 * Generate HTML page with common structure
 */
function generateHtmlPage(title: string, additionalStylesLink: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${getCommonStylesLink()}
    ${additionalStylesLink}
</head>
<body>
    ${bodyContent}
</body>
</html>`;
}

/**
 * Generate loading HTML with spinner
 */
export function getLoadingHtml(message: string): string {
  const bodyContent = `
    <div class="spinner"></div>
    <div style="text-align: center; color: var(--vscode-descriptionForeground);">
      ${message}
    </div>
  `;
  
  return generateHtmlPage('Loading', '', bodyContent);
}

/**
 * Generate error HTML page
 */
export function getErrorHtml(errorMessage: string): string {
  const bodyContent = `
    <div style="text-align: center; max-width: 500px;">
        <div style="font-size: 48px; color: var(--vscode-errorForeground); margin-bottom: 20px;">⚠️</div>
        <div style="font-size: 20px; font-weight: bold; margin-bottom: 10px; color: var(--vscode-errorForeground);">Error Loading Secret</div>
        <div style="font-size: 14px; color: var(--vscode-descriptionForeground); line-height: 1.5;">${errorMessage}</div>
    </div>
  `;
  
  return generateHtmlPage('Error', '', bodyContent);
}

/**
 * Secret editor specific styles
 */
function getSecretEditorStylesLink(): string {
  return '<link rel="stylesheet" type="text/css" href="{{SECRET_EDITOR_CSS_URI}}">';
}

/**
 * Generate JavaScript for secret editor
 */
function getSecretEditorScript(): string {
  return `
    const vscode = acquireVsCodeApi();
    
    function showError(message) {
      const errorDiv = document.getElementById('error');
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
    
    function hideError() {
      const errorDiv = document.getElementById('error');
      errorDiv.style.display = 'none';
    }
    
    function validateForm() {
      const key = document.getElementById('key').value.trim();
      const value = document.getElementById('value').value.trim();
      const projectId = document.getElementById('projectId').value.trim();
      
      if (!key) {
        showError('Secret key is required');
        return false;
      }
      
      if (!value) {
        showError('Secret value is required');
        return false;
      }
      
      if (!projectId) {
        showError('Project selection is required');
        return false;
      }
      
      hideError();
      return true;
    }
    
    function saveSecret() {
      if (!validateForm()) {
        return;
      }
      
      const data = {
        key: document.getElementById('key').value.trim(),
        value: document.getElementById('value').value.trim(),
        note: document.getElementById('note').value.trim(),
        projectId: document.getElementById('projectId').value.trim()
      };
      
      vscode.postMessage({
        command: 'save',
        data: data
      });
    }
    
    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }
    
    // Listen for messages from the extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'error':
          showError(message.message);
          break;
      }
    });
    
    // Auto-focus first input
    document.addEventListener('DOMContentLoaded', () => {
      const firstInput = document.getElementById('key');
      if (firstInput) {
        firstInput.focus();
      }
    });
  `;
}

/**
 * Generate secret editor HTML
 */
export function getSecretEditorHtml(secret: any, projects: any[], isNewSecret: boolean = false): string {
  const title = isNewSecret ? 'Create New Secret' : `Edit Secret: ${secret.key}`;
  const projectOptions = projects.map(p => 
    `<option value="${p.id}" ${p.id === secret.projectId ? 'selected' : ''}>${p.name}</option>`
  ).join('');
  
  const bodyContent = `
    <div class="container">
      <div class="content loaded">
        <div class="form-container">
          <div id="error" class="error"></div>
          
          <div class="form-group">
            <label for="projectId">Project:</label>
            <select id="projectId">
              ${projectOptions}
            </select>
          </div>
          
          <div class="form-group">
            <label for="key">Secret Key:</label>
            <input type="text" id="key" value="${secret.key || ''}" placeholder="Enter secret key" ${isNewSecret ? '' : 'readonly'}>
          </div>
          
          <div class="form-group">
            <label for="value">Secret Value:</label>
            <textarea id="value" placeholder="Enter secret value">${secret.value || ''}</textarea>
          </div>
          
          <div class="form-group">
            <label for="note">Note:</label>
            <textarea id="note" placeholder="Enter optional note">${secret.note || ''}</textarea>
          </div>
          
          <div class="button-group">
            <button class="primary-button" onclick="saveSecret()">${isNewSecret ? 'Create' : 'Save'}</button>
            <button class="secondary-button" onclick="cancel()">Cancel</button>
          </div>
        </div>
      </div>
    </div>
    
    <script>
      ${getSecretEditorScript()}
    </script>
  `;
  
  return generateHtmlPage(title, getSecretEditorStylesLink(), bodyContent);
}