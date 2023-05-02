import * as vscode from "vscode";
import { ThemeIcon } from "vscode";
import {
  Action, SetPose,
  MoveTo, TurnTo,
  Follow, Wait
} from "../common/action";
import Auton from "../common/auton";

export class AutonTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | void
  > = new vscode.EventEmitter<TreeItem | undefined | void>();
  public onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  private data: TreeItem[] = [];

  public setAuton<T extends Action = Action>(auton: Auton<T>): Auton<T> {
    this.auton = auton;
    this.setData();
    this.auton.onModified = () => {
      this.setData();
    };
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
  }

  getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(
    element?: TreeItem | undefined
  ): vscode.ProviderResult<TreeItem[]> {
    if (!element) {
      return this.data;
    }
    return element.children;
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
> & { children?: (TreeItem | TreeItemProperties)[] };

class TreeItem extends vscode.TreeItem {
  children: TreeItem[] | undefined;

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
    return this;
  }
}
