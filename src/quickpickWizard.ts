import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
    // The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

export function quickpickDisposable(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('motxt.runAcceleoGenerator', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Running Acceleo Generator from MoTxT!');
        

		let modelPath = '';
		let modelName = '';
		const workspaceFolders = vscode.workspace.workspaceFolders;
		console.log('Workspace folders:', workspaceFolders?.length);
		if (!workspaceFolders || workspaceFolders.length === 0 ) {
			vscode.window.showWarningMessage('Please create a class diagram using bigUML first.');
            try{
                vscode.window.showInformationMessage('Opening bigUML to create a class diagram...');
                vscode.commands.executeCommand('bigUML.model.newEmpty');
            } catch (error) {
                vscode.window.showErrorMessage('Please install bigUML extension to create class diagrams.');
            }
			return;
		}
		const umlFilesInWorkspace = await vscode.workspace.findFiles('**/*.uml');
		if (umlFilesInWorkspace.length === 0) {
            vscode.window.showQuickPick(['Create Class Diagram with bigUML', 'Select Class Diagram File'], {
                placeHolder: 'No .uml files found in workspace. What would you like to do?',
                ignoreFocusOut: true
            }).then(async (choice) => {
                if (!choice) {
                    vscode.window.showWarningMessage('Code generation cancelled: No option selected.');
                    return; // Berhenti jika user menekan ESC atau tidak memilih opsi
                }
                if (choice === 'Create Class Diagram with bigUML') {
                    try {
                        vscode.window.showInformationMessage('Opening bigUML to create a class diagram...');
                        await vscode.commands.executeCommand('bigUML.model.newEmpty');
                        umlFilesInWorkspace.push(...await vscode.workspace.findFiles('**/*.uml')); // Refresh daftar file .uml setelah membuka bigUML
                        if (umlFilesInWorkspace.length === 0) {
                            vscode.window.showWarningMessage('No .uml files found after opening bigUML. Please create and save a class diagram before generating code.');
                            return;
                        }
                    } catch (error) {
                        vscode.window.showErrorMessage('Please install bigUML extension to create class diagrams.');
                    }
                } else if (choice === 'Select Class Diagram File') {
                    const classDiagramFile = await vscode.window.showOpenDialog({
                        canSelectMany: false,
                        openLabel: 'Select Class Diagram File',
                        filters: {
                            'Class Diagram Files': ['uml']
                        }
                    });
                    if (!classDiagramFile || classDiagramFile.length === 0) {
                        vscode.window.showWarningMessage('Code generation cancelled: No class diagram file selected.');
                        return; // Berhenti jika user menekan ESC atau tidak memilih file
                    }
                    modelPath = classDiagramFile[0].fsPath;
                    modelName = path.parse(modelPath).name;
                }
            });
		} else if (umlFilesInWorkspace.length === 1) {
			vscode.window.showInformationMessage(`Found one .uml file in workspace: ${umlFilesInWorkspace[0].fsPath}. Using it for code generation.`);
			modelPath = umlFilesInWorkspace[0].fsPath;
			modelName = path.parse(modelPath).name;
		} else {
			const selectedClassDiagram = await vscode.window.showQuickPick(
				umlFilesInWorkspace.map(file => ({
					label: path.basename(file.fsPath),
					description: vscode.workspace.asRelativePath(file.fsPath),
					file
				})),
				{
					placeHolder: 'Select the .uml file to use',
					ignoreFocusOut: true
				}
			);

			if (!selectedClassDiagram) {
				vscode.window.showWarningMessage('Code generation cancelled: No class diagram file selected.');
				return;
			}

			modelPath = selectedClassDiagram.file.fsPath;
			modelName = path.parse(modelPath).name;

		}
		if (!modelPath) {
			vscode.window.showWarningMessage('Code generation cancelled: No class diagram file selected.');
			return;
		}
		const frameworkOptions: { label: string; value: string }[] = [
			{ label: 'Django', value: 'Django' },
			{ label: 'FastAPI', value: 'FastAPI' },
			{ label: 'FastAPI with React', value: 'FastAPI-React' }
		];
		
		
		const targetFramework = await vscode.window.showQuickPick(frameworkOptions, {
            placeHolder: 'Choose the target framework for code generation',
            ignoreFocusOut: true // Mencegah wizard tertutup jika user klik di luar
        });

		if (!targetFramework) {
            vscode.window.showWarningMessage('Code generation cancelled: No framework selected.');
            return; // Berhenti jika user menekan ESC
        }
		const targetFolder = await vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: 'Select Target Folder for Generated Code',
			canSelectFolders: true,
			canSelectFiles: false
		});
		if (!targetFolder || targetFolder.length === 0) {
			vscode.window.showWarningMessage('No target folder selected. Code generation cancelled.');
			return; // Berhenti jika user menekan ESC atau tidak memilih folder
		}
		const targetFolderPath = targetFolder[0].fsPath;
		const selectedFrameworkValue = targetFramework.value;
		const outputPath = path.join(targetFolderPath, selectedFrameworkValue);
		
		const jarDir = context.asAbsolutePath('src');
		const jarCandidates = fs.readdirSync(jarDir)
			.filter(file => file.startsWith('motxt') && file.endsWith('.jar'))
			.sort();

		if (jarCandidates.length === 0) {
			vscode.window.showErrorMessage('Generator JAR not found in extension src folder.');
			return;
		}

		const jarPath = path.join(jarDir, jarCandidates[jarCandidates.length - 1]);
		const classPath = jarPath + path.delimiter + path.join(jarDir, '*');
		// --- EKSEKUSI LOGIKA UTAMA DI SINI ---
		vscode.window.showInformationMessage(`Generating ${targetFramework.label} for ${modelPath}...`);

		const javaArgs = [
			'-cp',
			classPath,
			'id.ac.ui.cs.ppl.motxt.main.Generate',
			modelPath,
			outputPath,
			selectedFrameworkValue
		];

		console.log(`Executing Java with arguments: ${javaArgs.join(' ')}`);

		execFile('java', javaArgs, (error, stdout, stderr) => {
			if (error) {
				vscode.window.showErrorMessage(`Error: ${error.message}`);
				console.error(`Error: ${error.message}`);
				return;
			}
			if (stderr) {
				vscode.window.showWarningMessage(`Stderr: ${stderr}`);
				console.warn(`Stderr: ${stderr}`);
				return;
			}
			if (stdout) {
				console.log(`Stdout: ${stdout}`);
			}
			vscode.window.showInformationMessage('Code Generation Completed!');
		});
		
	
	});
    return disposable;
}