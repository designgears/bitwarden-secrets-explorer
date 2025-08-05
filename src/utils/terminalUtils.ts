import * as vscode from 'vscode';
import * as os from 'os';

export type TerminalType = 'wsl' | 'cmd' | 'powershell' | 'unix';

const WSL_TERMINAL_NAMES = ['wsl', 'ubuntu', 'debian', 'kali', 'opensuse', 'fedora', 'alpine', 'bash'];

/**
 * Detects the type of terminal currently active in VS Code
 * @returns The detected terminal type
 */
export function detectTerminalType(): TerminalType {
  const platform = os.platform();
  
  if (platform !== 'win32') {
    return 'unix';
  }
  
  const activeTerminal = vscode.window.activeTerminal;
  const terminalName = activeTerminal?.name.toLowerCase() || '';
  
  if (WSL_TERMINAL_NAMES.some(name => terminalName.includes(name))) {
    return 'wsl';
  } else if (terminalName.includes('cmd')) {
    return 'cmd';
  } else {
    return 'powershell'; // Default for Windows
  }
}

/**
 * Generates the appropriate environment variable command for the detected terminal
 * @param key The environment variable name
 * @param value The environment variable value
 * @returns The formatted command string
 */
export function getEnvVarCommand(key: string, value: string): string {
  const terminalType = detectTerminalType();
  const escapedValue = value.replace(/"/g, '\\"').replace(/'/g, "\\'");
  
  switch (terminalType) {
    case 'wsl':
    case 'unix':
      return `export ${key}="${escapedValue}"`;
    case 'cmd':
      return `set "${key}=${escapedValue}"`;
    case 'powershell':
      return `$env:${key}="${value.replace(/"/g, '`"')}"`;
  }
}

/**
 * Gets instructions for checking environment variables in the detected terminal
 * @returns Instructions string for the current terminal type
 */
export function getEnvCheckInstructions(): string {
  const terminalType = detectTerminalType();
  
  switch (terminalType) {
    case 'wsl':
    case 'unix':
      return 'Check with: echo $VARIABLE_NAME';
    case 'cmd':
      return 'Check with: echo %VARIABLE_NAME%';
    case 'powershell':
      return 'Check with: $env:VARIABLE_NAME';
  }
}

/**
 * Gets the appropriate clear command for the detected terminal
 * @returns The clear command string for the current terminal type
 */
export function getClearCommand(): string {
  const terminalType = detectTerminalType();
  
  switch (terminalType) {
    case 'wsl':
    case 'unix':
      return 'clear';
    case 'cmd':
      return 'cls';
    case 'powershell':
      return 'Clear-Host';
  }
}