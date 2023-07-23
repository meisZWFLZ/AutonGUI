import * as vscode from "vscode";
import Auton, { AutonEdit } from "../common/auton";
import { getNonce } from "./util";
import Message, { MSG_TARGET } from "../common/message";
import { UUID } from "crypto";
/**
 * Serves as an api to manage webview
 * 
 * Does not interact with filesystem in any way
 */
class WebviewManager {
  private panel?: vscode.WebviewPanel;
  private auton?: Auton;
  private autonIndex: number | UUID = -1;
  private functionName?: string;

  private static readonly webviewOptions: vscode.WebviewPanelOptions &
    vscode.WebviewOptions = {
    enableScripts: true,
  };

  constructor(private _context: vscode.ExtensionContext) {}

  private createWebviewTitle(): string {
    return `Auton: ${this.functionName}()`;
  }
  create(
    viewColumn: Parameters<typeof vscode.window.createWebviewPanel>[2] = vscode
      .ViewColumn.Beside
  ) {
    if (this.panel) throw "this.panel already defined";
    this.panel = vscode.window.createWebviewPanel(
      "vrc-auton.builder",
      this.createWebviewTitle(),
      viewColumn,
      WebviewManager.webviewOptions
    );
    this.panel.webview.html = this.getWebviewHtml();
  }

  show(viewColumn?: vscode.ViewColumn, preserveFocus?: boolean) {
    if (!this.panel) throw "this.panel undefined";
    this.panel.reveal(viewColumn, preserveFocus);
  }
  disposePanel() {
    this.panel?.dispose();
    this.panel = undefined;
  }

  private static readonly resourceUriMap: Record<
    | "script"
    | "styleReset"
    | "styleVSCode"
    | "styleMain"
    | "fieldSvg"
    | "robotSvg"
    | "turnToTargetSvg",
    string[]
  > = {
    script: ["dist", "main.bundle.js"],
    styleReset: ["media", "reset.css"],
    styleVSCode: ["media", "vscode.css"],
    styleMain: ["media", "wflAuton.css"],
    fieldSvg: ["media", "SpinUpField.svg"],
    robotSvg: ["media", "robot.svg"],
    turnToTargetSvg: ["media", "turnToTarget.svg"],
  };

  private getWebviewResourceUris(): Record<
    keyof typeof WebviewManager.resourceUriMap,
    vscode.Uri
  > {
    if (!this.panel) throw "this.panel undefined";
    return Object.fromEntries(
      (
        Object.entries(WebviewManager.resourceUriMap) as [
          keyof typeof WebviewManager.resourceUriMap,
          string[]
        ][]
      ).map(([resource, uri]) => [
        resource,
        this.panel!.webview.asWebviewUri(
          vscode.Uri.joinPath(this._context.extensionUri, ...uri)
        ),
      ])
    ) as Record<keyof typeof WebviewManager.resourceUriMap, vscode.Uri>;
  }

  private getWebviewHtml(): string {
    if (!this.panel) throw "this.panel undefined";
    // Local path to script and css for the webview
    const uris = this.getWebviewResourceUris();
    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return /* html */ `
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<!--
		Use a content security policy to only allow loading images from https or from our extension directory,
		and only allow scripts that have a specific nonce.
		-->
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.panel.webview.cspSource} blob:; style-src ${this.panel.webview.cspSource}; script-src 'nonce-${nonce}';">

		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link href="${uris.styleReset}" rel="stylesheet" />
		<link href="${uris.styleVSCode}" rel="stylesheet" />
		<link href="${uris.styleMain}" rel="stylesheet" />
	<title>Paw Draw</title>
	</head>
	<body>
		<!-- 140.4 is the field length as defined in VRC Over Under Game Manual: Page A8 -->
		<svg width="100%" height="100%" viewBox="-70.2 -70.2 140.4 140.4" version="1.1" xmlns="http://www.w3.org/2000/svg" class="field-svg">
			<image x="-70.2" y="-70.2" width="140.4" height="140.4" href="${uris.fieldSvg}" class="field-background"></image>
			<g transform="scale(1,-1)">
				<image x="-9" y="-9" width="18" height="18" href="${uris.robotSvg}" class="robot"></image>
				<image x="-6" y="-6" width="12" height="12" href="${uris.turnToTargetSvg}" class="turn-to" visibility="hidden"></image>
			</g>
		</svg>
		<script nonce="${nonce}" src="${uris.script}"></script>
	</body>
</html>`;
  }

