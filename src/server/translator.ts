import { Action, ActionTypeGuards, SetPose } from "../common/action";
import Auton, { AutonData, AutonEdit } from "../common/auton";
import * as vscode from "vscode";

/** responsible for translating cpp text into an auton */
export namespace Translation {
  /** describes an action and its associated offsets in a text document */
  type ActionWithOffset = Action & {
    readonly offset: number;
    readonly endOffset: number;
    readonly text: string;
  };
  /** describes an action and its associated range in a text document */
  type CppAction = Action &
    ActionWithOffset & {
      readonly range: vscode.Range;
    };

  export class CppToAuton {
    /**
     * @note if pattern matching is exceedingly slow, then the {@link CppToAuton.PATTERNS.COMPILER_IGNORES COMPILER_IGNORES's} may be the culprit
     * @todo modify to not recognize commented actions
     */
    static readonly PATTERNS = class Patterns {
      static FLOAT: RegExp = /(?:\d*\.)?\d+/;
      static BOOLEAN: RegExp = /true|false|0|1/;
      static STRING: RegExp = /".*"/;
      static LINE_COMMENT: RegExp = /\/\/.*$/;

      static BLOCK_COMMENT: RegExp = /\/\*[\w\W]*?\*\//;
      /* matches spaces and newlines */
      static SPACE_AND_LINE: RegExp = /[\s\n]+/;
      /** matches text that is ignored by the compiler */
      static COMPILER_IGNORES: RegExp = new RegExp(
        `(?:${this.LINE_COMMENT.source}|${this.BLOCK_COMMENT.source}|${this.SPACE_AND_LINE.source})*`
      );
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type float with a named capturing group
       */
      protected static float(n: string): string {
        return `(?<float_${n}>${Patterns.FLOAT.source})`;
      }
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type int with a named capturing group
       */
      protected static int(n: string): string {
        return `(?<int_${n}>\\d+)`;
      }
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type bool with a named capturing group
       */
      protected static bool(n: string): string {
        return `(?<bool_${n}>${Patterns.BOOLEAN.source})`;
      }
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type string with a named capturing group
       */
      protected static string(n: string): string {
        return `(?<string_${n}>${Patterns.STRING.source})`;
      }
      /**
       * @returns separator surrounded by "[\s\n]*"'s
       */
      protected static s(separator: string): string {
        return (
          this.COMPILER_IGNORES.source +
          separator +
          this.COMPILER_IGNORES.source
        );
      }
      /**
       * @param content will be the content of the capturing group
       * @returns an optional non-capturing group containing {@link content}
       */
      protected static opt(content: string): string {
        return `(?:${content})?`;
      }
      /**
       * @param funcName function name of function to match
       * @param params element keys specify type and value specifies name of capturing group
       * @param param.opt whether the parameter is optional
       * @returns a regex that matches a cpp function in auton with the specified name and params
       * @warn will match a function even if it is within a block comment
       */
      protected static func(
        funcName: string,
        params: ((
          | { string: string }
          | { bool: string }
          | { int: string }
          | { float: string }
        ) & { opt?: boolean })[]
      ): RegExp {
        let optStartIndex: number = params.length;
        return new RegExp(
          `(?<=^(?:${this.SPACE_AND_LINE.source}|${this.BLOCK_COMMENT.source}))` +
            "auton" +
            this.s("::") +
            funcName +
            this.s("\\(") +
            params
              .sort((a, b) => +(a.opt ?? 0) - +(b.opt ?? 0))
              .map((param, i) => {
                if (param.opt) optStartIndex = Math.min(optStartIndex, i);
                let out = "";
                if ("string" in param) out = this.string(param.string);
                else if ("bool" in param) out = this.bool(param.bool);
                else if ("int" in param) out = this.int(param.int);
                else if ("float" in param) out = this.float(param.float);
                return (
                  (param.opt ? "(?:" : "") + (i > 0 ? this.s(",") : "") + out
                );
              })
              .join("") +
            new Array(params.length - optStartIndex).fill(")?").join("") +
            this.s("\\)") +
            ";",
          "gm"
        );
      }
      static SET_POSE: RegExp = this.func("setPose", [
        { float: "x" },
        { float: "y" },
        { float: "theta" },
        { bool: "radians", opt: true },
      ]);
      static TURN_TO: RegExp = this.func("turnTo", [
        { float: "x" },
        { float: "y" },
        { int: "timeout" },
        { bool: "reversed", opt: true },
        { float: "maxSpeed", opt: true },
        { bool: "log", opt: true },
      ]);
      static MOVE_TO: RegExp = this.func("moveTo", [
        { float: "x" },
        { float: "y" },
        { int: "timeout" },
        { float: "maxSpeed", opt: true },
        { bool: "log", opt: true },
      ]);
      static FOLLOW: RegExp = this.func("follow", [
        { string: "filePath" },
        { int: "timeout" },
        { float: "lookahead" },
        { float: "maxSpeed", opt: true },
        { bool: "log", opt: true },
      ]);
      static WAIT: RegExp = this.func("wait", [{ int: "milliseconds" }]);

      // snippet:
      // "func": {
      // 	"prefix": "func",
      // 	"body": "static $1: RegExp = this.func(\"$2\", []);\n$0"
      // }
      static ROLLER: RegExp = this.func("roller", []);
      static SHOOT: RegExp = this.func("shoot", []);
      static PISTON_SHOOT: RegExp = this.func("pistonShoot", []);
      static INTAKE: RegExp = this.func("intake", []);
      static STOP_INTAKE: RegExp = this.func("stopIntake", []);
      static EXPAND: RegExp = this.func("expand", []);
      static PATTERNS: { name: string; regex: RegExp }[] = [
        { name: "set_pose", regex: this.SET_POSE },
        { name: "move_to", regex: this.MOVE_TO },
        { name: "turn_to", regex: this.TURN_TO },
        { name: "follow", regex: this.FOLLOW },
        { name: "wait", regex: this.WAIT },
        { name: "roller", regex: this.ROLLER },
        { name: "shoot", regex: this.SHOOT },
        { name: "piston_shoot", regex: this.PISTON_SHOOT },
        { name: "intake", regex: this.INTAKE },
        { name: "stop_intake", regex: this.STOP_INTAKE },
        { name: "expand", regex: this.EXPAND },
      ];
    };

