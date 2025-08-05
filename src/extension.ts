import * as vscode from 'vscode';
import { ExtensionManager } from './core';

export function activate(context: vscode.ExtensionContext) {
  const extensionManager = new ExtensionManager(context);
  extensionManager.activate();
}


export function deactivate() {}