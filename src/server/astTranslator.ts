import * as vscode from "vscode";
import { Translation } from "./translator";
import { Action } from "../common/action";
import Auton from "../common/auton";
import { randomUUID } from "crypto";
import { AutonData } from "../common/auton";
import { AutonListData } from "./autonList";

interface RawASTNode {
  role: string; // e.g. expression
  kind: string; // e.g. BinaryOperator
  detail?: string; // e.g. ||
  arcana?: string; // e.g. BinaryOperator <0x12345> <col:12, col:1> 'bool' '||'
  children?: Array<RawASTNode>;
  range?: Record<"start" | "end", { line: number; character: number }>;
}
interface ASTNode extends RawASTNode {
  children?: Array<ASTNode>;
  range?: vscode.Range;
}
interface FunctionDecASTNode extends ASTNode {
  kind: "Function";
  role: "declaration";
  children: Array<ASTNode>;
}
interface CallExprASTNode extends ASTNode {
  kind: "Call";
  role: "expression";
  children: Array<ASTNode>;
}
export type ActionWithRanges = Action & {
  range: vscode.Range;
  paramRanges: {
    [p in keyof Action["params"]]: vscode.Range;
  };
};
export type ClangdAPI = {
  retrieveAst: (
    range: vscode.Range,
    uri: vscode.Uri
  ) => Promise<RawASTNode | null>;
};

