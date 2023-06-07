import * as vscode from "vscode";
import { ThemeIcon } from "vscode";
import {
  Action,
  SetPose,
  MoveTo,
  TurnTo,
  Follow,
  Wait,
  BaseAction,
} from "../common/action";
import Auton, { AutonEdit } from "../common/auton";
import { isNativeError } from "util/types";
import { SignalDispatcher } from "strongly-typed-events";
import { UUID } from "crypto";

export class AutonTreeProvider
  implements
    vscode.TreeDataProvider<TreeItem>,
    vscode.TreeDragAndDropController<TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | void
  > = new vscode.EventEmitter<TreeItem | undefined | void>();
  public onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private _onRefreshCommand = new SignalDispatcher();
  public get onRefreshCommand() {
    return this._onRefreshCommand.asEvent();
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  private _view: vscode.TreeView<TreeItem>;
  private data: TreeItem[] = [];

  public get view() {
    return this._view;
  }

  public setAuton<T extends Action = Action>(auton: Auton<T>): Auton<T> {
    this.auton.onModified.unsub(this.setData);
    this.auton = auton as unknown as Auton;
    this.setData();
    this.auton.onModified.sub(this.setData.bind(this));
    return auton;
  }

  // public editAuton<T extends AutonEdit.AutonEdit | AutonEdit.AutonEdit[]>(
  //   _edit: T
  // ): T {
  //   this.auton.makeEdit(_edit);
  //   this.setData();
  //   return _edit;
  // }

  /** sets this.data using this.auton */
  private setData() {
    this.data = TreeItem.fromAuton(this.auton, this._context);
    // console.log("SET DATA!", this.auton, this.data);
    this.refresh();
  }
  constructor(
    protected _context: vscode.ExtensionContext,
    protected auton: Auton = Auton.newAutonAtOrigin()
  ) {
    this.setData();

    this._view = vscode.window.createTreeView("vrc-auton.list-view", {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: true,
      dragAndDropController: this,
    });
    _context.subscriptions.push(this._view);
    _context.subscriptions.push(
      new vscode.Disposable(this.onRefreshCommand.sub(() => this.refresh()))
    );

    vscode.commands.registerCommand("vrc-auton.list-view.refresh", () =>
      this._onRefreshCommand.dispatch()
    );
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }
  getTreeItemFromId(id: UUID): TreeItem | undefined {
    return this.data.find((e) => e.id === id);
  }

  getChildren(
    element?: TreeItem | undefined
  ): vscode.ProviderResult<TreeItem[]> {
    if (!element) {
      return this.data;
    }
    return element.children;
  }

  // tree drag and drop provider
  // reference: https://github.com/microsoft/vscode-extension-samples/blob/main/tree-view-sample/src/testViewDragAndDrop.ts
  static DROP_MIME_TYPE: string = "application/vnd.code.tree.vrc-auton";
  dropMimeTypes = [AutonTreeProvider.DROP_MIME_TYPE];
  dragMimeTypes = ["text/uri-list"];

  handleDrag?(
    source: readonly TreeItem[],
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    dataTransfer.set(
      AutonTreeProvider.DROP_MIME_TYPE,
      new vscode.DataTransferItem(source.map((e) => e.id))
    );
    // throw new Error("Method not implemented.");
  }
  handleDrop?(
    target: TreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    const transferItem = dataTransfer.get(AutonTreeProvider.DROP_MIME_TYPE);
    if (!transferItem) {
      return;
    }
    const treeItems: TreeItem["id"][] = transferItem.value;

    console.log({ target, dataTransfer, treeItem: treeItems });
    if (
      target?.id !== treeItems[0] &&
      (target === undefined ||
        this.data[this.data.indexOf(target) + 1]?.id !== treeItems[0])
    )
      try {
        // index of element that treeItems should go under
        let targetIndex = target
          ? this.auton.auton.findIndex((e) => target.id == e.uuid)
          : this.data.length;
        let firstTreeItemIndex = this.auton.auton.findIndex(
          (e) => treeItems[0] == e.uuid
        );
        // index directly after last treeItem's index
        let indexAfterTreeItems =
          this.auton.auton.findIndex((e) => treeItems.at(-1) == e.uuid) + 1;
        this.auton.makeEdit({
          insertionIndex: targetIndex,
          sourceStart: firstTreeItemIndex,
          sourceEnd: indexAfterTreeItems,
          reason: ["server.view.handleDrop"],
        });
      } catch (error) {
        console.error("AutonView.handleDrop: ", error);
        if (
          isNativeError(error) ||
          typeof error !== "string" ||
          !/^auton\.\w+\(\):/.test(error)
        )
          throw error;
      }
    // let roots = this._getLocalRoots(treeItems);
    // // Remove nodes that are already target's parent nodes
    // roots = roots.filter(r => !this._isChild(this._getTreeElement(r.key), target));
    // if (roots.length > 0) {
    // 	// Reload parents of the moving elements
    // 	const parents = roots.map(r => this.getParent(r));
    // 	roots.forEach(r => this._reparentNode(r, target));
    // 	this._onDidChangeTreeData.fire([...parents, target]);
    // }
  }

  getParent({ id }: TreeItem): vscode.ProviderResult<TreeItem> {
    return this.data.find(({ id: parentId }) => parentId == id);
  }
}

