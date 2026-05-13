# MoTxT User Manual

## What MoTxT Does

MoTxT generates code from UML class diagrams. Currently supported frameworks include:

- Django
- FastAPI
- FastAPI with React

## Requirements

- Java installed and available on PATH.
- [bigUML extension](https://marketplace.visualstudio.com/items?itemName=BIGModelingTools.umldiagram) for creating diagrams inside VS Code.

## Generate Code

MoTxT provides a sidebar in VS Code for easy code generation from your UML class diagrams.

### Using the MoTxT Sidebar

1. **Open the MoTxT Sidebar**
   - Click the MoTxT icon in the VS Code Activity Bar (left side).
   - The sidebar shows the MoTxT panel with code generation controls.

2. **Select Your Class Diagram**
   - Click the **dropdown** or **Browse** button next to "Class diagram (.uml)".
   - The dropdown shows all `.uml` files found in your workspace.
   - If you don't see your file, click **Browse** to manually select it.
   - To create a new diagram, click **Create UML Class Diagram** (requires bigUML extension).

3. **Choose a Framework**
   - Click the **Framework** dropdown.
   - Select one of the supported frameworks:
     - **Django** — Python web framework with built-in admin
     - **FastAPI** — Modern Python API framework
     - **FastAPI-React** — FastAPI backend + React frontend

4. **Select Target Folder**
   - Click **Browse** next to "Target folder".
   - Choose where the generated code will be saved.
   - MoTxT creates a subfolder named after your framework (e.g., `Django/`, `FastAPI/`).

5. **Generate**
   - Click the **Generate** button.
   - MoTxT runs the code generator using Java and Acceleo.
   - A progress indicator shows while generation is running.
   - When complete, you'll see "Code Generation Completed!" notification.

6. **Open Generated Code**
   - After successful generation, click **Open Target Folder** to view the output.
   - The generated project includes:
     - Source code files
     - Configuration files
     - `requirements.txt` (Python projects)
     - `run.bat` / `run.sh` scripts to start the application

### Quick Start Example

1. Open a workspace in VS Code.
2. Click the MoTxT icon in the Activity Bar.
3. If you don't have a `.uml` file, click **Create UML Class Diagram**.
4. Draw your class diagram using bigUML (see [Drawing a Class Diagram](#drawing-a-class-diagram-with-biguml)).
5. In the MoTxT sidebar:
   - Select your `.uml` file from the dropdown
   - Choose **FastAPI-React** as the framework
   - Click **Browse** and select an output folder
   - Click **Generate**
6. Wait for "Code Generation Completed!" message.
7. Click **Open Target Folder** to see your generated project.

### Running Generated Code

#### Django Projects

```bash
cd Django/YourProject
./run.sh          # Linux/Mac
run.bat           # Windows
```

The script creates a virtual environment, installs dependencies, and starts the Django development server on port 8000.

#### FastAPI Projects

```bash
cd FastAPI/YourProject
./run.sh          # Linux/Mac
run.bat           # Windows
```

The script creates a virtual environment, installs dependencies, and starts the FastAPI server on port 8000. Visit `http://localhost:8000/docs` for the interactive API documentation.

#### FastAPI-React Projects

**Backend:**

```bash
cd FastAPI-React/YourProject/backend-fastapi
./run.sh          # Linux/Mac
run.bat           # Windows
```

**Frontend (in a separate terminal):**

```bash
cd FastAPI-React/YourProject/frontend-react
./run.sh          # Linux/Mac
run.bat           # Windows
```

The backend runs on port 8000, and the frontend runs on port 5173 (or next available port). Open `http://localhost:5173` in your browser.

### Automatic Features in Generated Code

All generated projects include:

- **Database Models** — One model per class in your diagram
- **CRUD Operations** — Create, Read, Update, Delete for each model
- **Relationships** — Associations, aggregations, and compositions from your diagram
- **Inheritance** — Generalization relationships using framework-specific patterns
- **API Endpoints** (FastAPI) — RESTful endpoints for each model
- **Admin Interface** (Django) — Pre-configured admin panel
- **React UI** (FastAPI-React) — Full CRUD interface with forms and tables

### Regenerating Code

To regenerate code after modifying your diagram:

1. Save your changes in the bigUML editor.
2. In the MoTxT sidebar, click **Generate** again.
3. Choose the same target folder — MoTxT will overwrite the generated files.

> **Warning:** Regeneration overwrites all generated files. If you've manually edited generated code, back it up first or use a different target folder.

## How File Selection Works

- If no workspace is open, MoTxT will prompt you to create a class diagram with bigUML.
- If exactly one .uml file exists, MoTxT uses it automatically.
- If multiple .uml files exist, MoTxT asks you to choose one from the dropdown.

## Troubleshooting

### "Please install bigUML extension"

Install the [bigUML extension](https://marketplace.visualstudio.com/items?itemName=BIGModelingTools.umldiagram) if you want to create diagrams inside VS Code. You can still use MoTxT with `.uml` files created elsewhere.

### No output generated

- Verify Java is installed: run `java -version` in a terminal
- Check that your `.uml` file is valid (open it in bigUML to verify)
- Look at the VS Code Output panel (View → Output → MoTxT) for error details

### Port already in use

If you see "Port 8000 is already in use" when running generated code:

- Stop any other servers running on that port
- Or edit the `run.sh` / `run.bat` script to use a different port

### Generated code has errors

- Ensure all classes have valid names (no spaces or special characters)
- Check that all properties have types assigned
- Verify relationships are properly connected in the diagram

## Tips

- Keep your .uml files inside the workspace to simplify selection.
- Use short target paths to avoid long path issues on Windows.
- Save your diagram before generating to ensure latest changes are included.
- Use the **Reload** button in the sidebar if your `.uml` file list doesn't update.
- For FastAPI-React projects, start the backend before the frontend.
