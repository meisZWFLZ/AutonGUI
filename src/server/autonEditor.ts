// eslint-disable-next-line @typescript-eslint/ban-ts-comment
/// @ts-nocheck

import * as vscode from "vscode";
import { getNonce } from "./util";
import Message from "../common/message";
import Auton, { AutonData, AutonEdit } from "../common/auton";
import { Translation } from "./translator";
import { AutonTreeProvider, TreeItem } from "./autonTreeView";
import { Action } from "../common/action";
import { ISimpleEvent } from "strongly-typed-events";
import { UUID } from "crypto";

type CppAuton = Auton<Translation.CppAction>;
interface DocumentInfo {
  auton: CppAuton;
  // /** informs text edit listener that the edit is due to this class and that it can ignore it */
  // modifiedText: boolean;
  /** edits made by AutonEditorProvider, used to indicate when an edit may be ignored by the edit listener */
  edits: Array<{ range: vscode.Range; newText: string }>;
  /** must have at least 1 index */
  indices: [number, ...number[]];
  content: string;
  unSubOnEdit: ReturnType<
    ISimpleEvent<AutonEdit.AutonEdit<Translation.ActionWithOffset>>["sub"]
  >;
}

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
    autonView: AutonTreeProvider,
  ): vscode.Disposable[] {
    this.provider = new AutonEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      AutonEditorProvider.viewType,
      this.provider,
    );
    const docInfoRemover = vscode.workspace.onDidCloseTextDocument((doc) =>
      this.provider.deleteDocInfo(doc),
    );
    this.autonView = autonView;
    return [providerRegistration, docInfoRemover];
  }

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken,
  ): void {
    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const webviewDisposables: vscode.Disposable[] = [
      webviewPanel.webview.onDidReceiveMessage((msg) =>
        this.messageListener({ webviewPanel, document, msg }),
      ),
      ...this.eventListeners.initialize({
        webviewPanel,
        document,
      }),
    ];
    webviewPanel.onDidDispose(
      vscode.Disposable.from(...webviewDisposables).dispose,
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
    docInfo: DocumentInfo,
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
      .auton; /* ) */
  }

  /** sets auton associated with document */
  protected setAuton(doc: vscode.TextDocument, auton: CppAuton): CppAuton {
    console.log("SET AUTON");
    // AutonEditorProvider.autonView.setAuton(auton);
    const uri = doc.uri.toString();
    const info = this.documentInfo[uri];
    if (info !== undefined && typeof info === "object") info.auton = auton;
    else {
      this.documentInfo[uri] = {
        auton,
        indices: [0],
        edits: [],
        content: doc.getText(),
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        unSubOnEdit: () => {},
      };
    }
    return auton;
  }

  /** gets auton associated with document */
  protected getAutonIndices(doc: vscode.TextDocument): [number, ...number[]] {
    return this.getDocInfo(doc).indices;
  }

  /** gets auton associated with document */
  protected setAutonIndices(
    doc: vscode.TextDocument,
    indices: [number, ...number[]],
  ): [number, ...number[]] {
    return (this.getDocInfo(doc).indices = indices);
  }
  // private _wEditQueue: vscode.WorkspaceEdit[] = [];
  // private _tryingToAddFirstEdit: boolean = false;
  // private async _tryToAddFirstEdit(attempts: number = 0) {
  //   this._tryingToAddFirstEdit = true;
  //   if (this._wEditQueue.length == 0) {
  //     this._tryingToAddFirstEdit = false;
  //     return;
  //   }
  //   if (attempts >= 10) {
  //     this._tryingToAddFirstEdit = false;
  //     throw "too many attempts, giving up now";
  //   }
  //   const bool = await vscode.workspace.applyEdit(this._wEditQueue[0]);
  //   if (bool) {
  //     this._wEditQueue.shift();
  //     this._tryToAddFirstEdit();
  //   } else this._tryToAddFirstEdit(attempts + 1);
  // }

  private readonly _queueForNewWEdit: Array<() => void> = [];

  private _wEditUnApplied = false;
  /** hopefully should prevent workspace edits from being made until preceding edits are applied */
  protected async getNewWorkspaceEdit() {
    if (this._wEditUnApplied) {
      await new Promise<void>((resolve, reject) =>
        this._queueForNewWEdit.push(resolve),
      );
    }
    this._wEditUnApplied = true;
    console.log("wEditCreated");
    return new vscode.WorkspaceEdit();
  }

  private _onFinishedAddingEdit() {
    this._queueForNewWEdit.shift()?.();
    this._wEditUnApplied = this._queueForNewWEdit.length > 0;
    console.log("addedWEdit");
  }

  private async _tryToAddEdit(
    wEdit: vscode.WorkspaceEdit,
    attempts = 0,
  ): Promise<void> {
    if (wEdit.size <= 0) {
      this._onFinishedAddingEdit();
      throw "empty wEdit";
    }
    if (attempts >= 10) {
      this._onFinishedAddingEdit();
      wEdit
        .entries()
        .forEach(
          ([uri, edits]) =>
            this.getDocInfo(uri)?.edits.filter(
              (docE) =>
                !edits.some(
                  (wE) =>
                    wE.newText === docE.newText && wE.range.isEqual(docE.range),
                ),
            ),
        );
      console.error("too many attempts to apply wEdit: ", wEdit);
      throw "too many attempts, giving up now";
    }
    const bool = await vscode.workspace.applyEdit(wEdit);
    if (bool) {
      return this._onFinishedAddingEdit();
    } else this._tryToAddEdit(wEdit, attempts + 1);
  }

  /**
   * applies {@link wEdit} and adds it to document info to indicate
   * the source of the edit to the onDidChangeTextDocument listener
   */
  protected async applyWorkspaceEdit(
    wEdit: vscode.WorkspaceEdit,
  ): Promise<void> {
    if (wEdit.size > 0) {
      wEdit
        .entries()
        .forEach(([uri, edits]) => this.getDocInfo(uri)?.edits.push(...edits));
    }
    return await this._tryToAddEdit(wEdit);
  }

  /**
   * Finds whether change is due to {@link AutonEditorProvider this} and if so removes corresponding edits from {@link documentInfo}
   * @param changeEv change event
   * @returns whether the change is due to the actions of {@link AutonEditorProvider this}
   */
  protected isFromThis(changeEv: vscode.TextDocumentChangeEvent): boolean {
    return changeEv.contentChanges.reduce((output, contentChange) => {
      const curEdits = this.getDocInfo(changeEv.document).edits;
      const newEdits = curEdits.filter(
        (edit) =>
          edit.range.isEqual(contentChange.range) &&
          edit.newText == contentChange.text,
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
    document: vscode.TextDocument,
  ): vscode.TextEditor[] {
    const compareTo = document.uri.toString();
    return vscode.window.visibleTextEditors.filter(
      (e) => e.document.uri.toString() === compareTo,
    );
  }

  /**
   * Translates the document to an auton
   */
  protected static translateDoc(
    doc: vscode.TextDocument,
  ): Auton<Translation.CppAction> {
    return Translation.CppToAuton.translateDoc(doc);
  }

  protected translateAndSetAuton(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ) {
    try {
      this.getDocInfo(document)?.unSubOnEdit();
      this.postMessage(
        webviewPanel,
        new Message.ToWebview.AutonUpdate(
          AutonEditorProvider.autonView.setAuton(
            this.setAuton(document, AutonEditorProvider.translateDoc(document)),
          ).auton as unknown as AutonData,
          0,
        ),
      );
      this.getDocInfo(document).unSubOnEdit = this.getAuton(
        document,
      ).onEdit.sub(
        async (event) =>
          await this.eventListeners.onAutonEdit({
            webviewPanel,
            document,
            event,
          }),
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
      msg: { mod },
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
      msg: typeof Message.ToExtension.Modify.prototype;
    }): void {
      this.editorProvider.getAuton(document).makeEdit({
        ...mod,
        reason: mod.reason.concat("server.editor.msgListener.onEdit"),
      });
      // interpret auton edit as a workspace edit and then apply the workspace edit
      // this.editorProvider.applyWorkspaceEdit(
      //   mod
      //     .filter(({ reason }) => !reason.some((r) => r.startsWith("server")))
      //     .reduce(
      //       (accumulator: vscode.WorkspaceEdit, edit) =>
      //         Translation.AutonToCpp.translateAutonEdit(
      //           this.editorProvider.getAuton(
      //             document
      //           ) as unknown as Auton<Translation.ActionWithOffset>,
      //           document,
      //           edit,
      //           accumulator,
      //           edit.reason.concat("server.editor.msgListeners.onEdit")
      //         ),
      //       new vscode.WorkspaceEdit()
      //     )
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
    if (ToExt.Ready.test(msg)) {
      this.msgListeners.onReady({ webviewPanel, document, msg });
    } else if (ToExt.IndexUpdate.test(msg)) {
      this.msgListeners.onUpdateIndex({ webviewPanel, document, msg });
    } else if (ToExt.Modify.test(msg)) {
      this.msgListeners.onEdit({ webviewPanel, document, msg });
    }
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
          this.onDidChangeTextEditorSelection({
            webviewPanel,
            document,
            event,
          }),
        ),
        vscode.workspace.onDidChangeTextDocument((event) =>
          this.onDidChangeTextDocument({ webviewPanel, document, event }),
        ),
        AutonEditorProvider.autonView.view.onDidChangeSelection(
          async (event) =>
            await this.onAutonViewDidChangeSelection({
              webviewPanel,
              document,
              event,
            }),
        ),
        new vscode.Disposable(
          AutonEditorProvider.autonView.onRefreshCommand.sub(() =>
            this.onAutonViewRefresh({ webviewPanel, document }),
          ),
        ),
        vscode.commands.registerCommand(
          "vrc-auton.list-view.highlightGroupIndicesNext",
          () =>
            this.onCommandHighlightGroupIndicesNext({
              webviewPanel,
              document,
            }),
        ),
        vscode.commands.registerCommand(
          "vrc-auton.list-view.highlightGroupIndicesPrevious",
          () =>
            this.onCommandHighlightGroupIndicesPrevious({
              webviewPanel,
              document,
            }),
        ),
        vscode.commands.registerCommand(
          "vrc-auton.list-view.highlightGroupIndicesAll",
          () =>
            this.onCommandHighlightGroupIndicesAll({
              webviewPanel,
              document,
            }),
        ),
      ];
    }

    onDidChangeTextEditorSelection({
      webviewPanel,
      document,
      event: { textEditor },
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
      event: { textEditor: vscode.TextEditor };
    }) {
      if (textEditor.document.uri.toString() !== document.uri.toString()) {
        return;
      }
      // interpret selection as an index in the auton array and send to webview

      this.onDidChangeAutonIndex({
        webviewPanel,
        document,
        newIndex: this.editorProvider
          .getAuton(document)
          .auton.filter((act) =>
            textEditor.selections.some(
              (s) =>
                Translation.AutonToCpp.upgradeOffsetsToRange(
                  act,
                  document,
                ).intersection(s) !== undefined,
            ),
          )
          .map(({ uuid }) =>
            this.editorProvider.getAuton(document).getIndexFromId(uuid),
          ),
        reason: ["server.editor.eventListener.onDidChangeTextEditorSelection"],
      });
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
              document,
            ) as unknown as Auton<Translation.ActionWithOffset>,
            event,
            this.editorProvider.getDocInfo(document).content,
            ["server.editor.eventListeners.onDidChangeTextDocument"],
          ),
        );
      }
      const text = document.getText();
      console.log({
        from: "onDidChangeTextDocument",
        get text() {
          return text;
        },
        auton: JSON.parse(
          JSON.stringify(this.editorProvider.getAuton(document).auton),
        ),
        offset: this.editorProvider
          .getAuton(document)
          .auton.map((e) => e.offset),
        endOff: this.editorProvider
          .getAuton(document)
          .auton.map((e) => e.endOffset),
      });
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
      // return if from this AutonEditor class or is a Move edit
      if (
        (edit.reason.at(-1) !== "server.editor.msgListener.onEdit" &&
          edit.reason.some((r) => r.startsWith("server.editor"))) ||
        AutonEdit.TypeGuards.isReplace(edit)
      ) {
        return;
      }
      console.log({
        from: "onAutonEdit",
        webviewPanel,
        document,
        edit,
      });
      const applyWEditPromise = this.editorProvider.applyWorkspaceEdit(
        Translation.AutonToCpp.translateAutonEdit(
          this.editorProvider.getAuton(
            document,
          ) as unknown as Auton<Translation.ActionWithOffset>,
          document,
          edit as AutonEdit.Result.AutonEdit<Translation.ActionWithOffset>,
          await this.editorProvider.getNewWorkspaceEdit(),
          edit.reason.concat("server.editor.eventListener.onAutonEdit"),
        ),
      );
      if (edit.reason.at(-1) !== "server.editor.msgListener.onEdit") {
        this.editorProvider.postEdits(webviewPanel, [
          {
            ...edit,
            reason: edit.reason.concat(
              "server.editor.eventListener.onAutonEdit",
            ),
          },
        ]);
      } else {
        if (
          edit.reason.at(-1) &&
          AutonEdit.TypeGuards.isModify(edit) &&
          "uuid" in edit
        ) {
          applyWEditPromise
            .then(() =>
              this.editorProvider.postMessage(
                webviewPanel,
                Message.ToWebview.ModifyResponse.respondWithSuccess(edit.uuid),
              ),
            )
            .catch(() =>
              this.editorProvider.postMessage(
                webviewPanel,
                Message.ToWebview.ModifyResponse.respondWithFailure(edit.uuid),
              ),
            );
        }
        if (Array.isArray(this.currentGroup)) {
          this.onCommandHighlightGroupIndicesAll({ webviewPanel, document });
        }
      }
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
      this.onDidChangeAutonIndex({
        webviewPanel,
        document,
        newIndex: selection.map(({ id }) =>
          this.editorProvider.getAuton(document).getIndexFromId(id),
        ),
        reason: ["server.editor.eventListener.onAutonViewDidChangeSelection"],
      });
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

    currentGroup?: string[] | string;
    /**
     * Called by {@link onAutonViewDidChangeSelection} and {@link onDidChangeTextEditorSelection} to synchronize the index between editor, treeView, and webviewPanel
     */
    async onDidChangeAutonIndex({
      newIndex,
      reason,
      document,
      webviewPanel,
    }: {
      newIndex: number | number[];
      reason: string[];
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
    }) {
      const newIndices = Array.isArray(newIndex) ? newIndex : [newIndex];
      if (newIndices.length <= 0) return;
      if (
        !newIndices.every(
          (e, i) => e == this.editorProvider.getAutonIndices(document)?.[i],
        )
      ) {
        this.editorProvider.postMessage(
          webviewPanel,
          new Message.ToWebview.IndexUpdate(newIndices[0]),
        );
      }

      this.editorProvider.setAutonIndices(
        document,
        newIndices as [number, ...number[]],
      );

      if (
        reason[0] !==
          "server.editor.eventListener.onAutonViewDidChangeSelection" &&
        vscode.window.activeTextEditor?.document.uri.toString() ===
          document.uri.toString()
      ) {
        newIndices.forEach((i) => {
          const item = AutonEditorProvider.autonView.getTreeItemFromId(
            this.editorProvider.getAuton(document).auton[i].uuid,
          );
          if (!item) return;
          AutonEditorProvider.autonView.view.reveal(item, { select: true });
        });
      }
      if (
        reason[0] !==
        "server.editor.eventListener.onDidChangeTextEditorSelection" /* &&
        vscode.window.activeTextEditor?.document.uri.toString() !==
          document.uri.toString() */
      ) {
        let editor = vscode.window.visibleTextEditors.find(
          (editor) => editor.document.uri === document.uri,
        );
        if (editor == null)
          editor = await vscode.window.showTextDocument(document);
        if (!editor) return;

        editor.selections = newIndices
          .flatMap((i) => {
            const act = this.editorProvider.getAuton(document).auton[i];
            return (
              Array.isArray(this.currentGroup)
                ? this.currentGroup
                : [this.currentGroup]
            )
              .filter(
                (group): group is string | undefined =>
                  group === undefined ||
                  (group in act.groupIndices &&
                    act.groupIndices[group] !== undefined),
              )
              .map((group) =>
                Translation.AutonToCpp.upgradeOffsetsToRange(
                  group
                    ? {
                        offset: act.groupIndices[group]![0],
                        endOffset: act.groupIndices[group]![1],
                      }
                    : act,
                  document,
                ),
              );
          })
          .map(({ end, start }) => new vscode.Selection(start, end));
      }
    }

    onCommandHighlightGroupIndicesNext({
      webviewPanel,
      document,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
    }) {
      if (this.editorProvider.getAutonIndices(document)) {
        const actGroupIndices =
          this.editorProvider.getAuton(document).auton[
            this.editorProvider.getAutonIndices(document)[0]
          ].groupIndices;
        const actGroups = [undefined, ...Object.keys(actGroupIndices)];
        let index =
          actGroups.indexOf(
            Array.isArray(this.currentGroup)
              ? this.currentGroup[0]
              : this.currentGroup,
          ) + 1;
        while (
          actGroups.at(index) !== undefined &&
          actGroupIndices[actGroups.at(index)!] === undefined
        ) {
          index++;
        }
        this.currentGroup = actGroups.at(index);
        this.onDidChangeAutonIndex({
          webviewPanel,
          document,
          newIndex: this.editorProvider.getAutonIndices(document),
          reason: ["onCommandHighlightGroupIndicesNext"],
        });
      }
    }

    onCommandHighlightGroupIndicesPrevious({
      webviewPanel,
      document,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
    }) {
      if (this.editorProvider.getAutonIndices(document)) {
        const actGroupIndices =
          this.editorProvider.getAuton(document).auton[
            this.editorProvider.getAutonIndices(document)[0]
          ].groupIndices;
        const actGroups = [undefined, ...Object.keys(actGroupIndices)];
        let index =
          actGroups.indexOf(
            Array.isArray(this.currentGroup)
              ? this.currentGroup[0]
              : this.currentGroup,
          ) - 1;
        while (
          actGroups.at(index) !== undefined &&
          actGroupIndices[actGroups.at(index)!] === undefined
        ) {
          index--;
        }
        this.currentGroup = actGroups.at(index);
        this.onDidChangeAutonIndex({
          webviewPanel,
          document,
          newIndex: this.editorProvider.getAutonIndices(document),
          reason: ["onCommandHighlightGroupIndicesPrevious"],
        });
      }
    }

    onCommandHighlightGroupIndicesAll({
      webviewPanel,
      document,
    }: {
      webviewPanel: vscode.WebviewPanel;
      document: vscode.TextDocument;
    }) {
      if (this.editorProvider.getAutonIndices(document)) {
        const groupIndices =
          this.editorProvider.getAuton(document).auton[
            this.editorProvider.getAutonIndices(document)[0]
          ].groupIndices;
        this.currentGroup = Object.keys(groupIndices).filter(
          (group) => groupIndices[group] !== undefined,
        );
        this.onDidChangeAutonIndex({
          webviewPanel,
          document,
          newIndex: this.editorProvider.getAutonIndices(document),
          reason: ["onCommandHighlightGroupIndicesAll"],
        });
      }
    }
  })(this);

  private constructor(private readonly _context: vscode.ExtensionContext) {}

  /**
   * Get the static HTML used for in our editor's webviews.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Local path to script and css for the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "dist", "main.bundle.js"),
    );

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "reset.css"),
    );

    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "vscode.css"),
    );

    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "wflAuton.css"),
    );

    const FieldSvgUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "media",
        "SpinUpField.svg",
      ),
    );

    const RobotSvgUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "robot.svg"),
    );
    const TurnToTargetSvgUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "media",
        "turnToTarget.svg",
      ),
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
      <!-- 140.4 is the field length as defined in VRC Over Under Game Manual: Page A8 -->
      <svg width="100%" height="100%" viewBox="-70.2 -70.2 140.4 140.4" version="1.1" xmlns="http://www.w3.org/2000/svg" class="field-svg">
  <image x="-70.2" y="-70.2" width="140.4" height="140.4" href="${FieldSvgUri}" class="field-background"></image>
  <g transform="scale(1,-1)">
  <image x="-9" y="-9" width="18" height="18" href="${RobotSvgUri}" class="robot"></image>
  <image x="-6" y="-6" width="12" height="12" href="${TurnToTargetSvgUri}" class="turn-to" visibility="hidden"></image>
  </g>
</svg>

  ${
    ""
    // <img class="robot"
    //  src="${robotPngUri}"
    //  alt="robot">
    // <div class="drawing-canvas"></div>
    // <div class="drawing-controls">
    // 	<button data-color="black" class="black active" title="Black"></button>
    // 	<button data-color="white" class="white" title="White"></button>
    // 	<button data-color="red" class="red" title="Red"></button>
    // 	<button data-color="green" class="green" title="Green"></button>
    // 	<button data-color="blue" class="blue" title="Blue"></button>
    // </div>
  }   
  			<script nonce="${nonce}" src="${scriptUri}"></script>
  			</body>
  			</html>`;
  }

  private readonly _callbacks = new Map<UUID, (response: any) => void>();

  private async postMessageWithResponse<R = unknown>(
    panel: vscode.WebviewPanel,
    msg: typeof Message.ToWebview.prototype,
  ): Promise<R> {
    // const requestId = this._requestId++;
    const p = new Promise<R>((resolve) => this._callbacks.set(msg.id, resolve));
    // panel.webview.postMessage({ type, requestId, body });
    panel.webview.postMessage(msg);
    return await p;
  }

  private postEdits(
    panel: vscode.WebviewPanel,
    edits: Array<AutonEdit.AutonEdit<Action>>,
    newIndex?: number,
  ) {
    const filteredEdits = edits.filter(
      (e) =>
        ["adjustOffset", "adjustText"].every(
          (endStr) => !e.reason.at(-1)?.endsWith(endStr),
        ) && e.reason.every((r) => !r.startsWith("webview")),
    );
    if (filteredEdits.length > 0) {
      this.postMessage(
        panel,
        new Message.ToWebview.Edit(filteredEdits, newIndex),
      );
    }
  }

  private postMessage(
    panel: vscode.WebviewPanel,
    msg: typeof Message.ToWebview.prototype /* type: string, body: any */,
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
