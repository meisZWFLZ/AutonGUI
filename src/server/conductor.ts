import * as vscode from "vscode";
import { AutonList } from "./autonList";
import { ASTTranslator, ActionWithRanges } from "./astTranslator";
import { AutonTreeProvider, TreeItemID } from "./autonTreeView";
import { WebviewManager } from "./webviewManager";
import { Action } from "../common/action";
import Auton, { AutonEdit } from "../common/auton";
import { UUID } from "crypto";
import { SignalDispatcher, SimpleEventDispatcher } from "strongly-typed-events";

interface AutonInfo {
  uri: string;
  funcName: string;
  index: number;
}
/**
 * Coordinate classes to make them work together
 */
export class Conductor {
  private readonly autonWatcher: vscode.FileSystemWatcher;
  private readonly autons: AutonList = new AutonList();
  private currAuton?: AutonInfo;
  private readonly view: AutonTreeProvider;
  private readonly webview: WebviewManager;
  constructor(private readonly _context: vscode.ExtensionContext) {
    this.view = new AutonTreeProvider(_context, this.autons);
    const globPattern = vscode.workspace
      .getConfiguration("vrc-auton")
      .get("directory") as string;
    this.autonWatcher = vscode.workspace.createFileSystemWatcher(globPattern);
    this.webview = new WebviewManager(_context);
    vscode.workspace
      .findFiles(globPattern)
      .then((uris) => uris.forEach(this.setUri.bind(this)))
      .then(() => {
        _context.subscriptions.push(
          this.autonWatcher,
          this.autonWatcher.onDidChange(this.setUri.bind(this)),
          this.autonWatcher.onDidCreate(this.setUri.bind(this)),
          this.autonWatcher.onDidDelete(this.deleteUri.bind(this)),
        );
        this.eventListeners.initialize();
      });
  }

  private async setUri(uri: vscode.Uri) {
    let doc = vscode.workspace.textDocuments.find(
      ({ uri: docUri }) => uri == docUri,
    );
    if (doc == null) {
      console.log("Cannot find doc with uri");
      doc = await vscode.workspace.openTextDocument(uri);
    }
    this.autons.setUriAutons(uri, await ASTTranslator.getAutons(doc));
    this.view.refresh();
    if (uri.toString() === this.currAuton?.uri) {
      this.eventListeners.onTreeViewDidChangeSelection();
    }
  }

  private async deleteUri(uri: vscode.Uri) {
    this.autons.setUriAutons(uri, []);
    this.view.refresh();
  }

  protected getAuton(
    auton: Omit<AutonInfo, "index"> | undefined = this.currAuton,
  ): Auton<ActionWithRanges> {
    if (auton == null) throw "this.currAuton is undefined";
    return this.autons.getFuncAutons(auton.funcName, auton.uri)[0].auton;
  }

  private setCurrAuton(
    newAuton: Omit<AutonInfo, "index"> & { index: AutonInfo["index"] | UUID },
  ) {
    const shouldCreateWebview = this.currAuton == undefined;
    this.currAuton = {
      ...newAuton,
      index:
        typeof newAuton.index === "string"
          ? this.getAuton(newAuton).getIndexFromId(newAuton.index)
          : newAuton.index,
    };
    this.webview.setAuton(
      this.currAuton.funcName,
      // what is going on here? (somehow it flips the two action types?)
      this.getAuton() as unknown as Auton<Action>,
      this.currAuton.index,
    );
    if (shouldCreateWebview) this.webview.create();
    this._onDidChangeCurrentAuton.dispatch();
  }

  private readonly eventListeners = new (class EventListeners {
    constructor(private readonly conductor: Conductor) {}
    private previousOnWebviewAutonEdit?: () => void;
    onDidChangeCurrentAuton() {
      this.previousOnWebviewAutonEdit?.();
      this.previousOnWebviewAutonEdit =
        this.conductor.webview.onAutonModifyEdit?.sub(
          this.onWebviewAutonEdit.bind(this),
        );
    }

    initialize() {
      this.conductor._context.subscriptions.push(
        this.conductor.view.view.onDidChangeSelection(
          this.onTreeViewDidChangeSelection.bind(this),
        ),
        new vscode.Disposable(
          this.conductor.onDidChangeCurrentAuton.sub(
            this.onDidChangeCurrentAuton.bind(this),
          ),
        ),
      );
    }

    onTreeViewDidChangeSelection(
      {
        selection: [selectedItem],
      }: vscode.TreeViewSelectionChangeEvent<TreeItemID> = {
        selection: this.conductor.view.view.selection,
      },
    ) {
      if (selectedItem === undefined) return;
      const selectedFunc =
        selectedItem.type === "func"
          ? selectedItem
          : this.conductor.autons.findUUID(selectedItem.uuid);
      if (selectedFunc === undefined) return;
      this.conductor.setCurrAuton({
        funcName: selectedFunc.funcName,
        uri: selectedFunc.uri,
        index: "type" in selectedFunc ? 0 : selectedFunc.act.uuid,
      });
    }

    private async onWebviewAutonEdit(edit: AutonEdit.Result.Modify<Action>) {
      // this.conductor.getCurrAuton().makeEdit(edit);
      if (this.conductor.currAuton == null)
        throw "conductor.currAuton is undefined";
      const currUri = vscode.Uri.parse(this.conductor.currAuton.uri);
      const act =
        "uuid" in edit
          ? this.conductor.getAuton().getActionFromId(edit.uuid)
          : this.conductor.getAuton().auton[edit.index];
      if (act === undefined) throw "act is undefined";
      vscode.workspace.applyEdit(
        ASTTranslator.applyAutonModifyEdit(edit, act, currUri),
      );
    }
  })(this);

  private readonly _onDidChangeCurrentAuton = new SignalDispatcher();
  protected get onDidChangeCurrentAuton() {
    return this._onDidChangeCurrentAuton.asEvent();
  }
}
