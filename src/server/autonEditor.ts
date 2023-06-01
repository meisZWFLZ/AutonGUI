import * as vscode from "vscode";
import { getNonce } from "./util";
import Message from "../common/message";
import Auton, { AutonEdit } from "../common/auton";
import { Translation } from "./translator";
import { AutonTreeProvider, TreeItem } from "./autonview";
import { Action } from "../common/action";
import { ISimpleEvent } from "strongly-typed-events";

type CppAuton = Auton<Translation.CppAction>;
type DocumentInfo = {
  auton: CppAuton;
  // /** informs text edit listener that the edit is due to this class and that it can ignore it */
  // modifiedText: boolean;
  /** edits made by AutonEditorProvider, used to indicate when an edit may be ignored by the edit listener */
  edits: { range: vscode.Range; newText: string }[];
  content: string;
  unSubOnEdit: ReturnType<
    ISimpleEvent<AutonEdit.AutonEdit<Translation.ActionWithOffset>>["sub"]
  >;
};

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
  private static provider: AutonEditorProvider;
  private static autonView: AutonTreeProvider;
  public static register(
    context: vscode.ExtensionContext,
    autonView: AutonTreeProvider
  ): vscode.Disposable[] {
    this.provider = new AutonEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      AutonEditorProvider.viewType,
      this.provider
    );
    const docInfoRemover = vscode.workspace.onDidCloseTextDocument((doc) =>
      this.provider.deleteDocInfo(doc)
    );
    this.autonView = autonView;
    return [providerRegistration, docInfoRemover];
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

    const webviewDisposables: vscode.Disposable[] = [
      webviewPanel.webview.onDidReceiveMessage((msg) =>
        this.messageListener({ webviewPanel, document, msg })
      ),
      ...this.eventListeners.initialize({
        webviewPanel,
        document,
      }),
    ];
    webviewPanel.onDidDispose(
      vscode.Disposable.from(...webviewDisposables).dispose
    );
  }
  /**
   * maps document uris to their respective info
   */
  protected documentInfo: {
    [key: string]: DocumentInfo;
  } = {};

  protected getDocInfo(doc: vscode.TextDocument | vscode.Uri): DocumentInfo {
    return this.documentInfo[("uri" in doc ? doc.uri : doc).toString()];
  }
  protected setDocInfo(
    doc: vscode.TextDocument,
    docInfo: DocumentInfo
  ): DocumentInfo {
    return (this.documentInfo[doc.uri.toString()] = docInfo);
  }
  protected deleteDocInfo(doc: vscode.TextDocument): boolean {
    return delete this.documentInfo[doc.uri.toString()];
  }

  /** gets auton associated with document */
  protected getAuton(doc: vscode.TextDocument): CppAuton {
    // console.log("GET AUTON")
    return /* AutonEditorProvider.autonView.setAuton( */ this.getDocInfo(doc)
      .auton /* ) */;
  }
  /** sets auton associated with document */
  protected setAuton(doc: vscode.TextDocument, auton: CppAuton): CppAuton {
    console.log("SET AUTON");
    // AutonEditorProvider.autonView.setAuton(auton);
    const uri = doc.uri.toString();
    const info = this.documentInfo[uri];
    if (info !== undefined && typeof info === "object") info.auton = auton;
    else
      this.documentInfo[uri] = {
        auton: auton,
        edits: [],
        content: doc.getText(),
        unSubOnEdit: () => {},
      };
    return auton;
  }
  /**
   * applies {@link wEdit} and adds it to document info to indicate
   * the source of the edit to the onDidChangeTextDocument listener
   */
  protected applyWorkspaceEdit(wEdit: vscode.WorkspaceEdit) {
    wEdit
      .entries()
      .forEach(([uri, edits]) => this.getDocInfo(uri).edits.push(...edits));
    (function whyIsThisLikeThis(bool: boolean) {
      if (!bool) vscode.workspace.applyEdit(wEdit).then(whyIsThisLikeThis);
    })(false);
  }
  /**
   * Finds whether change is due to {@link AutonEditorProvider this} and if so removes corresponding edits from {@link documentInfo}
   * @param changeEv change event
   * @returns whether the change is due to the actions of {@link AutonEditorProvider this}
   */
  protected isFromThis(changeEv: vscode.TextDocumentChangeEvent): boolean {
    return changeEv.contentChanges.reduce((output, contentChange) => {
      const curEdits = this.getDocInfo(changeEv.document).edits;
      let newEdits = curEdits.filter(
        (edit) =>
          edit.range.isEqual(contentChange.range) &&
          edit.newText == contentChange.text
      );
      if (newEdits.length === curEdits.length) return output;

      this.getDocInfo(changeEv.document).edits = newEdits;
      return true;
    }, false);
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

  protected translateAndSetAuton(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ) {
    try {
      this.getDocInfo(document)?.unSubOnEdit();
      this.postMessage(
        webviewPanel,
        new Message.ToWebview.AutonUpdate(
          AutonEditorProvider.autonView.setAuton(
            this.setAuton(document, AutonEditorProvider.translateDoc(document))
          ) as unknown as Auton,
          0
        )
      );
      this.getDocInfo(document).unSubOnEdit = this.getAuton(
        document
      ).onEdit.sub((event) =>
        this.eventListeners.onAutonEdit({
          webviewPanel,
          document,
          event,
        })
      );
    } catch (err) {
      console.error(err);
    }
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
      this.editorProvider.translateAndSetAuton(document, webviewPanel);

      // AutonEditorProvider.autonView.view.on
      // console.log({ setAuton: this.editorProvider.getAuton(document) });
      // Translation.AutonToCpp.generateTextForAction(Auton.createIntake());
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
      // interpret auton edit as a workspace edit and then apply the workspace edit
      // this.editorProvider.applyWorkspaceEdit(
      //   msg.edit.reduce((accumulator: vscode.WorkspaceEdit, edit) => {
      //     const workspaceEdit = Translation.AutonToCpp.translateAutonEdit(
      //       this.editorProvider.getAuton(
      //         document
      //       ) as unknown as Auton<Translation.ActionWithOffset>,
      //       document,
      //       edit,
      //       accumulator,
      //       edit.reason.concat("server.editor.msgListeners.onEdit")
      //     );
      //     return workspaceEdit;
      //   }, new vscode.WorkspaceEdit())
      // );
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
        AutonEditorProvider.autonView.view.onDidChangeSelection((event) =>
          this.onAutonViewDidChangeSelection({ webviewPanel, document, event })
        ),
        new vscode.Disposable(
          AutonEditorProvider.autonView.onRefreshCommand.sub(() =>
            this.onAutonViewRefresh({ webviewPanel, document })
          )
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
      const id = this.editorProvider
        .getAuton(document)
        .auton.find((act) =>
          event.selections.some((s) =>
            s.contains(
              Translation.AutonToCpp.upgradeOffsetsToRange(act, document)
            )
          )
        )?.uuid;
      if (!id) return;
      const item = AutonEditorProvider.autonView.getTreeItemFromId(id);
      if (!item) return;
      // AutonEditorProvider.autonView.view.reveal(item);
    }
    onDidChangeTextDocument({
      webviewPanel,
      document,
      event,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
      event: vscode.TextDocumentChangeEvent;
    }): void {
      if (event.contentChanges.length === 0) return;
      if (event.document.uri.toString() !== document.uri.toString()) return;

      // if this event was caused by the editorProvider, then ignore it
      if (!this.editorProvider.isFromThis(event)) {
        // translate edit to auton edit and send to webview
        this.editorProvider.postEdits(
          webviewPanel,
          Translation.CppToAuton.changeAuton(
            this.editorProvider.getAuton(
              document
            ) as unknown as Auton<Translation.ActionWithOffset>,
            event,
            this.editorProvider.getDocInfo(document).content,
            ["server.editor.eventListeners.onDidChangeTextDocument"]
          )
        );
      }

      console.log(this.editorProvider.getAuton(document).auton);
      console.log(
        "offset:",
        this.editorProvider.getAuton(document).auton.map((e) => e.offset)
      );
      console.log(
        "endOff:",
        this.editorProvider.getAuton(document).auton.map((e) => e.endOffset)
      );
      // always update content if event modifies document
      this.editorProvider.getDocInfo(document).content = document.getText();
    }
    async onAutonEdit({
      webviewPanel,
      document,
      event: edit,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
      event: Parameters<Parameters<Auton["onEdit"]["sub"]>[0]>[0];
    }) {
      if (
        edit.reason.some(
          (r) => r.startsWith("webview") || r.startsWith("server.editor")
        ) ||
        !AutonEdit.TypeGuards.isMove(edit)
      )
        return;
      console.log({
        webviewPanel,
        document,
        edit,
      });
      this.editorProvider.applyWorkspaceEdit(
        Translation.AutonToCpp.translateAutonEdit(
          this.editorProvider.getAuton(
            document
          ) as unknown as Auton<Translation.ActionWithOffset>,
          document,
          edit as AutonEdit.Result.AutonEdit<Translation.ActionWithOffset>,
          new vscode.WorkspaceEdit(),
          edit.reason.concat("server.editor.eventListener.onEdit")
        )
      );
      this.editorProvider.postEdits(webviewPanel, [
        {
          ...edit,
          reason: edit.reason.concat("server.editor.eventListener.onEdit"),
        },
      ]);
    }
    async onAutonViewDidChangeSelection({
      webviewPanel,
      document,
      event: { selection },
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
      event: vscode.TreeViewSelectionChangeEvent<TreeItem>;
    }) {
      let editor = vscode.window.visibleTextEditors.find(
        (editor) => editor.document.uri === document.uri
      );
      if (!editor) editor = await vscode.window.showTextDocument(document);
      if (!editor) return;
      editor.selections = this.editorProvider
        .getAuton(document)
        .auton.filter((act) => selection.map((e) => e.id).includes(act.uuid))
        .map((act) =>
          Translation.AutonToCpp.upgradeOffsetsToRange(act, document)
        )
        .map(({ end, start }) => new vscode.Selection(start, end));
    }
    onAutonViewRefresh({
      webviewPanel,
      document,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
    }) {
      this.editorProvider.translateAndSetAuton(document, webviewPanel);
    }
  })(this);

  private constructor(private readonly _context: vscode.ExtensionContext) {}

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
  private postEdits(
    panel: vscode.WebviewPanel,
    edits: AutonEdit.AutonEdit<Action>[],
    newIndex: number = 0
  ) {
    if (
      edits.some(
        (e) =>
          !AutonEdit.TypeGuards.isModify(e) ||
          !e.reason.at(-1)?.endsWith("adjustOffset")
      )
    )
      this.postMessage(
        panel,
        new Message.ToWebview.Edit(
          edits.filter(
            (e) =>
              !AutonEdit.TypeGuards.isModify(e) ||
              !e.reason.at(-1)?.endsWith("adjustOffset")
          ),
          newIndex
        )
      );
  }
  private postMessage(
    panel: vscode.WebviewPanel,
    msg: typeof Message.ToWebview.prototype /* type: string, body: any */
  ): void {
    // console.log("postMessage: ", { panel, msg });
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
