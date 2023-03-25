import { Action, ActionTypeGuards, SetPose } from "../common/action";
import Auton, { AutonData, AutonEdit } from "../common/auton";
import * as vscode from "vscode";

/** responsible for translating cpp text into an auton */
export namespace Translation {
  /** describes an action and its associated offsets in a text document */
  export type ActionWithOffset = Action & {
    readonly offset: number;
    readonly endOffset: number;
    readonly text: string;
    readonly groupIndices: { [k: string]: [number, number] };
  };
  /** describes an action and its associated range in a text document */
  export type CppAction = Action &
    ActionWithOffset & {
      readonly range: vscode.Range;
    };

  export namespace CppToAuton {
    /**
     * @note if pattern matching is exceedingly slow, then the {@link CppToAuton.PATTERNS.COMPILER_IGNORES COMPILER_IGNORES's} may be the culprit
     * @todo modify to not recognize commented actions
     */
    export namespace PATTERNS {
      export type PatternComposition = (
        | string
        | {
            str: string;
            separator?: boolean;
            indent?: boolean;
            control?: boolean;
          }
      )[];
      export type Pattern = RegExp & {
        composition: PatternComposition;
      };
      export type Param = (
        | { string: string }
        | { bool: string }
        | { int: string }
        | { float: string }
      ) & { opt?: boolean };
      export const FLOAT: RegExp = /(?:\d*\.)?\d+/;
      export const INT: RegExp = /\d+/;
      export const BOOLEAN: RegExp = /true|false|0|1/;
      export const STRING: RegExp = /".*"/;
      export const LINE_COMMENT: RegExp = /\/\/.*$/;

      export const BLOCK_COMMENT: RegExp = /\/\*[\w\W]*?\*\//;
      /* matches spaces and newlines */
      export const SPACE_AND_LINE: RegExp = /[\s\n]+/;
      /** matches text that is ignored by the compiler */
      export const COMPILER_IGNORES: RegExp = new RegExp(
        `(?:${LINE_COMMENT.source}|${BLOCK_COMMENT.source}|${SPACE_AND_LINE.source})*`
      );
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type float with a named capturing group
       */
      export function float(n: string): string {
        return `(?<float_${n}>${FLOAT.source})`;
      }
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type int with a named capturing group
       */
      export function int(n: string): string {
        return `(?<int_${n}>${INT.source})`;
      }
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type bool with a named capturing group
       */
      export function bool(n: string): string {
        return `(?<bool_${n}>${BOOLEAN.source})`;
      }
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type string with a named capturing group
       */
      export function string(n: string): string {
        return `(?<string_${n}>${STRING.source})`;
      }
      /**
       * @returns separator surrounded by "[\s\n]*"'s
       */
      export function s(separator: string): string {
        return COMPILER_IGNORES.source + separator + COMPILER_IGNORES.source;
      }
      /**
       * @param content will be the content of the capturing group
       * @returns an optional non-capturing group containing {@link content}
       */
      export function opt(content: string): string {
        return `(?:${content})?`;
      }
      /**
       * @param funcName function name of function to match
       * @param params element keys specify type and value specifies name of capturing group
       * @param param.opt whether the parameter is optional
       * @returns a regex that matches a cpp function in auton with the specified name and params
       * @warn will match a function even if it is within a block comment
       */
      export function func(funcName: string, params: Param[]): Pattern {
        let optStartIndex: number = params.length;
        let composition: PatternComposition = [
          {
            str: `(?<=^(?:${SPACE_AND_LINE.source}|${BLOCK_COMMENT.source}))`,
            indent: true,
          },
          "auton",
          { str: "::", separator: true },
          funcName,
          { str: "\\(", separator: true },
          params
            .sort((a, b) => +(a.opt ?? 0) - +(b.opt ?? 0))
            .map((param, i) => {
              if (param.opt) optStartIndex = Math.min(optStartIndex, i);
              let out = "";
              if ("string" in param) out = string(param.string);
              else if ("bool" in param) out = bool(param.bool);
              else if ("int" in param) out = int(param.int);
              else if ("float" in param) out = float(param.float);
              return [
                param.opt
                  ? {
                      str: "(?:",
                      control: true,
                    }
                  : "",
                i > 0 ? { str: ",", separator: true } : "",
                out,
              ];
            }),
          new Array(params.length - optStartIndex).fill({
            str: ")?",
            control: true,
          }),
          { str: "\\)", separator: true },
          ";",
        ].flat(20 /* completely flatten */);
        return {
          ...RegExp.prototype,
          ...new RegExp(
            composition
              .map((e): string =>
                typeof e == "object"
                  ? e.separator === true
                    ? s(e.str)
                    : e.str
                  : e
              )
              .join(""),
            "dgm"
          ),
          composition,
        } as Pattern;
      }
      export const SET_POSE: Pattern = func("setPose", [
        { float: "x" },
        { float: "y" },
        { float: "theta" },
        { bool: "radians", opt: true },
      ]);
      export const TURN_TO: Pattern = func("turnTo", [
        { float: "x" },
        { float: "y" },
        { int: "timeout" },
        { bool: "reversed", opt: true },
        { float: "maxSpeed", opt: true },
        { bool: "log", opt: true },
      ]);
      export const MOVE_TO: Pattern = func("moveTo", [
        { float: "x" },
        { float: "y" },
        { int: "timeout" },
        { float: "maxSpeed", opt: true },
        { bool: "log", opt: true },
      ]);
      export const FOLLOW: Pattern = func("follow", [
        { string: "filePath" },
        { int: "timeout" },
        { float: "lookahead" },
        { float: "maxSpeed", opt: true },
        { bool: "log", opt: true },
      ]);
      export const WAIT: Pattern = func("wait", [{ int: "milliseconds" }]);