export class ASTTranslator {
  /** converts {@link RawASTNode.range range} to {@link vscode.Range}  */
  private static upgradeRawNode<Param extends RawASTNode | undefined | null>(
    rawNode: Param
  ): ASTNode & Param {
    return (
      rawNode && {
        ...rawNode,
        children: rawNode.children?.map(this.upgradeRawNode.bind(this)),
        range:
          rawNode.range &&
          new vscode.Range(
            rawNode.range.start.line,
            rawNode.range.start.character,
            rawNode.range.end.line,
            rawNode.range.end.character
          ),
      }
    );
  }
  private static async getAST(
    range: vscode.Range,
    uri: vscode.Uri
  ): Promise<ASTNode | null> {
    let clangd = vscode.extensions.getExtension<ClangdAPI>(
      "llvm-vs-code-extensions.vscode-clangd"
    );
    if (clangd == undefined) throw "clangd not yet activated";
    return this.upgradeRawNode(await clangd.exports.retrieveAst(range, uri));
  }
  /** gets all function declaration nodes that are part of the autons namespace */
  private static async getFunctions(
    uri: vscode.Uri
  ): Promise<FunctionDecASTNode[]> {
    return (
      await Promise.all(
        (
          await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            "vscode.executeDocumentSymbolProvider",
            uri
          )
        )
          .filter((s) => s.kind === vscode.SymbolKind.Function)
          .map((s) => this.getAST(s.range, uri))
      )
    ).filter(
      (node): node is FunctionDecASTNode =>
        !!(
          node &&
          node.children?.some(
            (child) =>
              child.kind === "Namespace" &&
              child.role === "specifier" &&
              child.detail?.startsWith("autons")
          )
        )
    );
  }
  private static getCallExprs(funcNode: FunctionDecASTNode): CallExprASTNode[] {
    return (
      funcNode.children
        .at(-1)
        ?.children?.filter(
          (call): call is CallExprASTNode =>
            call.kind === "Call" &&
            call.role === "expression" &&
            !!call.children
        ) || []
    );
  }
  /** Finds first node that has the properties specified by {@link prop}. */
  private static findNode(
    root: ASTNode,
    prop: Partial<Omit<ASTNode, "children" | "range" | "arcana">>
  ): ASTNode | null {
    if (
      (!prop.detail || prop.detail === root.detail) &&
      (!prop.kind || prop.kind === root.kind) &&
      (!prop.role || prop.detail === root.role)
    )
      return root;
    let cur = null;
    if (root.children)
      for (let i = 0; i < root.children.length; i++) {
        cur = this.findNode(root.children[i], prop);
        if (cur) return cur;
      }
    return null;
  }
  /** should preserve property order hopefully? */
  static ActionDescriptor: ActionDescriptorType = {
    set_pose: { x: "float", y: "float", heading: "float", radians: "boolean" },
    move_to: {
      x: "float",
      y: "float",
      timeout: "int",
      maxSpeed: "float",
      log: "boolean",
    },
    turn_to: {
      x: "float",
      y: "float",
      timeout: "int",
      reversed: "boolean",
      maxSpeed: "float",
      log: "boolean",
    },
    follow: {
      filePath: "string",
      timeout: "int",
      lookahead: "float",
      reverse: "boolean",
      maxSpeed: "float",
      log: "boolean",
    },
    roller: {},
    expand: {},
    shoot: {},
    piston_shoot: {},
    intake: {},
    stop_intake: {},
    wait: { milliseconds: "int" },
  };
  private static paramTypeToASTKind: {
    [k in "float" | "int" | "boolean" | "string"]: {
      kind: string;
      try: ("float" | "int" | "boolean" | "string")[];
    };
  } = {
    float: { kind: "FloatingLiteral", try: ["int", "boolean"] },
    int: { kind: "IntegerLiteral", try: ["float", "boolean"] },
    boolean: { kind: "CXXBoolLiteral", try: ["int", "float"] },
    string: { kind: "StringLiteral", try: [] },
  };
  private static convertCallExprToAction(
    call: CallExprASTNode,
    doc: vscode.TextDocument
  ): ActionWithRanges | null {
    const declRef = call.children[0].children?.[0];
    if (
      !declRef ||
      !declRef.children?.[0]?.detail?.startsWith("auton") ||
      !declRef.detail ||
      !call.range
    )
      return null;

    const snakeCaseCallName = declRef.detail.replaceAll(
      /[A-Z]/g,
      (match) => `_${match.toLowerCase()}`
    ) as Action["type"];

    if (!(snakeCaseCallName in this.ActionDescriptor)) return null;

    const params: { [k: string]: any } = {};
    const paramRanges: { [k: string]: vscode.Range } = {};
    const actDesc = Object.entries(this.ActionDescriptor[snakeCaseCallName]);

    for (let i = 1; i < call.children.length; i++) {
      let paramType = actDesc[i - 1][1];
      let paramName = actDesc[i - 1][0];
      let paramVal = null;

      for (const [castType, kind] of [
        paramType,
        ...this.paramTypeToASTKind[actDesc[i - 1][1]].try,
      ].map((t): [typeof t, string] => [t, this.paramTypeToASTKind[t].kind])) {
        const foundNode = this.findNode(call.children[i], { kind });
        if (!foundNode || !foundNode.range) continue;
        paramRanges[paramName] = foundNode.range;

        switch (castType) {
          case "string":
            paramVal = doc.getText(foundNode.range);
            break;
          case "boolean":
            paramVal = Boolean(foundNode.detail);
            break;
          case "int":
          case "float":
            paramVal = Number(foundNode.detail);
            break;
        }
        if (paramVal) break;
      }

      if (!paramVal) continue;
      switch (paramType) {
        case "boolean":
          paramVal = !!paramVal;
          break;
        case "int":
          paramVal = Math.floor(Number(paramVal));
          break;
        case "float":
          paramVal = Number(paramVal);
          break;
      }

      params[paramName] = paramVal;
    }

    return {
      type: snakeCaseCallName,
      uuid: randomUUID(),
      params,
      range: call.range,
      paramRanges,
    } as ActionWithRanges;
  }

  private static functionToAuton(
    funcNode: FunctionDecASTNode,
    doc: vscode.TextDocument
  ): Auton<ActionWithRanges> {
    const acts = this.getCallExprs(funcNode)
      .map((call) => this.convertCallExprToAction(call, doc))
      .filter(
        (act): act is ActionWithRanges => act !== null
      ) as AutonData<ActionWithRanges>;
    return new Auton<ActionWithRanges>(acts[0], acts.slice(1));
  }

  public static async getAutons(
    doc: vscode.TextDocument
  ): Promise<Omit<AutonListData<ActionWithRanges>, "uri">[]> {
    return (await this.getFunctions(doc.uri))
      .filter(
        (
          funcNode
        ): funcNode is FunctionDecASTNode &
          Required<Pick<FunctionDecASTNode, "detail" | "range">> =>
          funcNode.detail !== undefined && funcNode.range !== undefined
      )
      .map((funcNode): Omit<AutonListData<ActionWithRanges>, "uri"> => {
        return {
          range: funcNode.range,
          funcName: funcNode.detail,
          auton: this.functionToAuton(funcNode, doc),
        };
      });
  }
}
type ActionTypeToParamsMap = {
  [k in Action["type"]]: Extract<Action, { type: k }>["params"];
};
type ActionDescriptorType = {
  [k in Action["type"]]: {
    [p in keyof ActionTypeToParamsMap[k]]-?: NonNullable<
      ActionTypeToParamsMap[k][p]
    > extends string
      ? "string"
      : NonNullable<ActionTypeToParamsMap[k][p]> extends boolean
      ? "boolean"
      : "int" | "float";
  };
};
