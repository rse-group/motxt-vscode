import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let manualPanel: vscode.WebviewPanel | undefined;

export async function openUserManualPanel(context: vscode.ExtensionContext): Promise<void> {
    if (manualPanel) {
        manualPanel.reveal(vscode.ViewColumn.Active);
        return;
    }

    manualPanel = vscode.window.createWebviewPanel(
        'motxtUserManualPanel',
        'MoTxT User Manual',
        vscode.ViewColumn.Active,
        {
            enableScripts: false,
            // Best practice: Restrict webview to only read from your docs folder
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'docs')] 
        }
    );

    manualPanel.onDidDispose(() => {
        manualPanel = undefined;
    });

    manualPanel.webview.html = await getHtml(context, manualPanel.webview);
}

async function getHtml(context: vscode.ExtensionContext, webview: vscode.Webview): Promise<string> {
    const manualPath = context.asAbsolutePath('docs/user-manual.md');
    let content = '<p>User manual not found.</p>';

    try {
        const markdown = fs.readFileSync(manualPath, 'utf8');
        
        // Parse the markdown into standard HTML
        const { marked } = await import('marked');
        const htmlContent = marked.parse(markdown) as string;

        // Replace relative image sources with VS Code Webview URIs
        content = htmlContent.replace(/src="(.*?)"/g, (match, imagePath) => {
            // Ignore external web links (http/https)
            if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                return match;
            }

            // Construct the local path to the image inside the 'docs' folder
            const localUri = vscode.Uri.file(path.join(context.extensionPath, 'docs', imagePath));
            
            // Convert to the special vscode-resource URI
            const webviewUri = webview.asWebviewUri(localUri);
            
            return `src="${webviewUri}"`;
        });
    } catch (error) {
        console.error("Failed to load or parse user manual:", error);
        content = '<p>Unable to load the user manual.</p>';
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline';">
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
            color: var(--vscode-editor-foreground, var(--vscode-foreground));
            background: var(--vscode-editor-background);
        }

        main {
            line-height: 1.5;
        }

        h1, h2, h3 {
            margin: 0 0 8px 0;
            font-weight: 600;
        }

        h1 { font-size: 1.4rem; }
        
        h2 {
            margin-top: 16px;
            font-size: 1.1rem;
            color: var(--vscode-editor-foreground, var(--vscode-foreground));
        }

        p { margin: 0 0 8px 0; }
        
        ul, ol {
            margin: 0 0 8px 18px;
            padding: 0;
        }

        code {
            font-family: var(--vscode-editor-font-family);
            background: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.15));
            padding: 1px 4px;
            border-radius: 3px;
        }

        /* Added to prevent images from overflowing the webview */
        img {
            max-width: 100%;
            height: auto;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <main>
        ${content}
    </main>
</body>
</html>`;
}