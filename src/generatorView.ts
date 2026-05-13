import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

type GeneratorMessage =
	| { type: 'pickDiagram' }
	| { type: 'pickTargetFolder' }
	| { type: 'generate'; diagramPath: string; framework: string; targetFolder: string }
	| { type: 'openManual' }
	| { type: 'openBigUML' } 
	| { type: 'openTargetFolder'; targetFolder: string }
	| { type: 'scanUmlFiles' };

export class MotxtGeneratorViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'motxtSidebarView';

	// Added the strict type `() => void` to the callback parameter
	constructor(
		private readonly context: vscode.ExtensionContext, 
		private readonly onSidebarVisible?: () => void
	) {}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri]
		};

		webviewView.webview.html = this.getHtml(webviewView.webview);

		// --- NEW LIFECYCLE LOGIC START ---
		// 1. Listen for when the user toggles the sidebar visibility
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible && this.onSidebarVisible) {
				this.onSidebarVisible();
			}
			// Re-scan .uml files when sidebar becomes visible
			if (webviewView.visible) {
				void this.sendUmlFiles(webviewView);
			}
		});

		// 2. Trigger immediately on initial load just in case it resolves already visible
		if (this.onSidebarVisible) {
			this.onSidebarVisible();
		}
		void this.sendUmlFiles(webviewView);
		// --- NEW LIFECYCLE LOGIC END ---

		const disposable = webviewView.webview.onDidReceiveMessage((message: GeneratorMessage) => {
			void this.handleMessage(webviewView, message);
		});

		this.context.subscriptions.push(disposable);
	}

	private async sendUmlFiles(webviewView: vscode.WebviewView): Promise<void> {
		const uris = await vscode.workspace.findFiles('**/*.uml', '**/{node_modules,venv,.venv,env,.env}/**');
		const files = uris.map(uri => ({ label: path.basename(uri.fsPath), fsPath: uri.fsPath }));
		void webviewView.webview.postMessage({ type: 'umlFilesFound', files });
	}	private async handleMessage(
		webviewView: vscode.WebviewView,
		message: GeneratorMessage
	): Promise<void> {
		switch (message.type) {
			case 'pickDiagram': {
				const diagram = await vscode.window.showOpenDialog({
					canSelectMany: false,
					openLabel: 'Select Class Diagram File',
					filters: {
						'Class Diagram Files': ['uml']
					}
				});

				if (diagram && diagram.length > 0) {
					void webviewView.webview.postMessage({
						type: 'diagramAdded',
						label: path.basename(diagram[0].fsPath),
						fsPath: diagram[0].fsPath
					});
				}
				return;
			}
			case 'pickTargetFolder': {
				const folder = await vscode.window.showOpenDialog({
					canSelectMany: false,
					openLabel: 'Select Target Folder',
					canSelectFolders: true,
					canSelectFiles: false
				});

				if (folder && folder.length > 0) {
					void webviewView.webview.postMessage({
						type: 'targetSelected',
						value: folder[0].fsPath
					});
				}
				return;
			}
			case 'generate': {
				const diagramPath = message.diagramPath?.trim();
				const targetFolder = message.targetFolder?.trim();
				const framework = message.framework?.trim();

				if (!diagramPath || !targetFolder || !framework) {
					vscode.window.showWarningMessage('Please choose a diagram, framework, and target folder.');
					void webviewView.webview.postMessage({
						type: 'status',
						value: 'Please fill in all fields before generating.'
					});
					void webviewView.webview.postMessage({ type: 'generateDone' });
					return;
				}

				const outputPath = path.join(targetFolder, framework);
				const jarDir = this.context.asAbsolutePath('src');
				const jarCandidates = fs
					.readdirSync(jarDir)
					.filter(file => file.startsWith('motxt') && file.endsWith('.jar'))
					.sort();

				if (jarCandidates.length === 0) {
					vscode.window.showErrorMessage('Generator JAR not found in extension src folder.');
					void webviewView.webview.postMessage({
						type: 'status',
						value: 'Generator JAR not found in extension src folder.'
					});
					void webviewView.webview.postMessage({ type: 'generateDone' });
					return;
				}

				const jarPath = path.join(jarDir, jarCandidates[jarCandidates.length - 1]);
				const classPath = jarPath + path.delimiter + path.join(jarDir, '*');

				vscode.window.showInformationMessage(`Generating ${framework} for ${path.basename(diagramPath)}...`);
				void webviewView.webview.postMessage({
					type: 'status',
					value: `Generating ${framework}...`
				});

				const javaArgs = [
					'-cp',
					classPath,
					'id.ac.ui.cs.ppl.motxt.main.Generate',
					diagramPath,
					outputPath,
					framework
				];

				execFile('java', javaArgs, (error, stdout, stderr) => {
					if (error) {
						vscode.window.showErrorMessage(`Error: ${error.message}`);
						void webviewView.webview.postMessage({
							type: 'status',
							value: `Error: ${error.message}`
						});
						void webviewView.webview.postMessage({ type: 'generateDone' });
						return;
					}
					if (stderr) {
						vscode.window.showWarningMessage(`Stderr: ${stderr}`);
						void webviewView.webview.postMessage({
							type: 'status',
							value: `Stderr: ${stderr}`
						});
						void webviewView.webview.postMessage({ type: 'generateDone' });
						return;
					}
					if (stdout) {
						console.log(`Stdout: ${stdout}`);
					}
					vscode.window.showInformationMessage('Code Generation Completed!');
					void webviewView.webview.postMessage({
						type: 'status',
						value: 'Code generation completed.'
					});
					void webviewView.webview.postMessage({
						type: 'generationSuccess'
					});
				});
				return;
			}
			case 'scanUmlFiles': {
				await this.sendUmlFiles(webviewView);
				return;
			}
			case 'openManual': {
				await vscode.commands.executeCommand('motxt.openUserManual');
				return;
			}
			case 'openBigUML': {
				try {
					await vscode.commands.executeCommand('bigUML.model.newEmpty');
				} catch (error) {
					vscode.window.showErrorMessage('Please install bigUML extension to create class diagrams.');
				}
				return;
			}
			case 'openTargetFolder': {
				const { targetFolder } = message;
				if (!targetFolder?.trim()) {
					vscode.window.showWarningMessage('Please select a target folder first.');
					return;
				}
				const folderUri = vscode.Uri.file(targetFolder.trim());
				await vscode.commands.executeCommand('vscode.openFolder', folderUri, { forceNewWindow: true });
				return;
			}
			default:
				return;
		}
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = getNonce();
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		:root {
			color-scheme: light dark;
		}

		body {
			margin: 0;
			padding: 16px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background: var(--vscode-sideBar-background);
		}

		form {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		label {
			font-weight: 600;
		}

		.field {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		.input-row {
			display: grid;
			grid-template-columns: 1fr auto;
			gap: 8px;
			align-items: center;
		}

		input, select, button {
			font: inherit;
		}

		input, select {
			padding: 6px 8px;
			color: var(--vscode-input-foreground);
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border, transparent);
			border-radius: 4px;
		}

		button {
			padding: 6px 12px;
			color: var(--vscode-button-foreground);
			background: var(--vscode-button-background);
			border: 1px solid var(--vscode-button-background);
			border-radius: 4px;
			cursor: pointer;
		}

		button.secondary {
			color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
			background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
			border-color: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
		}

		button:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.actions {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.status {
			margin: 0;
			color: var(--vscode-foreground);
			min-height: 1.2em;
		}

		.progress-bar {
			width: 100%;
			height: 4px;
			background: var(--vscode-input-border, var(--vscode-editorWidget-border, #c8c8c8));
			border-radius: 2px;
			overflow: hidden;
			position: relative;
			visibility: hidden;
		}

		.progress-bar.active {
			visibility: visible;
		}

		.progress-bar-inner {
			position: absolute;
			top: 0;
			left: 0;
			height: 100%;
			width: 40%;
			background: var(--vscode-progressBar-background, var(--vscode-button-background, #0078d4));
			border-radius: 2px;
			animation: indeterminate 1.4s ease-in-out infinite;
		}

		@keyframes indeterminate {
			0%   { transform: translateX(-250%); }
			100% { transform: translateX(400%); }
		}
	</style>
</head>
<body>
	<form id="generator-form">
		<div class="actions">
			<button type="button" class="secondary" id="open-biguml">Create UML Class Diagram</button>
			<button type="button" class="secondary" id="open-manual">Open User Manual</button>
		</div>
		<div class="field">
			<label for="diagram">Class diagram (.uml)</label>
			<div class="input-row">
				<select id="diagram">
					<option value="">Select a .uml file</option>
				</select>
				<button type="button" class="secondary" id="pick-diagram">Browse</button>
			</div>
		</div>

		<div class="field">
			<label for="framework">Framework</label>
			<select id="framework">
				<option value="" selected>Select framework</option>
				<option value="Django">Django</option>
				<option value="FastAPI">FastAPI</option>
				<option value="FastAPI-React">FastAPI with React</option>
			</select>
		</div>

		<div class="field">
			<label for="target">Target folder</label>
			<div class="input-row">
				<input id="target" type="text" placeholder="Select output folder" />
				<button type="button" class="secondary" id="pick-target">Browse</button>
			</div>
		</div>

		<div class="actions">
			<button type="submit" id="generate">Generate</button>
			<button type="button" class="secondary" id="open-target-folder" disabled>Open Target Folder</button>
		</div>
		<div class="progress-bar" id="progress-bar">
			<div class="progress-bar-inner"></div>
		</div>
		<p id="status" class="status" aria-live="polite"></p>
	</form>

	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const diagramSelect = document.getElementById('diagram');
		const frameworkSelect = document.getElementById('framework');
		const targetInput = document.getElementById('target');
		const statusEl = document.getElementById('status');
		const pickDiagram = document.getElementById('pick-diagram');
		const pickTarget = document.getElementById('pick-target');
		const form = document.getElementById('generator-form');
		const openManual = document.getElementById('open-manual');
		const openBigUML = document.getElementById('open-biguml');
		const openTargetFolder = document.getElementById('open-target-folder');
		const progressBar = document.getElementById('progress-bar');

		const setStatus = (message) => {
			statusEl.textContent = message || '';
		};

		const setLoading = (loading) => {
			progressBar.classList.toggle('active', loading);
			document.getElementById('generate').disabled = loading;
		};

		// Persist form state so it survives sidebar hide/show cycles
		const saveState = () => {
			vscode.setState({
				diagramValue: diagramSelect.value,
				frameworkValue: frameworkSelect.value,
				targetValue: targetInput.value,
				openTargetFolderDisabled: openTargetFolder.disabled,
				statusText: statusEl.textContent,
				// Persist the full list of diagram options (including browsed files)
				diagramOptions: Array.from(diagramSelect.options).map(o => ({ value: o.value, label: o.textContent }))
			});
		};

		// Restore state from previous session if available
		const previousState = vscode.getState();
		if (previousState) {
			// Restore diagram options first
			if (previousState.diagramOptions) {
				previousState.diagramOptions.forEach(({ value, label }) => {
					if (value && !Array.from(diagramSelect.options).some(o => o.value === value)) {
						const opt = document.createElement('option');
						opt.value = value;
						opt.textContent = label;
						diagramSelect.appendChild(opt);
					}
				});
			}
			if (previousState.diagramValue) { diagramSelect.value = previousState.diagramValue; }
			if (previousState.frameworkValue) { frameworkSelect.value = previousState.frameworkValue; }
			if (previousState.targetValue) { targetInput.value = previousState.targetValue; }
			if (previousState.statusText) { setStatus(previousState.statusText); }
			openTargetFolder.disabled = previousState.openTargetFolderDisabled !== false;
		}

		// Scan workspace .uml files on load
		vscode.postMessage({ type: 'scanUmlFiles' });

		pickDiagram.addEventListener('click', () => {
			vscode.postMessage({ type: 'pickDiagram' });
		});

		pickTarget.addEventListener('click', () => {
			vscode.postMessage({ type: 'pickTargetFolder' });
		});

		// Reset open folder button if inputs change
		[diagramSelect, targetInput, frameworkSelect].forEach(el => {
			el.addEventListener('change', () => {
				openTargetFolder.disabled = true;
				saveState();
			});
		});
		targetInput.addEventListener('input', () => { openTargetFolder.disabled = true; saveState(); });

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			setStatus('');
			setLoading(true);
			vscode.postMessage({
				type: 'generate',
				diagramPath: diagramSelect.value,
				framework: frameworkSelect.value,
				targetFolder: targetInput.value
			});
		});

		openManual.addEventListener('click', () => {
			vscode.postMessage({ type: 'openManual' });
		});

		openBigUML.addEventListener('click', () => {
			vscode.postMessage({ type: 'openBigUML' });
		});

		openTargetFolder.addEventListener('click', () => {
			vscode.postMessage({ type: 'openTargetFolder', targetFolder: targetInput.value });
		});

		window.addEventListener('message', (event) => {
			const message = event.data;
			if (message.type === 'umlFilesFound') {
				// Repopulate dropdown, preserving any extra browsed options
				const currentValue = diagramSelect.value;
				const existingPaths = new Set(
					Array.from(diagramSelect.options).map(o => o.value)
				);
				message.files.forEach(({ label, fsPath }) => {
					if (!existingPaths.has(fsPath)) {
						const opt = document.createElement('option');
						opt.value = fsPath;
						opt.textContent = label;
						diagramSelect.appendChild(opt);
					}
				});
				// Restore selection if still present
				if (currentValue) {
					diagramSelect.value = currentValue;
				}
				saveState();
			}
			if (message.type === 'diagramAdded') {
				// Add browsed file to dropdown if not already there
				const exists = Array.from(diagramSelect.options).some(o => o.value === message.fsPath);
				if (!exists) {
					const opt = document.createElement('option');
					opt.value = message.fsPath;
					opt.textContent = message.label;
					diagramSelect.appendChild(opt);
				}
				diagramSelect.value = message.fsPath;
				openTargetFolder.disabled = true;
				saveState();
			}
			if (message.type === 'targetSelected') {
				targetInput.value = message.value;
				openTargetFolder.disabled = true;
				saveState();
			}
			if (message.type === 'status') {
				setStatus(message.value);
				saveState();
			}
			if (message.type === 'generateDone') {
				setLoading(false);
			}
			if (message.type === 'generationSuccess') {
				setLoading(false);
				openTargetFolder.disabled = false;
				saveState();
			}
		});
	</script>
</body>
</html>`;
	}
}

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i += 1) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}