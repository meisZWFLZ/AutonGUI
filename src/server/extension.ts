import * as vscode from "vscode";
// import { CatScratchEditorProvider } from './catScratchEditor';
import { AutonEditorProvider } from "./autonEditor";
import { AutonTreeProvider } from "./autonTreeView";

export function activate(context: vscode.ExtensionContext) {
  // test command
  context.subscriptions.push(
    vscode.commands.registerCommand("vrc-auton.symbol-test", () => {
      vscode.commands
        .executeCommand<vscode.DocumentSymbol[]>(
          "vscode.executeDocumentSymbolProvider",
          vscode.window.activeTextEditor?.document.uri
        )
        .then(async (symbols: vscode.DocumentSymbol[]) => {
          console.log(symbols);
          symbols
            .filter((s) => s.kind === vscode.SymbolKind.Function)
            .forEach((s) =>
              vscode.commands
                .executeCommand(
                  "clangd.ast.retrieve",
                  s.range,
                  vscode.window.activeTextEditor?.document.uri
                )
                .then((ast) => console.log(`"${s.name}": `, ast))
            );
        });
    })
  );

  // create Auton List View
  let autonView: AutonTreeProvider = new AutonTreeProvider(context);

  // Register our custom editor providers
  context.subscriptions.push(
    ...AutonEditorProvider.register(context, autonView)
  );
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
      .flatMap((dir: string): vscode.DocumentFilter[] =>
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
          // console.log({
          //   // workspaceUri,
          //   workspaceFolders,
          //   // pattern,

          //   dir,
          //   // workspaceState,
          //   // keys: workspaceState?.keys(),
          // });
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
}
/**
 * Deactivate the extension.
 */
export function deactivate(): void {}
