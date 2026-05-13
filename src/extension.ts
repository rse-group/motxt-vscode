// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { quickpickDisposable } from './quickpickWizard';
import { openUserManualPanel } from './userManualView';
import { MotxtGeneratorViewProvider } from './generatorView';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "motxt" is now active!');

	
	const disposable = quickpickDisposable(context);
	const manualDisposable = vscode.commands.registerCommand('motxt.openUserManual', () => {
		openUserManualPanel(context);
		context.workspaceState.update('motxt.hasOpenedManual', true);
	});

	const onSidebarVisible = () => {
        // Use workspaceState so the manual auto-opens once per workspace,
        // not just once ever (globalState persists across all workspaces).
        const hasOpenedBefore = context.workspaceState.get<boolean>('motxt.hasOpenedManual', false);

        if (!hasOpenedBefore) {
            // Mark it first to prevent double-open if the callback fires twice on init
            context.workspaceState.update('motxt.hasOpenedManual', true);
            // Execute the command to open the manual
            vscode.commands.executeCommand('motxt.openUserManual');
        }
    };

	const generatorProvider = new MotxtGeneratorViewProvider(context, onSidebarVisible);

	context.subscriptions.push(
		disposable,
		manualDisposable,
		vscode.window.registerWebviewViewProvider(MotxtGeneratorViewProvider.viewType, generatorProvider)
	);
}

// This method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {
}