    public static translateText(text: string): ActionWithOffset[] {
      return this.PATTERNS.PATTERNS.flatMap((pattern) =>
        Array.from(text.matchAll(pattern.regex)).map((match) => {
          return { action: pattern.name, match };
        })
      )
        .sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0))
        .map(({ action, match }) => {
          const index: number = match.index ?? 0;
          return {
            type: action,
            params:
              match.groups &&
              Object.fromEntries(
                Object.entries(match.groups).flatMap(
                  ([groupName, value]): [
                    string,
                    number | string | boolean
                  ][] => {
                    if (value === undefined) return [];
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
              ),
            offset: index,
            endOffset: index + match[0].length,
            text: match[0],
          };
        })
        .filter((e): e is ActionWithOffset => ActionTypeGuards.isAction(e));
    }
    public static translateDoc(doc: vscode.TextDocument): Auton<CppAction> {
      let actionArr: CppAction[] = this.offsetToRange(
        this.translateText(doc.getText()),
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
        actionArr.slice(0, 1)
      );
    }
    /**
     * @param subStr a substring of a document
     * @param offset the offset of the substring within the document
     * @returns translation of the substring offset relative to the entire document
     */
    static translateSubString(
      subStr: string,
      offset: number
    ): ActionWithOffset[] {
      return this.translateText(subStr).map((action) => {
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
    static offsetToRange(
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
    protected static offsetOverlap(
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
    static changeAuton(
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
          this.offsetOverlap(action, changeOffset)
        );
        // -1 when there is no overlap with any action
        const lastAffectedIndex: number = auton.auton.findLastIndex((action) =>
          this.offsetOverlap(action, changeOffset)
        );
        // undefined when there is no overlap with any action
        const firstAffectedAction: ActionWithOffset | undefined =
          auton.auton[firstAffectedIndex];
        // undefined when there is no overlap with any action
        const lastAffectedAction: ActionWithOffset | undefined =
          auton.auton[lastAffectedIndex];

        // const affectedRange: vscode.Range = new vscode.Range(
        //   firstAffectedAction.range.start,
        //   lastAffectedAction.range.end
        // ).union(contentChange.range);

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

        const newActions: ActionWithOffset[] = this.translateSubString(
          affectedText,
          affectedStart
        );
        const edit: Required<AutonEdit.Replace<ActionWithOffset>> = {
          type: "replace",
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
  export class AutonToCpp {}
}