/** makes some of Type's member required  */
type RequireSome<Type, RequiredMembers extends keyof Type> = Partial<
  Omit<Type, RequiredMembers>
> &
  Required<Pick<Type, RequiredMembers>>;
/** function with return type T or value with type t*/
type FunctionOrT<T, FuncParam> =
  | ((
      ...params: FuncParam extends Array<unknown> ? FuncParam : [FuncParam]
    ) => T)
  | T;

type ActionToTreeItemMap<A extends Action> = {
  readonly [P in A["type"]]: {
    readonly [K in keyof Omit<TreeItemProperties, "id">]: FunctionOrT<
      TreeItemProperties[K],
      [
        Extract<A, { type: P }>,
        TreeItemProperties[K] extends vscode.Uri ? vscode.Uri : never
      ]
    >;
  };
};
const basicActionIconPath: (act: Action, extUri: vscode.Uri) => vscode.Uri = (
  act: Action,
  extUri: vscode.Uri
) => vscode.Uri.joinPath(extUri, "media", "actionIcons", `${act.type}.svg`);

const actionToTreeItem: ActionToTreeItemMap<Action> = {
  set_pose: {
    label: ({ params: { x, y, heading, radians } }: SetPose) => {
      return `Set Pose: (${x}, ${y}, ${heading}${radians ? "rad" : "°"})`;
    },
    iconPath: new ThemeIcon("plus"),
  },
  move_to: {
    label: ({ params: { x, y, timeout, maxSpeed, log } }: MoveTo) => {
      return `Move To: (${x}, ${y}), ${timeout}ms${
        maxSpeed ? `, ${maxSpeed}${log ? ", true" : ""}` : ""
      }`;
    },
    iconPath: new ThemeIcon("move"),
  },
  turn_to: {
    label: ({ params: { x, y, timeout, reversed, maxSpeed, log } }: TurnTo) =>
      `Turn ${reversed ? "Away" : "To"}: (${x}, ${y}), ${timeout}ms${
        maxSpeed ? `, ${maxSpeed}${log ? ", true" : ""}` : ""
      }`,
  },
  follow: {
    label: ({
      params: { filePath, timeout, lookahead, reverse, maxSpeed, log },
    }: Follow) =>
      `Follow: ${filePath}, ${timeout}ms, ${lookahead}in${
        reverse !== undefined
          ? `, true${
              maxSpeed !== undefined
                ? `, ${maxSpeed}${log ? ", true" : ""}`
                : ""
            }`
          : ""
      }`,
    iconPath: new ThemeIcon("git-branch"),
  },
  roller: {
    label: "Roller",
    iconPath: (act: Action, extUri: vscode.Uri) =>
      vscode.Uri.joinPath(extUri, "media", "actionIcons", `${act.type}.svg`),
  },
  expand: { label: "Expand", iconPath: basicActionIconPath },
  shoot: { label: "Shoot", iconPath: basicActionIconPath },
  piston_shoot: { label: "Piston Shoot", iconPath: basicActionIconPath },
  intake: { label: "Intake", iconPath: basicActionIconPath },
  stop_intake: { label: "Stop Intake", iconPath: basicActionIconPath },
  wait: {
    label: ({ params: { milliseconds } }: Wait) => `Wait: ${milliseconds}ms`,
    iconPath: new ThemeIcon("clock"),
  },
};

