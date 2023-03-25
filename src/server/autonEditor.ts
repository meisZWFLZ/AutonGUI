import * as vscode from "vscode";
import { getNonce } from "./util";
import Message from "../common/message";
import Auton from "../common/auton";
import { Translation } from "./translator";

/**
 * Provider for paw draw editors.
 *
 * Paw draw editors are used for `.pawDraw` files, which are just `.png` files with a different file extension.
 *
 * This provider demonstrates:
 *
 * - How to implement a custom editor for binary files.
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Communication between VS Code and the custom editor.
 * - Using CustomDocuments to store information that is shared between multiple custom editors.
 * - Implementing save, undo, redo, and revert.
 * - Backing up a custom editor.
 */
export class AutonEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = "vrc-auton.builder";
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new AutonEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      AutonEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): void {
    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const messageReceivedSubscription: vscode.Disposable =
      webviewPanel.webview.onDidReceiveMessage((msg) =>
        this.messageListener({ webviewPanel, document, msg })
      );
    webviewPanel.onDidDispose(() => messageReceivedSubscription.dispose());

    // translate document to an auton and add to autonMap
  }
  /**
   * maps document uris to their respective auton
   */
  protected autonMap: { [key: string]: Auton<Translation.CppAction> } = {};

  /** gets auton associated with document */
  protected getAuton(doc: vscode.TextDocument): Auton<Translation.CppAction> {
    return this.autonMap[doc.uri.toString()];
  }
  /** sets auton associated with document */
  protected setAuton(
    doc: vscode.TextDocument,
    auton: Auton<Translation.CppAction>
  ): Auton<Translation.CppAction> {
    return (this.autonMap[doc.uri.toString()] = auton);
  }

  /**
   * @returns visible text editors associated with document; if none are found, returns an empty array.
   */
  protected tryToGetTextEditors(
    document: vscode.TextDocument
  ): vscode.TextEditor[] {
    const compareTo = document.uri.toString();
    return vscode.window.visibleTextEditors.filter(
      (e) => e.document.uri.toString() === compareTo
    );
  }

  /**
   * Translates the document to an auton
   */
  protected static translateDoc(
    doc: vscode.TextDocument
  ): Auton<Translation.CppAction> {
    return Translation.CppToAuton.translateDoc(doc);
  }

  // /**
  //  * Translates the edit to an auton
  //  */
  // protected static translateDoc(
  //   doc: vscode.TextDocument
  // ): Auton<Translation.CppAction> {
  //   return Translation.CppToAuton.translateDoc(doc);
  // }

  protected msgListeners = new (class MessageListeners {
    constructor(protected editorProvider: AutonEditorProvider) {}
    onReady({
      webviewPanel,
      document,
      msg,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
      msg: typeof Message.ToExtension.Ready.prototype;
    }): void {
      // translate cpp into an auton and send to webview
      this.editorProvider.postMessage(
        webviewPanel,
        new Message.ToWebview.AutonUpdate(
          this.editorProvider.setAuton(
            document,
            AutonEditorProvider.translateDoc(document)
          ),
          0
        )
      );
      // console.log({ setAuton: this.editorProvider.getAuton(document) });
      Translation.AutonToCpp.generateTextForAction(Auton.createIntake());
    }
    onUpdateIndex({
      webviewPanel,
      document,
      msg,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
      msg: typeof Message.ToExtension.IndexUpdate.prototype;
    }): void {
      const editors: vscode.TextEditor[] =
        this.editorProvider.tryToGetTextEditors(document);
      if (editors.length <= 0) return;
      // interpret auton index and change selection in text editor
    }
    onEdit({
      webviewPanel,
      document,
      msg,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
      msg: typeof Message.ToExtension.Edit.prototype;
    }): void {
      // modify auton associated with document using msg.edit
      // then, translate auton to cpp and modify document using cpp
    }
  })(this);

  messageListener({
    webviewPanel,
    document,
    msg,
  }: {
    webviewPanel: vscode.WebviewPanel;
    document: vscode.TextDocument;
    msg: typeof Message.ToExtension.prototype;
  }): void {
    const ToExt = Message.ToExtension;
    if (!ToExt.test(msg)) return;
    if (ToExt.Ready.test(msg))
      this.msgListeners.onReady({ webviewPanel, document, msg });
    else if (ToExt.IndexUpdate.test(msg))
      this.msgListeners.onUpdateIndex({ webviewPanel, document, msg });
    else if (ToExt.Edit.test(msg))
      this.msgListeners.onEdit({ webviewPanel, document, msg });
  }

  protected eventListeners = new (class EventListeners {
    constructor(protected editorProvider: AutonEditorProvider) {}
    initialize({
      webviewPanel,
      document,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
    }): vscode.Disposable[] {
      return [
        vscode.window.onDidChangeTextEditorSelection((event) =>
          this.onDidChangeTextEditorSelection({ webviewPanel, document, event })
        ),
        vscode.workspace.onDidChangeTextDocument((event) =>
          this.onDidChangeTextDocument({ webviewPanel, document, event })
        ),
      ];
    }
    onDidChangeTextEditorSelection({
      webviewPanel,
      document,
      event,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
      event: vscode.TextEditorSelectionChangeEvent;
    }) {
      if (event.textEditor.document.uri.toString() !== document.uri.toString())
        return;
      // interpret selection as an index in the auton array and send to webview
    }
    onDidChangeTextDocument({
      webviewPanel,
      document,
      event,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
      event: vscode.TextDocumentChangeEvent;
    }) {
      if (event.document.uri.toString() !== document.uri.toString()) return;
      // translate edit to auton edit and send to webview
    }
  })(this);

  constructor(private readonly _context: vscode.ExtensionContext) {}

  /**
   * Get the static HTML used for in our editor's webviews.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Local path to script and css for the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "out",
        "webview",
        "webview",
        "wflAuton.js"
      )
    );

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "reset.css")
    );

    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "vscode.css")
    );

    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "wflAuton.css")
    );

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
  				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${
            webview.cspSource
          } blob:; style-src ${
      webview.cspSource
    }; script-src 'nonce-${nonce}';">

  				<meta name="viewport" content="width=device-width, initial-scale=1.0">
  		<link href="${styleResetUri}" rel="stylesheet" />
  		<link href="${styleVSCodeUri}" rel="stylesheet" />
  		<link href="${styleMainUri}" rel="stylesheet" />
  		<title>Paw Draw</title>
  		</head>
  		<body>
      <div class="field">
        <p class="robot"> </p>
        <div class="index"></div>
        ${`<div class="canvas_wrapper"><canvas class="mycanvas"> </canvas></div>`}
        <div class="actions">
          <button data-action="intake" class="intake" title="Intake"></button>
          <button data-action="shoot" class="shoot" title="Shoot"></button>
          <button data-action="piston_shoot" class="piston_shoot" title="Piston Shoot"></button>
          <button data-action="roller" class="roller" title="Roller"></button>
          <button data-action="expand" class="expand" title="Expand"></button>
        </div>
      </div>

  ${
    ""
    // <img class="robot"
    //  src="${robotPngUri}"
    //  alt="robot">
    //<div class="drawing-canvas"></div>
    // <div class="drawing-controls">
    // 	<button data-color="black" class="black active" title="Black"></button>
    // 	<button data-color="white" class="white" title="White"></button>
    // 	<button data-color="red" class="red" title="Red"></button>
    // 	<button data-color="green" class="green" title="Green"></button>
    // 	<button data-color="blue" class="blue" title="Blue"></button>
    // </div>
  }
  			<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  			</body>
  			</html>`;
  }

  private readonly _callbacks = new Map<number, (response: any) => void>();

  private postMessageWithResponse<R = unknown>(
    panel: vscode.WebviewPanel,
    msg: typeof Message.ToWebview.prototype
  ): Promise<R> {
    // const requestId = this._requestId++;
    const p = new Promise<R>((resolve) => this._callbacks.set(msg.id, resolve));
    // panel.webview.postMessage({ type, requestId, body });
    panel.webview.postMessage(msg);
    return p;
  }

  private postMessage(
    panel: vscode.WebviewPanel,
    msg: typeof Message.ToWebview.prototype /* type: string, body: any */
  ): void {
    panel.webview.postMessage(/* { type, body } */ msg);
  }

  // private onMessage(document: vscode.TextDocument, msg: Message) {
  //   // console.log(msg);
  //   if (!Message.ToExtension.test(msg)) return;
  //   // if (Message.ToExtension.Edit.test(msg)) document.(msg.edit);
  //   // else if (Message.ToExtension.GetFileResponse.test(msg)) {
  //   //   // console.log(msg);
  //   //   this._callbacks.get(msg.id)?.(msg);
  //   //   // callback?.(msg);
  //   // }
  //   return;
  // }
}
