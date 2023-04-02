import { randomUUID } from "crypto";
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
      export type Pattern = {
        regex: RegExp;
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
      export const SPACE_AND_LINE: RegExp = /[\s\n]*?/;
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
          regex: new RegExp(
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
        };
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
      return PATTERNS.PATTERNS.flatMap(
        ({ pattern: { regex: pattern }, name }) =>
          Array.from(text.matchAll(pattern)).map((match) => {
            return { action: name, match };
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
            uuid: randomUUID(),
            offset: index,
            endOffset: index + match[0].length,
            text: match[0],
            groupIndices: match.indices?.groups ?? {},
          };
        })
        .filter((e): e is ActionWithOffset => ActionTypeGuards.isAction(e));
    }
    export function translateDoc(doc: vscode.TextDocument): Auton<CppAction> {
      let actionArr: CppAction[] = upgradeOffsetActionToCpp(
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
    export function upgradeOffsetActionToCpp(
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
        Math.max(range1.offset, range2.offset) <=
        Math.min(range1.endOffset, range2.endOffset)
      );
    }

    /**
     * modifies auton as specified by the document change event
     * 
     * @param auton modified by change
     * @param change changes made to document
     * @param oldDocText text of document before change
     * 
     * @returns edits made to auton by the change
     */
    export function changeAuton(
      auton: Auton<ActionWithOffset>,
      change: vscode.TextDocumentChangeEvent,
      oldDocText: string
    ): AutonEdit.AutonEdit[] {
      let edits: AutonEdit.AutonEdit<ActionWithOffset>[] = [];
      let docText: string = Array.from(oldDocText).join("");

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
          : Math.min(
              auton.auton.findLast((act) => act.endOffset < changeOffset.offset)
                ?.endOffset ?? 0,
              changeOffset.offset
            );
        // offset representing end of affectedText
        const affectedEnd: number = lastAffectedAction
          ? Math.max(lastAffectedAction.endOffset, changeOffset.endOffset)
          : Math.max(
              auton.auton.find((act) => act.offset > changeOffset.endOffset)
                ?.offset ?? Infinity,
              changeOffset.endOffset
            );

        let affectedText: string = contentChange.text;

        // adds text that may be missing from contentChange.text to affectedText
        if (lastAffectedIndex === -1 && firstAffectedIndex === -1) {
          const actionBeforeChangeEndOffset: number =
            auton.auton.findLast((act) => act.endOffset < changeOffset.offset)
              ?.endOffset ?? 0;
          const actionAfterChangeStartOffset: number | undefined =
            auton.auton.find(
              (act) => act.offset > changeOffset.endOffset
            )?.offset;
          affectedText =
            docText.slice(affectedStart, changeOffset.offset) +
            affectedText +
            docText.slice(changeOffset.endOffset, affectedEnd);
        } else {
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
        }

        const newActions: ActionWithOffset[] = translateSubString(
          affectedText,
          affectedStart
        );
        const edit: AutonEdit.Replace<ActionWithOffset> = {
          action: newActions,
          count:
            lastAffectedIndex === -1 && firstAffectedIndex === -1
              ? 0
              : lastAffectedIndex - firstAffectedIndex + 1,
          index: firstAffectedAction
            ? firstAffectedIndex
            : auton.auton.findLastIndex(
                (act) => act.offset < changeOffset.offset
              ) + 1,
        };
        // adjust offsets of all actions after edit
        const offsetAdjustment: number =
          contentChange.text.length - contentChange.rangeLength;
        for (let i = edit.index + edit.count - 1; i < auton.auton.length; i++) {
          if(i < 0) continue;
          auton.auton[i] = {
            ...auton.auton[i],
            offset:
              auton.auton[i].offset +
              (auton.auton[i].offset >= changeOffset.endOffset
                ? offsetAdjustment
                : 0),
            endOffset:
              auton.auton[i].endOffset +
              (auton.auton[i].endOffset > changeOffset.endOffset
                ? offsetAdjustment
                : 0),
          };
        }
        // modify doc text
        docText =
          docText.slice(0, changeOffset.offset) +
          contentChange.text +
          docText.slice(changeOffset.endOffset);

        // add to output array
        if (
          edit.count !== 0 ||
          (Array.isArray(edit.action) && edit.action.length !== 0)
        )
          edits.push(edit);
        // perform edit
        auton.makeEdit(edit);
      }
      console.log("action:", auton.auton.at(-1));
      console.log({ change, auton: auton.auton, l: auton.auton.length });
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
      edit: AutonEdit.AutonEdit<Action>,
      workspaceEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit()
    ): vscode.WorkspaceEdit {
      /** actions in auton that will be modified or deleted by the edit */
      const affectedAutonActs = auton.auton.slice(
        edit.index,
        edit.index + edit.count
      );
      /** new acts in edit */
      const editActs: Action[] = Array.isArray(edit.action)
        ? edit.action
        : [edit.action];

      // removes text associated with the actions that will be deleted
      for (const deletedAct of affectedAutonActs
        // if action is modified, we do not want to remove it
        .filter(
          ({ uuid, type }) =>
            !editActs.some(
              ({ uuid: newUUID, type: newType }) =>
                newUUID === uuid && type === newType
            )
        ))
        workspaceEdit.delete(doc.uri, upgradeOffsetsToRange(deletedAct, doc));

      /** where should the next edit be written (used for new actions) */
      let writeOffset: number = auton.auton.at(edit.index)?.offset ?? 0;

      // either modify or create new action
      for (const newAct of editActs) {
        let modifiedAct: ActionWithOffset | undefined;
        if (
          // is newAct a modified version of an action in affectedAutonActs
          (modifiedAct = affectedAutonActs.find(
            ({ uuid, type }) => uuid === newAct.uuid && type === newAct.type
          )) !== undefined
        )
          // update existing action's params
          updateActionParams(
            { ...modifiedAct, params: newAct.params } as ActionWithOffset,
            doc,
            workspaceEdit
          );
        else {
          // add new action's text to document
          workspaceEdit.insert(
            doc.uri,
            doc.positionAt(writeOffset),
            generateTextForAction(newAct)
          );
        }
        // update next action location
        writeOffset += workspaceEdit.get(doc.uri).at(-1)?.newText.length ?? 0;
      }

      return workspaceEdit;
    }
    /**
     * adds a replace {@link vscode.TextEdit TextEdit } to workspaceEdit that \t updates the params
     */
    export function updateActionParams(
      action: ActionWithOffset,
      doc: vscode.TextDocument,
      workspaceEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit()
    ): vscode.WorkspaceEdit {
      const currentText: string = doc.getText(
        upgradeOffsetsToRange(action, doc)
      );
      Object.entries(action.groupIndices)
        .filter(([group]) => !group.startsWith("_"))
        // remove type from group and get param name
        .map(([group, indices]): [string, [number, number]] => [
          group.split("_").slice(1).join(""),
          indices,
        ])
        .forEach(([group, [start, end]]) => {
          const newText: string | undefined = action.params[group]?.toString();
          if (
            newText &&
            newText !==
              currentText.slice(start - action.offset, end - action.offset)
          )
            workspaceEdit.replace(
              doc.uri,
              upgradeOffsetsToRange(action, doc),
              newText
            );
        });
      return workspaceEdit;
    }
    /**
     * generates text for an action
     * @param indent specifies how the start of the string should be indented
     */
    export function generateTextForAction(
      action: Action,
      indent: string = "\t"
    ): string {
      const PARAM_PATTERN: RegExp =
        /\(\?\<(?:int|string|float|bool)_(?<paramName>\w+)\>.+\)/;
      return CppToAuton.PATTERNS.PATTERNS.find((e) => e.name === action.type)!
        .pattern.composition.map((e): string => {
          let str: string;
          if (typeof e === "object") {
            if (e.separator === true)
              return e.separator + (e.str === "," ? " " : "");
            else if (e.control === true) return "";
            else if (e.indent === true) return indent;
            str = e.str;
          } else {
            str = e;
          }
          const name: string | undefined =
            PARAM_PATTERN.exec(str)?.groups?.paramName;
          if (name && name in action.params)
            return action.params[name]?.toString() ?? str;
          return str;
        })
        .join("");
    }
    export function upgradeOffsetsToRange(
      {
        offset,
        endOffset,
      }: {
        offset: number;
        endOffset: number;
      },
      doc: vscode.TextDocument
    ): vscode.Range {
      return new vscode.Range(
        doc.positionAt(offset),
        doc.positionAt(endOffset)
      );
    }
  }
}
