import * as vscode from "vscode";
import { ThemeIcon } from "vscode";
import { Action } from "../common/action";
import Auton, { AutonEdit } from "../common/auton";

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

class TreeItem extends vscode.TreeItem {
  children: TreeItem[] | undefined;

  public static fromAction(action: Action, context: vscode.ExtensionContext) {
    let iconPath: string | vscode.Uri | vscode.ThemeIcon = "";
    switch (action.type) {
      case "expand":
      case "roller":
      case "intake":
      case "stop_intake":
      case "shoot":
      case "piston_shoot":
        iconPath = vscode.Uri.joinPath(
          context.extensionUri,
          "media",
          "actionIcons",
          `${action.type}.svg`
        );
        break;
      case "follow":
        iconPath = new ThemeIcon("git-branch");
        break;
      case "move_to":
        iconPath = new ThemeIcon("move");
        break;
      case "turn_to":
        iconPath = new ThemeIcon("debug_restart");
        break;
      case "wait":
        iconPath = new ThemeIcon("clock");
        break;
      case "set_pose":
        iconPath = new ThemeIcon("plus");
        break;
      default:
        iconPath = action;
    }
    return new TreeItem({
      label: action.type.replaceAll(
        /(^|_)([a-z])/g,
        (_idc, startOrUnderscord: string, letter: string): string => {
          return (
            (startOrUnderscord.length > 0 ? " " : "") + letter.toUpperCase()
          );
        }
      ),
      ...(iconPath ? { iconPath } : {}),
      id: action.uuid,
    });
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
  }: {
    accessibilityInformation?: vscode.AccessibilityInformation;
    collapsibleState?: vscode.TreeItemCollapsibleState;
    command?: vscode.Command;
    contextValue?: string;
    description?: string | boolean;
    iconPath?:
      | string
      | vscode.Uri
      | vscode.ThemeIcon
      | { dark: string | vscode.Uri; light: string | vscode.Uri };
    id?: string;
    label: string | vscode.TreeItemLabel;
    resourceUri?: vscode.Uri;
    tooltip?: string | vscode.MarkdownString;
    children?: TreeItem[];
  }) {
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.children = children;

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