  private getNumericalIndex(index: number | UUID = this.autonIndex): number {
    if (typeof index == "number") return index;
    if (!this.auton) throw "this.auton undefined";
    return this.auton.getIndexFromId(index);
  }

  setAuton(functionName: string, auton: Auton, index?: number | UUID) {
    if (index) this.autonIndex = index;
    if (this.autonIndex == -1) throw "this.autonIndex == -1";
    this.functionName = functionName;
    this.auton = auton;
    this.postMessage(
      new Message.ToWebview.AutonUpdate(
        this.auton.auton,
        this.getNumericalIndex()
      )
    );
    if (this.panel) this.panel.title = this.createWebviewTitle();
  }
  editAuton(
    edit: AutonEdit.AutonEdit | AutonEdit.AutonEdit[],
    index?: number | UUID
  ) {
    if (!this.auton) throw "this.auton undefined";
    this.auton.makeEdit(edit);
    this.postMessage(
      new Message.ToWebview.Edit(
        Array.isArray(edit) ? edit : [edit],
        index !== undefined ? this.getNumericalIndex() : undefined
      )
    );
    if (index) this.setAutonIndex(index);
  }
  setAutonIndex(index: number | UUID) {
    this.autonIndex = index;
    this.postMessage(
      new Message.ToWebview.IndexUpdate(this.getNumericalIndex())
    );
  }
  postMessage(msg: Message) {
    return this.panel?.webview.postMessage(msg);
  }

  private readonly MsgListener = new (class MsgListener {
    constructor(private manager: WebviewManager) {}
    onMessage(msg: Message) {
      if (!Message.ToExtension.test(msg)) return;
      if (Message.ToExtension.Ready.test(msg)) this.onReady(msg);
      else if (Message.ToExtension.IndexUpdate.test(msg))
        this.onIndexUpdate(msg);
      else if (Message.ToExtension.Modify.test(msg)) this.onModify(msg);
    }
    onModify({ mod }: typeof Message.ToExtension.Modify.prototype) {
      this.manager.auton?.makeEdit(mod);
    }
    onIndexUpdate({
      newIndex,
    }: typeof Message.ToExtension.IndexUpdate.prototype) {
      this.manager.autonIndex = newIndex;
      this.manager._onAutonIndexUpdate.fire(newIndex);
    }
    onReady({}: typeof Message.ToExtension.Ready.prototype) {
      if (!this.manager.auton) throw "auton undefined";
      if (this.manager.autonIndex === -1) throw "autonIndex == -1";
      this.manager.postMessage(
        new Message.ToWebview.AutonUpdate(
          this.manager.auton.auton,
          this.manager.getNumericalIndex()
        )
      );
    }
  })(this);

  // events
  private _onAutonIndexUpdate = new vscode.EventEmitter<number>();
  public get onAutonIndexUpdate(): vscode.Event<number> {
    return this._onAutonIndexUpdate.event;
  }
  public get onDidDisposePanel(): vscode.Event<void> | undefined {
    return this.panel?.onDidDispose;
  }
  public get onDidChangePanelViewState():
    | vscode.Event<vscode.WebviewPanelOnDidChangeViewStateEvent>
    | undefined {
    return this.panel?.onDidChangeViewState;
  }
  public get onDidReceiveWebviewMessage(): vscode.Event<Message> | undefined {
    return this.panel?.webview.onDidReceiveMessage;
  }
  public get onAutonEdit() {
    return this.auton?.onEdit;
  }
}
