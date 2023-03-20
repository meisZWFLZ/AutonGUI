import { Action, ActionTypeGuards, SetPose } from "../common/action";
import Auton from "../common/auton";
import * as vscode from "vscode";

/** responsible for translating cpp text into an auton */
export namespace Translation {
  /** describes an action and its associated range in the text document */
  type CppAction = Action & { readonly range: vscode.Range };
  export class CppToAuton {
    /**
     * @note if pattern matching is exceedingly slow, then the {@link CppToAuton.PATTERNS.COMPILER_IGNORES COMPILER_IGNORES's} may be the culprit
     * @todo modify to not recognize commented actions
     */
    static readonly PATTERNS = class Patterns {
      static FLOAT: RegExp = /(?:\d*\.)?\d+/;
      static BOOLEAN: RegExp = /true|false|0|1/;
      static STRING: RegExp = /".*"/;
      static LINE_COMMENT: RegExp = /\/\/.*/;

      static BLOCK_COMMENT: RegExp = /\/\*[\w\W]*?\*\//;
      /* matches spaces and newlines */
      static SPACE_AND_LINE: RegExp = /[\s\n]*/;
      /** matches text that is ignored by the compiler */
      static COMPILER_IGNORES: RegExp = new RegExp(
        `${this.LINE_COMMENT.source}|${this.BLOCK_COMMENT.source}|${this.SPACE_AND_LINE.source}`
      );
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type float with a named capturing group
       */
      protected static float(n: string): string {
        return `(?<${n}>${Patterns.FLOAT.source})`;
      }
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type int with a named capturing group
       */
      protected static int(n: string): string {
        return `(?<${n}>\\d+)`;
      }
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type bool with a named capturing group
       */
      protected static bool(n: string): string {
        return `(?<${n}>${Patterns.BOOLEAN.source})`;
      }
      /**
       * @param {string} n name of capturing group
       * @returns a string that matches a param with type string with a named capturing group
       */
      protected static string(n: string): string {
        return `(?<${n}>${Patterns.STRING.source})`;
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
       *
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
            ";"
        );
      }
      // static SET_POSE: RegExp = new RegExp(
      //   `auton${this.s("::")}setPose${this.s("\\(")}${this.float("x")}` +
      //     `${this.s(",")}${this.float("x")}${this.s(",")}` +
      //     `${this.float("x")}${this.opt(
      //       `${this.s(",")}${this.bool("radians")}`
      //     )}${this.s("\\)")};`
      // );
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
        { float: "y" },
        { int: "timeout" },
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
    static translate(doc: vscode.TextDocument): Auton {
      const cpp = doc.getText();
      const actionArr = this.PATTERNS.PATTERNS.flatMap((pattern) =>
        Array.from(cpp.matchAll(pattern.regex)).map((match) => {
          return { action: pattern.name, match };
        })
      )
        .sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0))
        .map(({ action, match }) => {
          const index: number = match.index ?? 0;
          return {
            type: action,
            ...match.groups,
            range: new vscode.Range(
              doc.positionAt(index),
              doc.positionAt(index + match[0].length)
            ),
          };
        })
        .filter((e): e is CppAction => ActionTypeGuards.isAction(e));

      // should just warn user
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
  }
  export class AutonToCpp {}
}