type TreeItemProperties = RequireSome<
  { [K in keyof vscode.TreeItem]: vscode.TreeItem[K] },
  "label"
> & { children?: (TreeItem | TreeItemProperties)[]; id: UUID };

export class TreeItem extends vscode.TreeItem implements TreeItemProperties {
  children: TreeItem[] | undefined;

  label: TreeItemProperties["label"];
  id: TreeItemProperties["id"];

  public static fromAction<A extends Action["type"]>(
    action: Extract<Action, { type: A }>,
    context: vscode.ExtensionContext
  ) {
    // let iconPath: string | vscode.Uri | vscode.ThemeIcon = "";
    // switch (action.type) {
    //   case "expand":
    //   case "roller":
    //   case "intake":
    //   case "stop_intake":
    //   case "shoot":
    //   case "piston_shoot":
    //     iconPath = vscode.Uri.joinPath(
    //       context.extensionUri,
    //       "media",
    //       "actionIcons",
    //       `${action.type}.svg`
    //     );
    //     break;
    //   case "follow":
    //     iconPath = new ThemeIcon("git-branch");
    //     break;
    //   case "move_to":
    //     iconPath = new ThemeIcon("move");
    //     break;
    //   case "turn_to":
    //     iconPath = new ThemeIcon("debug-restart");
    //     break;
    //   case "wait":
    //     iconPath = new ThemeIcon("clock");
    //     break;
    //   case "set_pose":
    //     iconPath = new ThemeIcon("plus");
    //     break;
    //   default:
    //     iconPath = action;
    // }
    // return new TreeItem({
    //   label: action.type.replaceAll(
    //     /(^|_)([a-z])/g,
    //     (_idc, startOrUnderscore: string, letter: string): string => {
    //       return (
    //         (startOrUnderscore.length > 0 ? " " : "") + letter.toUpperCase()
    //       );
    //     }
    //   ),
    //   ...(iconPath ? { iconPath } : {}),
    //   id: action.uuid,
    // });
    const rawTreeItemProps = actionToTreeItem[action.type as A];

    let treeItemProps: Partial<TreeItemProperties> = { id: action.uuid };
    for (const property of Object.keys(rawTreeItemProps) as Array<
      keyof typeof rawTreeItemProps
    >) {
      const value = rawTreeItemProps[property];
      if (value !== undefined) {
        treeItemProps[property as keyof Omit<TreeItemProperties, "id">] =
          typeof value == "function"
            ? value(
                action,
                ["iconPath", "resourceUri"].includes(
                  property as keyof Omit<TreeItemProperties, "id">
                )
                  ? context.extensionUri
                  : undefined
              )
            : value;
      }
    }
    return new TreeItem(treeItemProps as TreeItemProperties);
  }
  /** produces an array of tree items representing the auton */
  public static fromAuton(
    auton: Auton,
    context: vscode.ExtensionContext
  ): TreeItem[] {
    return auton.auton.map((action) => TreeItem.fromAction(action, context));
  }

  constructor({
    label,
    children,
    accessibilityInformation,
    collapsibleState,
    command,
    contextValue,
    description,
    iconPath,
    id,
    resourceUri,
    tooltip,
  }: TreeItemProperties) {
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.children = children?.map((e) =>
      e instanceof TreeItem ? e : new TreeItem(e)
    );
    this.label = label;
    this.id = id;
    if (accessibilityInformation)
      this.accessibilityInformation = accessibilityInformation;
    if (collapsibleState) this.collapsibleState = collapsibleState;
    if (command) this.command = command;
    if (contextValue) this.contextValue = contextValue;
    if (description) this.description = description;
    if (iconPath) this.iconPath = iconPath;
    if (id) this.id = id;
    if (resourceUri) this.resourceUri = resourceUri;
    if (tooltip) this.tooltip = tooltip;
  }
}
