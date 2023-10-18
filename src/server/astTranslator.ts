import * as vscode from "vscode";
import { Action } from "../common/action";
import Auton, { AutonEdit, AutonData } from "../common/auton";
import { randomUUID } from "crypto";

import { AutonListData } from "./autonList";

interface RawASTNode {
  role: string; // e.g. expression
  kind: string; // e.g. BinaryOperator
  detail?: string; // e.g. ||
  arcana?: string; // e.g. BinaryOperator <0x12345> <col:12, col:1> 'bool' '||'
  children?: RawASTNode[];
  range?: Record<"start" | "end", { line: number; character: number }>;
}
interface ASTNode extends RawASTNode {
  children?: ASTNode[];
  range?: vscode.Range;
}
interface FunctionDecASTNode extends ASTNode {
  kind: "Function";
  role: "declaration";
  children: ASTNode[];
}
interface CallExprASTNode extends ASTNode {
  kind: "Call";
  role: "expression";
  children: ASTNode[];
}
export type ActionWithRanges<T extends Action["type"] = Action["type"]> =
  T extends string
    ? Extract<Action, { type: T }> & {
        range: vscode.Range;
        paramRanges: Record<
          keyof Extract<Action, { type: T }>["params"],
          vscode.Range
        >;
      }
    : never;
export interface ClangdAPI {
  retrieveAst: (
    range: vscode.Range,
    uri: vscode.Uri,
  ) => Promise<RawASTNode | null>;
}

export class ASTTranslator {
  /** converts {@link RawASTNode.range range} to {@link vscode.Range}  */
  private static upgradeRawNode<Param extends RawASTNode>(
    rawNode: Param,
  ): ASTNode & Param {
    return {
      ...rawNode,
      children: rawNode.children?.map(this.upgradeRawNode.bind(this)),
      range:
        rawNode.range == null
          ? undefined
          : new vscode.Range(
              rawNode.range.start.line,
              rawNode.range.start.character,
              rawNode.range.end.line,
              rawNode.range.end.character,
            ),
    };
  }

  private static async getAST(
    range: vscode.Range,
    uri: vscode.Uri,
  ): Promise<ASTNode | null> {
    const clangd = vscode.extensions.getExtension<ClangdAPI>(
      "llvm-vs-code-extensions.vscode-clangd",
    );
    if (clangd == undefined) throw "clangd not yet activated";
    const astNode = await clangd.exports.retrieveAst(range, uri);
    if (astNode == null) return astNode;
    return this.upgradeRawNode(astNode);
  }

