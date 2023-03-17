import * as vscode from "vscode";
// import { CatScratchEditorProvider } from './catScratchEditor';
import { WaffltonEditorProvider } from "./wflAutonEditor";

export function activate(context: vscode.ExtensionContext) {
  // Register our custom editor providers
  // context.subscriptions.push(CatScratchEditorProvider.register(context));
  // context.subscriptions.push(WaffltonEditorProvider.register(context));
  function isCpp(
    input: vscode.TextEditor | vscode.TextDocument | vscode.Uri | undefined
  ): boolean {
    if (input)
      if ("document" in input) return input?.document.languageId === "cpp";
      else if ("languageId" in input) return input.languageId === "cpp";
      else if ("toString" in input) return input.toString().endsWith(".cpp");
    return false;
  }
  const getDocumentSelector = (): vscode.DocumentSelector =>
    (
      vscode.workspace
        .getConfiguration("vrc-auton")
        .get("directory") as string[]
    )
      .map(
        (dir) => dir.replace("\\", "/").replace(/(^\.?\/)|(\/$)/g, "") + "/**"
      )
      .flatMap(
        (dir: string): vscode.DocumentFilter[] =>
          ["cpp", "c"].flatMap((language) => {
						/**
						 * 
						 * @returns 
						 */
            function getLastPathSection(uri: vscode.Uri): string {
              return uri.path.split("/").at(-1) as string;
            }
            let workspaceFolders: Readonly<vscode.WorkspaceFolder[]> =
              vscode.workspace.workspaceFolders ?? [];

            //
            let workspaceFolder: vscode.WorkspaceFolder | undefined =
              workspaceFolders.find((folder) =>
                dir.startsWith(getLastPathSection(folder.uri))
              );
            let patterns: vscode.RelativePattern[];
            if (workspaceFolder) {
              workspaceFolders = [workspaceFolder];
              dir = dir.substring(
                getLastPathSection(workspaceFolder.uri).length + 1
              );
            }
            patterns = workspaceFolders.map(
              (folder) => new vscode.RelativePattern(folder, dir)
            );
            console.log({
              // workspaceUri,
              workspaceFolders,
              // pattern,

              dir,
              // workspaceState,
              // keys: workspaceState?.keys(),
            });
            return patterns?.map((pattern) => {
              return {
                pattern,
                language,
                scheme: "file",
              };
            });
          })

      );
  function inAutonDirectory(
    document: vscode.TextDocument | undefined
  ): boolean {
    // let selector = getDocumentSelector();
    // let match = !!document && vscode.languages.match(selector, document);
    // let out = match > 0;
    // console.log({
    //   selector,
    //   match,
    //   out: out ? "inAutonDir" : "outsideAutonDir",
    // });
    return (
      !!document && vscode.languages.match(getDocumentSelector(), document) > 0
    );
  }

  function onDidChangeActiveTextEditor(
    textEditor: vscode.TextEditor | undefined
  ): void {
    // if (isCpp(textEditor)) console.log("enable");
    // else console.log("disable");

    inAutonDirectory(textEditor?.document);
    console.log("onDidChangeActiveTextEditor" /* textEditor */);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vrc-auton.builder.show",
      async (uri: vscode.Uri) => {
        // const actualUri = uri || vscode.window.activeTextEditor?.document.uri;
        // // if (isCpp(actualUri)) console.log("enable");
        // // else console.log("disable");
        // console.log("command:vrc-auton.builder.show", actualUri);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "vrc-auton.builder.showToSide",
      async (textEditor) => {
        // if (isCpp(textEditor)) console.log("enable");
        // else console.log("disable");
        // console.log("command:vrc-auton.builder.showToSide", textEditor);
      }
    )
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor)
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(
      (event: vscode.TextDocumentChangeEvent) => {
        // if (isCpp(event.document)) console.log("enable");
        // else console.log("disable");
        inAutonDirectory(event.document);
        console.log("onDidChangeTextDocument" /* event */);
      }
    )
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(
      (event: vscode.TextEditorSelectionChangeEvent) => {
        // if (isCpp(event.textEditor)) console.log("enable");
        // else console.log("disable");
        inAutonDirectory(event.textEditor.document);
        console.log("onDidChangeTextEditorSelection" /* event */);
      }
    )
  );

  // context.subscriptions.push(
  //   vscode.window.registerWebviewPanelSerializer('svgPreview', previewPanel)
  // )
}
/**
 * Deactivate the extension.
 */
export function deactivate(): void {}