      // snippet:
      // "func": {
      // 	"prefix": "func",
      // 	"body": "static $1: Pattern = func(\"$2\", []);\n$0"
      // }
      export const ROLLER: Pattern = func("roller", []);
      export const SHOOT: Pattern = func("shoot", []);
      export const PISTON_SHOOT: Pattern = func("pistonShoot", []);
      export const INTAKE: Pattern = func("intake", []);
      export const STOP_INTAKE: Pattern = func("stopIntake", []);
      export const EXPAND: Pattern = func("expand", []);

      export const PATTERNS: { name: string; pattern: Pattern }[] = [
        { name: "set_pose", pattern: SET_POSE },
        { name: "move_to", pattern: MOVE_TO },
        { name: "turn_to", pattern: TURN_TO },
        { name: "follow", pattern: FOLLOW },
        { name: "wait", pattern: WAIT },
        { name: "roller", pattern: ROLLER },
        { name: "shoot", pattern: SHOOT },
        { name: "piston_shoot", pattern: PISTON_SHOOT },
        { name: "intake", pattern: INTAKE },
        { name: "stop_intake", pattern: STOP_INTAKE },
        { name: "expand", pattern: EXPAND },
      ];
    }

    export function translateText(text: string): ActionWithOffset[] {
      return PATTERNS.PATTERNS.flatMap((pattern) =>
        Array.from(text.matchAll(pattern.pattern)).map((match) => {
          return { action: pattern.name, match };
        })
      )
        .sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0))
        .map(({ action, match }): ActionWithOffset => {
          const index: number = match.index ?? 0;
          return {
            // @ts-ignore
            type: action,
            params: match.groups
              ? Object.fromEntries(
                  Object.entries(match.groups).flatMap(
                    ([groupName, value]): [
                      string,
                      number | string | boolean
                    ][] => {
                      if (value === undefined || groupName.startsWith("_"))
                        return [];
                      const type = groupName.split("_")[0] as
                        | "bool"
                        | "int"
                        | "string"
                        | "float";
                      const name = groupName.split("_").slice(1).join("");
                      let trueValue: boolean | string | number;
                      switch (type) {
                        case "bool":
                          trueValue = Boolean(value);
                        case "string":
                          trueValue = String(value);
                        case "int":
                        case "float":
                          trueValue = Number(value);
                        default:
                          trueValue = value as never;
                      }
                      return [[name, trueValue]];
                    }
                  )
                )
              : {},
            offset: index,
            endOffset: index + match[0].length,
            text: match[0],
            groupIndices: match.indices?.groups ?? {},
          };
        })
        .filter((e): e is ActionWithOffset => ActionTypeGuards.isAction(e));
    }
    export function translateDoc(doc: vscode.TextDocument): Auton<CppAction> {
      let actionArr: CppAction[] = offsetToRange(
        translateText(doc.getText()),
        doc
      );

      // @todo should instead warn user
      actionArr.splice(
        0,
        actionArr.findIndex((act): act is CppAction & SetPose =>
          ActionTypeGuards.isSetPose(act)
        )
      );

      return new Auton<CppAction>(
        actionArr[0] as SetPose & CppAction,
        actionArr.slice(1)
      );
    }
    /**
     * @param subStr a substring of a document
     * @param offset the offset of the substring within the document
     * @returns translation of the substring offset relative to the entire document
     */
    export function translateSubString(
      subStr: string,
      offset: number
    ): ActionWithOffset[] {
      return translateText(subStr).map((action) => {
        return {
          ...action,
          offset: action.offset + offset,
          endOffset: action.endOffset + offset,
        };
      });
    }
    /**
     * transforms an array of {@link ActionWithOffset} to an array of {@link CppAction} using a {@link vscode.TextDocument text document}
     * @param arr array to be transformed
     * @param doc informs function how to transform the offsets
     * @returns transformed array
     */
    export function offsetToRange(
      arr: ActionWithOffset[],
      doc: vscode.TextDocument
    ): CppAction[] {
      return arr.map((act) => {
        return {
          ...act,
          range: new vscode.Range(
            doc.positionAt(act.offset),
            doc.positionAt(act.endOffset)
          ),
        };
      });
    }
    /** @returns whether range1 and range2 overlap / intersect  */
    function offsetOverlap(
      range1: { offset: number; endOffset: number },
      range2: { offset: number; endOffset: number }
    ): boolean {
      return (
        Math.max(range1.offset, range2.offset) <
        Math.min(range1.endOffset, range2.endOffset)
      );
    }

    /**
     * @returns edits made to auton by the change (Will modify auton!)
     */
    export function changeAuton(
      auton: Auton<ActionWithOffset>,
      change: vscode.TextDocumentChangeEvent
    ): AutonEdit.AutonEdit[] {
      let edits: AutonEdit.AutonEdit<ActionWithOffset>[] = [];

      for (const contentChange of change.contentChanges) {
        const changeOffset: { offset: number; endOffset: number } = {
          offset: contentChange.rangeOffset,
          endOffset: contentChange.rangeOffset + contentChange.rangeLength,
        };
        // -1 when there is no overlap with any action
        const firstAffectedIndex: number = auton.auton.findIndex((action) =>
          // action.range.intersection()
          // contentChange.rangeOffset <= action.offset
          offsetOverlap(action, changeOffset)
        );
        // -1 when there is no overlap with any action
        const lastAffectedIndex: number = auton.auton.findLastIndex((action) =>
          offsetOverlap(action, changeOffset)
        );
        // undefined when there is no overlap with any action
        const firstAffectedAction: ActionWithOffset | undefined =
          auton.auton[firstAffectedIndex];
        // undefined when there is no overlap with any action
        const lastAffectedAction: ActionWithOffset | undefined =
          auton.auton[lastAffectedIndex];

        // offset representing start of affectedText
        const affectedStart: number = firstAffectedAction
          ? Math.min(firstAffectedAction.offset, changeOffset.offset)
          : changeOffset.offset;
        // offset representing end of affectedText
        const affectedEnd: number = lastAffectedAction
          ? Math.max(lastAffectedAction.endOffset, changeOffset.endOffset)
          : changeOffset.endOffset;

        let affectedText: string = contentChange.text;

        // adds text that may be missing from contentChange.text to affectedText
        if (affectedStart !== changeOffset.offset)
          affectedText =
            firstAffectedAction!.text.slice(
              0,
              changeOffset.offset - firstAffectedAction!.offset
            ) + affectedText;
        if (affectedEnd !== changeOffset.endOffset)
          affectedText += lastAffectedAction!.text.slice(
            changeOffset.endOffset - lastAffectedAction!.endOffset
          );

        const newActions: ActionWithOffset[] = translateSubString(
          affectedText,
          affectedStart
        );
        const edit: AutonEdit.Replace<ActionWithOffset> = {
          action: newActions,
          count: lastAffectedIndex - firstAffectedIndex,
          index: firstAffectedAction
            ? firstAffectedIndex
            : auton.auton.findLastIndex(
                (act) => act.offset < changeOffset.offset
              ) + 1,
        };
        // adjust offsets of all actions after edit
        const offsetAdjustment: number =
          contentChange.text.length - contentChange.rangeLength;
        for (let i = edit.index + edit.count; i < auton.auton.length; i++) {
          auton.auton[i] = {
            ...auton.auton[i],
            offset: auton.auton[i].offset + offsetAdjustment,
          };
        }

        // add to output array
        edits.push(edit);
        // perform edit
        auton.makeEdit(edit);
      }
      return edits;
    }
  }
  export namespace AutonToCpp {
    /**
     * translates an auton edit into its textual {@link vscode.WorkspaceEdit edit}
     */
    export function translateAutonEdit(
      auton: Auton<ActionWithOffset>,
      doc: vscode.TextDocument,
      edit: AutonEdit.AutonEdit<ActionWithOffset>,
      workspaceEdit?: vscode.WorkspaceEdit
    ): vscode.WorkspaceEdit {
      return "" as unknown as vscode.WorkspaceEdit;
    }
    const PARAM_PATTERN: RegExp =
      /\(\?\<(?<type>int|string|float|bool)_(?<paramName>\w+)\>.+\)/;
    export function generateTextForAction(action: Action, indent?: string): string {
      return CppToAuton.PATTERNS.PATTERNS.find((e) => e.name === action.type)!
        .pattern.composition.map((e): string => {
          let str: string;
          if (typeof e === "object") {
            if (e.separator === true)
              return e.separator + (e.str === "," ? " " : "");
            else if (e.control === true) return "";
            else if (e.indent === true) return indent ?? "\9";
            str = e.str;
          } else {
            str = e;
          }
          if (PARAM_PATTERN.test(str)) {
            const groups = PARAM_PATTERN.exec(str)!.groups!;
            const name: string = groups.paramName;
            const type: string = groups.paramName;
            if (name in action.params)
              switch (type) {
                case "int":
                case "float":
                  return Number(action.params[name]).toString();
                case "bool":
                  return Boolean(action.params[name]).toString();
                case "string":
                  return action.params[name] as string;
              }
          }
          return str;
        })
        .join("");
    }
  }
}