  /** gets all function declaration nodes that are part of the autons namespace */
  private static async getFunctions(
    uri: vscode.Uri,
  ): Promise<FunctionDecASTNode[]> {
    return (
      await Promise.all(
        (
          await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            "vscode.executeDocumentSymbolProvider",
            uri,
          )
        )
          .filter((s) => s.kind === vscode.SymbolKind.Function)
          .map(async (s) => await this.getAST(s.range, uri)),
      )
    ).filter(
      (node): node is FunctionDecASTNode =>
        !!(
          node != null &&
          node.children?.some(
            (child) =>
              child.kind === "Namespace" &&
              child.role === "specifier" &&
              child.detail?.startsWith("autons"),
          )
        ),
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
            call.children != undefined,
        ) ?? []
    );
  }

  /** Finds first node that has the properties specified by {@link prop}. */
  private static findNode(
    root: ASTNode,
    prop: Partial<Omit<ASTNode, "children" | "range" | "arcana">>,
  ): ASTNode | null {
    if (
      (!prop.detail || prop.detail === root.detail) &&
      (!prop.kind || prop.kind === root.kind) &&
      (!prop.role || prop.detail === root.role)
    ) {
      return root;
    }
    let cur = null;
    if (root.children != null) {
      for (let i = 0; i < root.children.length; i++) {
        cur = this.findNode(root.children[i], prop);
        if (cur != null) return cur;
      }
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

  private static readonly paramTypeToASTKind: {
    [k in "float" | "int" | "boolean" | "string"]: {
      kind: string;
      try: Array<"float" | "int" | "boolean" | "string">;
    };
  } = {
    float: { kind: "FloatingLiteral", try: ["int", "boolean"] },
    int: { kind: "IntegerLiteral", try: ["float", "boolean"] },
    boolean: { kind: "CXXBoolLiteral", try: ["int", "float"] },
    string: { kind: "StringLiteral", try: [] },
  };

  /**
   * yields root and all of it's descendants, always yielding the leftmost un-yielded child of previously yielded nodes
   */
  static *traverseAST(root: ASTNode): Generator<ASTNode, void, void> {
    yield root;
    if (root.children != null) {
      for (const child of root.children) {
        yield* this.traverseAST(child);
      }
    }
  }

  static readonly ParamInterpreter: ParameterInterpreter = {
    string: function (
      this: ParameterInterpreter,
      root: ASTNode,
      doc: vscode.TextDocument,
    ): string {
      const foundNode = ASTTranslator.findNode(root, { kind: "StringLiteral" });
      if (foundNode != null) return doc.getText(foundNode?.range);
      throw "could not parse string";
    },
    boolean: function (
      this: ParameterInterpreter,
      root: ASTNode,
      doc: vscode.TextDocument,
    ): boolean {
      const generator = ASTTranslator.traverseAST(root);
      for (const node of generator) {
        if (node.kind === "CXXBoolLiteral")
          return !(node.detail?.match("true") == null);
        else if (node.kind === "UnaryOperator" && node.detail === "!") {
          const next = generator.next().value;
          if (next != null) return !this.boolean(next, doc);
        } else if (node.kind === "ImplicitCast") {
          const next = generator.next().value;
          if (next != null) {
            switch (node.detail?.split("ToBoolean")[0]) {
              case "Floating":
                return new Boolean(this.float(next, doc)).valueOf();
              case "Integral":
                return new Boolean(this.int(next, doc)).valueOf();
            }
          }
        } else if (node.kind === "BinaryOperator") {
          const nodeA = node.children?.[0];
          const nodeB = node.children?.[1];
          if (nodeA != null && nodeB != null) {
            switch (node.detail) {
              case "|":
                return this.boolean(nodeA, doc) || this.boolean(nodeB, doc);
              case "^":
                return this.boolean(nodeA, doc) !== this.boolean(nodeB, doc);
              case "&":
                return this.boolean(nodeA, doc) && this.boolean(nodeB, doc);
              case "!=":
              case "==":
              case "<":
              case ">":
              case "<=":
              case ">=":
                throw `ParamInterpreter cannot parse '${node.detail}' operator`;
              default:
                throw `ParamInterpreter does not recognize '${node.detail}' operator`;
            }
          }
        } else if (node.kind === "ConditionalOperator") {
          const condition = node.children?.[0];
          const expr1 = node.children?.[1];
          const expr2 = node.children?.[2];
          if (condition != null && expr1 != null && expr2 != null) {
            return this.boolean(condition, doc)
              ? this.boolean(expr1, doc)
              : this.boolean(expr2, doc);
          }
        }
      }
      throw "could not parse boolean";
    },
    float: function (
      this: ParameterInterpreter,
      root: ASTNode,
      doc: vscode.TextDocument,
    ): number {
      const generator = ASTTranslator.traverseAST(root);
      for (const node of generator) {
        if (node.kind === "FloatingLiteral") {
          return new Number(node.detail?.replace(/[lfLF]/, "")).valueOf();
        } else if (node.kind === "UnaryOperator") {
          const next = generator.next().value;
          if (next != null) {
            switch (node.detail) {
              case "+":
                return +this.float(next, doc);
              case "-":
                return -this.float(next, doc);
              default:
                throw `ParamInterpreter does not recognize '${node.detail}' operator`;
            }
          }
        } else if (node.kind === "ImplicitCast") {
          // node.detail === "IntegralCast"?
          if (!node.detail?.endsWith("ToFloating")) continue;
          const next = generator.next().value;
          if (next != null) {
            switch (node.detail?.split("ToFloating")[0]) {
              case "Integral":
                return this.int(next, doc);
              case "Boolean":
                return new Number(this.boolean(next, doc)).valueOf();
              default:
                throw `ParamInterpreter does not recognize '${node.detail}' Cast`;
            }
          }
        } else if (node.kind === "BinaryOperator") {
          const nodeA = node.children?.[0];
          const nodeB = node.children?.[1];
          if (nodeA != null && nodeB != null) {
            switch (node.detail) {
              case "+":
                return this.float(nodeA, doc) + this.float(nodeB, doc);
              case "-":
                return this.float(nodeA, doc) - this.float(nodeB, doc);
              case "*":
                return this.float(nodeA, doc) * this.float(nodeB, doc);
              case "/":
                return this.float(nodeA, doc) / this.float(nodeB, doc);
              case ",":
                return this.float(nodeB, doc);
              default:
                throw `ParamInterpreter does not recognize '${node.detail}' operator`;
            }
          }
        } else if (node.kind === "ConditionalOperator") {
          const condition = node.children?.[0];
          const expr1 = node.children?.[1];
          const expr2 = node.children?.[2];
          if (condition != null && expr1 != null && expr2 != null) {
            return this.boolean(condition, doc)
              ? this.float(expr1, doc)
              : this.float(expr2, doc);
          }
        }
      }
      throw "could not parse floating";
    },
    int: function (
      this: ParameterInterpreter,
      root: ASTNode,
      doc: vscode.TextDocument,
    ): number {
      const generator = ASTTranslator.traverseAST(root);
      for (const node of generator) {
        if (node.kind === "IntegerLiteral") {
          return new Number(node.detail?.replace(/[lL]/, "")).valueOf();
        } else if (node.kind === "UnaryOperator") {
          const next = generator.next().value;
          if (next != null) {
            switch (node.detail) {
              case "~":
                return ~this.int(next, doc);
              case "+":
                return +this.int(next, doc);
              case "-":
                return -this.int(next, doc);
              default:
                throw `ParamInterpreter does not recognize '${node.detail}' operator`;
            }
          }
        } else if (node.kind === "ImplicitCast") {
          // node.detail === "IntegralCast"?
          if (!node.detail?.endsWith("ToIntegral")) continue;
          const next = generator.next().value;
          if (next != null) {
            switch (node.detail?.split("ToIntegral")[0]) {
              case "Floating":
                return Math.round(this.float(next, doc));
              case "Boolean":
                return new Number(this.boolean(next, doc)).valueOf();
              default:
                throw `ParamInterpreter does not recognize '${node.detail}' Cast`;
            }
          }
        } else if (node.kind === "BinaryOperator") {
          const nodeA = node.children?.[0];
          const nodeB = node.children?.[1];
          if (nodeA != null && nodeB != null) {
            switch (node.detail) {
              case "+":
                return this.int(nodeA, doc) + this.int(nodeB, doc);
              case "-":
                return this.int(nodeA, doc) - this.int(nodeB, doc);
              case "*":
                return this.int(nodeA, doc) * this.int(nodeB, doc);
              case "/":
                // rounds towards 0, not -Infinity
                return (this.int(nodeA, doc) / this.int(nodeB, doc)) | 0;
              case "%":
                return this.int(nodeA, doc) % this.int(nodeB, doc);
              case "<<":
                return this.int(nodeA, doc) << +this.int(nodeB, doc);
              case ">>":
                return +this.int(nodeA, doc) >> +this.int(nodeB, doc);
              case "&":
                return this.int(nodeA, doc) & this.int(nodeB, doc);
              case "|":
                return this.int(nodeA, doc) | this.int(nodeB, doc);
              case "^":
                return this.int(nodeA, doc) ^ this.int(nodeB, doc);
              case ",":
                return this.int(nodeB, doc);
              default:
                throw `ParamInterpreter does not recognize '${node.detail}' operator`;
            }
          }
        } else if (node.kind === "ConditionalOperator") {
          const condition = node.children?.[0];
          const expr1 = node.children?.[1];
          const expr2 = node.children?.[2];
          if (condition != null && expr1 != null && expr2 != null) {
            return this.boolean(condition, doc)
              ? this.int(expr1, doc)
              : this.int(expr2, doc);
          }
        }
      }
      throw "could not parse integer";
    },
  };

  private static convertCallExprToAction(
    call: CallExprASTNode,
    doc: vscode.TextDocument,
  ): ActionWithRanges | null {
    const declRef = call.children[0].children?.[0];
    if (
      declRef == null ||
      !declRef.children?.[0]?.detail?.startsWith("auton") ||
      !declRef.detail ||
      call.range == null
    ) {
      return null;
    }

    const snakeCaseCallName = declRef.detail.replaceAll(
      /[A-Z]/g,
      (match) => `_${match.toLowerCase()}`,
    ) as Action["type"];

    if (!(snakeCaseCallName in this.ActionDescriptor)) return null;

    const params: { [k: string]: any } = {};
    const paramRanges: { [k: string]: vscode.Range } = {};
    const actDesc = Object.entries(this.ActionDescriptor[snakeCaseCallName]);

    for (let i = 1; i < call.children.length; i++) {
      const paramNode = call.children[i];
      const paramType = actDesc[i - 1][1];
      const paramName = actDesc[i - 1][0];
      if (paramNode.kind !== "CXXDefaultArg" && paramNode.range !== undefined) {
        try {
          params[paramName] = this.ParamInterpreter[paramType](paramNode, doc);
          paramRanges[paramName] = paramNode.range;
        } catch (e) {
          const err = `Failed to parse ${paramType} from property ${paramName} of Action ${snakeCaseCallName}: ${e}`;
          vscode.window.showErrorMessage(err, "Show Me").then(() =>
            vscode.commands.executeCommand("vscode.open", doc.uri, {
              preserveFocus: true,
              selection: paramNode.range,
            }),
          );
          console.error(err);
        }
      }
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
    doc: vscode.TextDocument,
  ): Auton<ActionWithRanges> {
    const acts = this.getCallExprs(funcNode)
      .map((call) => this.convertCallExprToAction(call, doc))
      .filter(
        (act): act is ActionWithRanges => act !== null,
      ) as AutonData<ActionWithRanges>;
    return new Auton<ActionWithRanges>(acts[0], acts.slice(1));
  }

  public static async getAutons(
    doc: vscode.TextDocument,
  ): Promise<Array<Omit<AutonListData<ActionWithRanges>, "uri">>> {
    return (await this.getFunctions(doc.uri))
      .filter(
        (
          funcNode,
        ): funcNode is FunctionDecASTNode &
          Required<Pick<FunctionDecASTNode, "detail" | "range">> =>
          funcNode.detail !== undefined && funcNode.range !== undefined,
      )
      .map((funcNode): Omit<AutonListData<ActionWithRanges>, "uri"> => {
        return {
          range: funcNode.range,
          funcName: funcNode.detail,
          auton: this.functionToAuton(funcNode, doc),
        };
      });
  }

  static applyAutonModifyEdit<T extends Action["type"] = Action["type"]>(
    mod: AutonEdit.Result.Modify<ActionWithRanges<T>>,
    act: ActionWithRanges<T>,
    uri: vscode.Uri,
    wEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit(),
  ): vscode.WorkspaceEdit {
    const newParams = mod.newProperties.params;
    if (newParams === undefined) return wEdit;

    for (const newParam in newParams) {
      const newParamVal = newParams[newParam];
      const newParamRange =
        act.paramRanges[newParam as keyof typeof act.paramRanges];
      if (newParamRange === undefined) continue;
      switch (typeof newParamVal) {
        case "string":
          wEdit.replace(uri, newParamRange, newParamVal);
          break;
        case "boolean":
          wEdit.replace(
            uri,
            newParamRange,
            new Boolean(newParamVal).toString(),
          );
          break;
        case "number":
          wEdit.replace(uri, newParamRange, new Number(newParamVal).toString());
          break;
      }
    }
    return wEdit;
  }
}
type ParameterInterpreter = {
  [k in NonNullable<ValuesOfObject<ValuesOfObject<ActionDescriptorType>>>]: (
    this: ParameterInterpreter,
    node: ASTNode,
    doc: vscode.TextDocument,
  ) => ActionParameterStringToType<k>;
};
type ValuesOfObject<Obj extends object> = Obj extends any
  ? Obj[keyof Obj]
  : never;
type ActionWithType<A extends Action, T extends A["type"]> = Extract<
  A,
  { type: T }
>;
type ActionTypeToParamsMap = {
  [k in Action["type"]]: ActionWithType<Action, k>["params"];
};
type ActionParameterTypeToString<
  ParamType extends NonNullable<ValuesOfObject<Action["params"]>>,
> = ParamType extends string
  ? "string"
  : ParamType extends boolean
  ? "boolean"
  : ParamType extends number
  ? "int" | "float"
  : never;
type ActionParameterStringToType<
  ParamString extends ActionParameterTypeToString<
    NonNullable<ValuesOfObject<Action["params"]>>
  >,
> = ParamString extends "string"
  ? string
  : ParamString extends "boolean"
  ? boolean
  : ParamString extends "int" | "float"
  ? number
  : never;

type ActionDescriptorType = {
  [k in Action["type"]]: {
    [p in keyof ActionTypeToParamsMap[k]]-?: ActionParameterTypeToString<
      // @ts-expect-error It works somehow, idk
      NonNullable<ActionTypeToParamsMap[k][p]>
    >;
  };
};
