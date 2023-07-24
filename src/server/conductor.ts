import * as vscode from "vscode";
import { AutonList } from "./autonList";
import { ASTTranslator } from "./astTranslator";
import { AutonTreeProvider } from "./autonTreeView";

/**
 * Coordinate classes to make them work together
 */
export class Conductor {
  private readonly autonWatcher: vscode.FileSystemWatcher;
  private autons: AutonList = new AutonList();
  private view: AutonTreeProvider;
  constructor(private _context: vscode.ExtensionContext) {
    // vscode.workspace.on

    this.view = new AutonTreeProvider(_context, this.autons);
    const globPattern = vscode.workspace
      .getConfiguration("vrc-auton")
      .get("directory") as string;
    vscode.workspace
      .findFiles(globPattern)
      .then((uris) => uris.forEach(this.setUri.bind(this)));
    this.autonWatcher = vscode.workspace.createFileSystemWatcher(globPattern);
    _context.subscriptions.push(
      this.autonWatcher,
      this.autonWatcher.onDidChange(this.setUri.bind(this)),
      this.autonWatcher.onDidCreate(this.setUri.bind(this)),
      this.autonWatcher.onDidDelete(this.deleteUri.bind(this))
    );
  }
  private async setUri(uri: vscode.Uri) {
    let doc = vscode.workspace.textDocuments.find(
      ({ uri: docUri }) => uri == docUri
    );
    if (!doc) {
      console.log("Cannot find doc with uri");
      doc = await vscode.workspace.openTextDocument(uri);
    }
    this.autons.setUriAutons(uri, await ASTTranslator.getAutons(doc));
    this.view.refresh();
  }
  private async deleteUri(uri: vscode.Uri) {
    this.autons.setUriAutons(uri, []);
    this.view.refresh();
  }
}
