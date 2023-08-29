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
import { SignalDispatcher } from "strongly-typed-events";
import { UUID } from "crypto";
import { ActionWithRanges } from "./astTranslator";
import { AutonList, AutonListData } from "./autonList";

export type TreeItemID =
  | { type: "func"; uri: string; funcName: string }
  | { type: "act"; uuid: UUID };

export class AutonTreeProvider implements vscode.TreeDataProvider<TreeItemID> {
  /* ,
    vscode.TreeDragAndDropController<TreeItemID> */
  private readonly _onDidChangeTreeData: vscode.EventEmitter<
    TreeItemID | undefined | void
  > = new vscode.EventEmitter<TreeItemID | undefined | void>();

  public onDidChangeTreeData: vscode.Event<TreeItemID | undefined | void> =
    this._onDidChangeTreeData.event;

  private readonly _onRefreshCommand = new SignalDispatcher();
  public get onRefreshCommand() {
    return this._onRefreshCommand.asEvent();
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  private readonly _view: vscode.TreeView<TreeItemID>;

  public get view() {
    return this._view;
  }

  // public setAuton<T extends Action = Action>(auton: Auton<T>): Auton<T> {
  //   // this.auton.onModified.unsub(this.setData);
  //   this.auton = auton as unknown as Auton;
  //   // this.setData();
  //   this.auton.onModified.sub(this.setData.bind(this));
  //   return auton;
  // }

  // public editAuton<T extends AutonEdit.AutonEdit | AutonEdit.AutonEdit[]>(
  //   _edit: T
  // ): T {
  //   this.auton.makeEdit(_edit);
  //   this.setData();
  //   return _edit;
  // }

  // /** sets this.data using this.auton */
  // private setData() {
  //   this.data = TreeItem.fromAuton(this.auton, this._context);
  //   // console.log("SET DATA!", this.auton, this.data);
  //   this.refresh();
  // }
  constructor(
    protected _context: vscode.ExtensionContext /*     protected auton: Auton = Auton.newAutonAtOrigin() */,
    private readonly data: AutonList,
  ) {
    this._view = vscode.window.createTreeView("vrc-auton.list-view", {
      treeDataProvider: this,
      showCollapseAll: false,
      canSelectMany: true,
      // dragAndDropController: this,
    });
    _context.subscriptions.push(this._view);
    _context.subscriptions.push(
      new vscode.Disposable(this.onRefreshCommand.sub(() => this.refresh())),
    );

    vscode.commands.registerCommand("vrc-auton.list-view.refresh", () =>
      this._onRefreshCommand.dispatch(),
    );
  }

  getTreeItem(element: TreeItemID): vscode.TreeItem {
    if (element.type === "act") {
      try {
        const actionDesc = this.data.findUUID(element.uuid);
        if (actionDesc == null) throw "uuid does not correspond to any action";
        return TreeItem.fromAction(
          actionDesc.act,
          vscode.Uri.parse(actionDesc.uri),
          this._context,
        );
      } catch (e) {
        console.error(e);
        throw e;
      }
    } else {
      const item = new vscode.TreeItem(
        element.funcName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      // go to
      try {
        item.command = {
          title: "Jump to",
          command: "vscode.open",
          arguments: [
            element.uri,
            {
              preserveFocus: true,
              selection: this.data.getFuncAutons(element.funcName)[0].range,
            },
          ],
        };
      } catch (e) {
        console.trace();
        console.error(e);
        throw e;
      }
      item.tooltip = `${element.uri}: ${element.funcName}`;
      item.contextValue = "auton";
      return item;
    }
  }

  private static actToId({ uuid }: Action): TreeItemID {
    return { type: "act", uuid };
  }

  private static funcToId({
    uri,
    funcName,
  }: Pick<AutonListData, "funcName" | "uri">): TreeItemID {
    return { type: "func", uri, funcName };
  }

  getChildren(
    element?: TreeItemID | undefined,
  ): vscode.ProviderResult<TreeItemID[]> {
    if (element == null) {
      return this.data.getData().map(AutonTreeProvider.funcToId);
    }
    if (element.type === "func") {
      return this.data
        .getFuncAutons(element.funcName, element.uri)
        .flatMap(({ auton: { auton } }) =>
          auton.map(AutonTreeProvider.actToId),
        );
    }
    return [];
  }

  // tree drag and drop provider
  // reference: https://github.com/microsoft/vscode-extension-samples/blob/main/tree-view-sample/src/testViewDragAndDrop.ts
  static DROP_MIME_TYPE = "application/vnd.code.tree.vrc-auton";
  dropMimeTypes = [AutonTreeProvider.DROP_MIME_TYPE];
  dragMimeTypes = ["text/uri-list"];

  // handleDrag?(
  //   source: readonly TreeItem[],
  //   dataTransfer: vscode.DataTransfer,
  //   token: vscode.CancellationToken
  // ): void | Thenable<void> {
  //   dataTransfer.set(
  //     AutonTreeProvider.DROP_MIME_TYPE,
  //     new vscode.DataTransferItem(source.map((e) => e.id))
  //   );
  //   // throw new Error("Method not implemented.");
  // }
  // handleDrop?(
  //   target: TreeItem | undefined,
  //   dataTransfer: vscode.DataTransfer,
  //   token: vscode.CancellationToken
  // ): void | Thenable<void> {
  //   const transferItem = dataTransfer.get(AutonTreeProvider.DROP_MIME_TYPE);
  //   if (!transferItem) {
  //     return;
  //   }
  //   const treeItems: TreeItem["id"][] = transferItem.value;

  //   console.log({ target, dataTransfer, treeItem: treeItems });
  //   if (
  //     target?.id !== treeItems[0] &&
  //     (target === undefined ||
  //       this.data[this.data.indexOf(target) + 1]?.id !== treeItems[0])
  //   )
  //     try {
  //       // index of element that treeItems should go under
  //       let targetIndex = target
  //         ? this.auton.auton.findIndex((e) => target.id == e.uuid)
  //         : this.data.length;
  //       let firstTreeItemIndex = this.auton.auton.findIndex(
  //         (e) => treeItems[0] == e.uuid
  //       );
  //       // index directly after last treeItem's index
  //       let indexAfterTreeItems =
  //         this.auton.auton.findIndex((e) => treeItems.at(-1) == e.uuid) + 1;
  //       this.auton.makeEdit({
  //         insertionIndex: targetIndex,
  //         sourceStart: firstTreeItemIndex,
  //         sourceEnd: indexAfterTreeItems,
  //         reason: ["server.view.handleDrop"],
  //       });
  //     } catch (error) {
  //       console.error("AutonView.handleDrop: ", error);
  //       if (
  //         isNativeError(error) ||
  //         typeof error !== "string" ||
  //         !/^auton\.\w+\(\):/.test(error)
  //       )
  //         throw error;
  //     }
  //   // let roots = this._getLocalRoots(treeItems);
  //   // // Remove nodes that are already target's parent nodes
  //   // roots = roots.filter(r => !this._isChild(this._getTreeElement(r.key), target));
  //   // if (roots.length > 0) {
  //   // 	// Reload parents of the moving elements
  //   // 	const parents = roots.map(r => this.getParent(r));
  //   // 	roots.forEach(r => this._reparentNode(r, target));
  //   // 	this._onDidChangeTreeData.fire([...parents, target]);
  //   // }
  // }

  getParent(id: TreeItemID): TreeItemID | undefined {
    if (id.type == "act") {
      try {
        const actData = this.data.findUUID(id.uuid);
        if (actData == null) throw "action with uuid not found";
        return AutonTreeProvider.funcToId(actData);
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
  }
}

/** makes some of Type's member required  */
type RequireSome<Type, RequiredMembers extends keyof Type> = Partial<
  Omit<Type, RequiredMembers>
> &
  Required<Pick<Type, RequiredMembers>>;
/** function with return type T or value with type t */
type FunctionOrT<T, FuncParam> =
  | ((...params: FuncParam extends unknown[] ? FuncParam : [FuncParam]) => T)
  | T;

type ActionToTreeItemMap<A extends Action> = {
  readonly [P in A["type"]]: {
    readonly [K in keyof Omit<TreeItemProperties, "id">]: FunctionOrT<
      TreeItemProperties[K],
      [
        Extract<A, { type: P }>,
        TreeItemProperties[K] extends vscode.Uri ? vscode.Uri : never,
      ]
    >;
  };
};
const basicActionIconPath: (act: Action, extUri: vscode.Uri) => vscode.Uri = (
  act: Action,
  extUri: vscode.Uri,
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
> & { children?: Array<TreeItem | TreeItemProperties>; id: UUID };

export class TreeItem extends vscode.TreeItem implements TreeItemProperties {
  children: TreeItem[] | undefined;

  label: TreeItemProperties["label"];
  id: TreeItemProperties["id"];

  public static fromAction<A extends ActionWithRanges["type"]>(
    action: Extract<ActionWithRanges, { type: A }>,
    uri: vscode.Uri,
    context: vscode.ExtensionContext,
  ) {
    const rawTreeItemProps = actionToTreeItem[action.type as A];
    try {
      const treeItemProps: Partial<TreeItemProperties> = { id: action.uuid };
      for (const property of Object.keys(rawTreeItemProps) as Array<
        keyof typeof rawTreeItemProps
      >) {
        const value = rawTreeItemProps[property];
        if (value !== undefined) {
          treeItemProps[property as keyof Omit<TreeItemProperties, "id">] =
            typeof value === "function"
              ? value(
                  action,
                  ["iconPath", "resourceUri"].includes(
                    property as keyof Omit<TreeItemProperties, "id">,
                  )
                    ? context.extensionUri
                    : undefined,
                )
              : value;
        }
      }
      treeItemProps.command = {
        title: "Jump to",
        command: "vscode.open",
        arguments: [
          uri,
          {
            preserveFocus: true,
            selection: action.range,
          },
        ],
      };
      return new TreeItem(treeItemProps as TreeItemProperties);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
  // /** produces an array of tree items representing the auton */
  // public static fromAuton(
  //   auton: Auton,
  //   context: vscode.ExtensionContext
  // ): TreeItem[] {
  //   return auton.auton.map((action) => TreeItem.fromAction(action, context));
  // }

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
        : vscode.TreeItemCollapsibleState.Expanded,
    );
    this.children = children?.map((e) =>
      e instanceof TreeItem ? e : new TreeItem(e),
    );
    this.label = label;
    this.id = id;
    if (accessibilityInformation != null) {
      this.accessibilityInformation = accessibilityInformation;
    }
    if (collapsibleState) this.collapsibleState = collapsibleState;
    if (command != null) this.command = command;
    if (contextValue) this.contextValue = contextValue;
    if (description) this.description = description;
    if (iconPath) this.iconPath = iconPath;
    if (id) this.id = id;
    if (resourceUri != null) this.resourceUri = resourceUri;
    if (tooltip) this.tooltip = tooltip;
  }
}
