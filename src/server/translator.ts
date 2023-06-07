import { UUID, randomUUID } from "crypto";
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
        | Param
        | { separator: string }
        | { indent: number }
      )[];
      export type Pattern = {
        regex: RegExp;
        composition: PatternComposition;
      };
      export type Param = {
        paramName: string;
        type: "string" | "bool" | "int" | "float";
        opt?: boolean;
      };
      export const FLOAT: RegExp = /[+-]?(?:\d*\.)?\d+/;
      export const INT: RegExp = /[+-]?\d+/;
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
        return `"(?<string_${n}>.*)"`;
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

        /** pattern composition will be returned */
        let composition: PatternComposition = [];

        /** source of regex that will be returned */
        let outSrc: string = "";

        /** adds str only to outSrc (used for text that only makes sense in regex) */
        function addRegex(str: string) {
          outSrc += str;
        }
        /** adds comp only to composition (used for comps that only makes sense in composition) */
        function addComp(...comp: PatternComposition) {
          composition.push(...comp);
        }
        /** adds str to both composition and outSrc */
        function add(str: string) {
          addRegex(str);
          addComp(str);
        }
        /**
         * adds a separator to both composition and outSrc
         * @param sep string equivalent to separator
         * @param reg string that will be passed to {@link s()}
         */
        function addSep(sep: string, reg?: string) {
          outSrc += s(reg ?? sep);
          composition.push({ separator: sep });
        }

        addRegex(`(?<=^(?:${SPACE_AND_LINE.source}|${BLOCK_COMMENT.source}))`);
        addComp({ indent: 1 });
        add("auton");
        addSep("::");
        add(funcName);
        addSep("(", "\\(");
        addComp(...params);
        addRegex(
          params
            .sort((a, b) => +(a.opt ?? 0) - +(b.opt ?? 0))
            .map((param, i): string => {
              if (param.opt) optStartIndex = Math.min(optStartIndex, i);
              let out = "";
              switch (param.type) {
                case "string":
                  out = string(param.paramName);
                  break;
                case "bool":
                  out = bool(param.paramName);
                  break;
                case "int":
                  out = int(param.paramName);
                  break;
                case "float":
                  out = float(param.paramName);
                  break;
              }
              return (param.opt ? "(?:" : "") + (i > 0 ? s(",") : "") + out;
            })
            .join("")
        );
        addRegex(")?".repeat(params.length - optStartIndex));
        addSep(")", "\\)");
        add(";");
        return {
          regex: new RegExp(outSrc, "dgm"),
          composition,
        };
      }
      export const SET_POSE: Pattern = func("setPose", [
        { paramName: "x", type: "float" },
        { paramName: "y", type: "float" },
        { paramName: "heading", type: "float" },
        { paramName: "radians", type: "bool", opt: true },
      ]);
      export const TURN_TO: Pattern = func("turnTo", [
        { paramName: "x", type: "float" },
        { paramName: "y", type: "float" },
        { paramName: "timeout", type: "int" },
        { paramName: "reversed", type: "bool", opt: true },
        { paramName: "maxSpeed", type: "float", opt: true },
        { paramName: "log", type: "bool", opt: true },
      ]);
      export const MOVE_TO: Pattern = func("moveTo", [
        { paramName: "x", type: "float" },
        { paramName: "y", type: "float" },
        { paramName: "timeout", type: "int" },
        { paramName: "maxSpeed", type: "float", opt: true },
        { paramName: "log", type: "bool", opt: true },
      ]);
      export const FOLLOW: Pattern = func("follow", [
        { paramName: "filePath", type: "string" },
        { paramName: "timeout", type: "int" },
        { paramName: "lookahead", type: "float" },
        { paramName: "maxSpeed", type: "float", opt: true },
        { paramName: "log", type: "bool", opt: true },
      ]);
      export const WAIT: Pattern = func("wait", [
        { paramName: "milliseconds", type: "int" },
      ]);

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
                          trueValue = value === "true";
                          break;
                        case "string":
                          trueValue = String(value);
                          break;
                        case "int":
                        case "float":
                          trueValue = Number(value);
                          break;
                        default:
                          trueValue = value as never;
                          break;
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
      oldDocText: string,
      reason: string[]
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
          reason: reason.concat("server.translator.change"),
        };
        // adjust offsets of all actions after edit
        const offsetAdjustment: number =
          contentChange.text.length - contentChange.rangeLength;
        const offsetAdjustMods: AutonEdit.Modify<CppAction>[] = [];
        for (let i = edit.index + edit.count - 1; i < auton.auton.length; i++) {
          if (i < 0) continue;
          let newProperties: { offset?: number; endOffset?: number } = {};
          if (auton.auton[i].offset >= changeOffset.endOffset)
            newProperties.offset = auton.auton[i].offset + offsetAdjustment;
          if (auton.auton[i].endOffset > changeOffset.endOffset)
            newProperties.endOffset =
              auton.auton[i].endOffset + offsetAdjustment;
          if (newProperties.offset || newProperties.endOffset)
            offsetAdjustMods.push({
              index: i,
              newProperties,
              reason: reason.concat("server.translator.adjustOffset"),
            });
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
        auton.makeEdit([...offsetAdjustMods, edit]);
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
      edit: AutonEdit.Result.AutonEdit<ActionWithOffset>,
      workspaceEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit(),
      reason: string[]
    ): vscode.WorkspaceEdit {
      const isReplace = AutonEdit.TypeGuards.isReplace(edit);
      const isModify = AutonEdit.TypeGuards.isModify(edit);
      const isMove = AutonEdit.TypeGuards.isMove(edit);
      if (!isReplace && !isModify && !isMove) return workspaceEdit;

      const adjustEdits: (
        | AutonEdit.Modify<ActionWithOffset>
        | OffsetAdjustment
      )[] = [];
      if (isMove) {
        const movedElementsIndex =
          1 +
          edit.insertionIndex -
          (edit.insertionIndex > edit.sourceStart
            ? edit.sourceEnd - edit.sourceStart
            : 0);
        const sourceOffsets = {
          offset: auton.auton[movedElementsIndex].offset,
          endOffset:
            auton.auton[
              movedElementsIndex + edit.sourceEnd - edit.sourceStart - 1
            ].endOffset,
        };
        const sourceRange: vscode.Range = upgradeOffsetsToRange(
          sourceOffsets,
          doc
        );
        const sourceLength = sourceOffsets.endOffset - sourceOffsets.offset;
        let targetOffsets = {
          offset: auton.auton[movedElementsIndex - 1]?.endOffset ?? 0,
          endOffset:
            auton.auton[movedElementsIndex + edit.sourceEnd - edit.sourceStart]
              ?.offset ?? Infinity,
        };
        // if (sourceOffsets.endOffset < targetOffsets.offset) {
        //   targetOffsets.offset += sourceLength;
        //   targetOffsets.endOffset += sourceLength;
        // }
        const deletedOffsets = {
          offset:
            sourceOffsets.offset -
            doc.positionAt(sourceOffsets.offset).character -
            1,
          endOffset: sourceOffsets.endOffset,
        };
        const deletedRange = upgradeOffsetsToRange(deletedOffsets, doc);
        workspaceEdit.delete(doc.uri, deletedRange);
        const newText = doc.getText(deletedRange);
        workspaceEdit.insert(
          doc.uri,
          doc.positionAt(targetOffsets.offset),
          newText
        );

        adjustEdits.push(
          ...auton.auton
            .slice(
              movedElementsIndex,
              movedElementsIndex + edit.sourceEnd - edit.sourceStart
            )
            .reverse()
            .map((act): AutonEdit.Modify<ActionWithOffset> => {
              let _offset =
                targetOffsets.offset +
                act.offset -
                auton.auton[movedElementsIndex].offset -
                (edit.insertionIndex > edit.sourceEnd
                  ? sourceOffsets.endOffset - sourceOffsets.offset
                  : deletedOffsets.offset - sourceOffsets.offset - 1);
              return {
                newProperties: {
                  endOffset: _offset + act.endOffset - act.offset,
                  offset: _offset,
                },
                reason: reason.concat(
                  "server.translator.translateEdit.adjustOffset"
                ),
                uuid: act.uuid,
              };
            })
        );

        // must fix offsets of any actions after start source index and before end target index
        const offsetAdjustment =
          deletedOffsets.endOffset - deletedOffsets.offset + 1;
        for (
          let index =
            edit.sourceEnd < edit.insertionIndex
              ? edit.sourceStart
              : movedElementsIndex + edit.sourceEnd - edit.sourceStart;
          index <
          (edit.sourceEnd < edit.insertionIndex
            ? movedElementsIndex
            : edit.sourceStart + edit.sourceEnd - edit.sourceStart);
          index++
        ) {
          const act = auton.auton[index];
          adjustEdits.push({
            reason: reason.concat(
              "server.translator.translateEdit.adjustOffset"
            ),
            newProperties: {
              offset:
                act.offset +
                offsetAdjustment *
                  (edit.sourceEnd < edit.insertionIndex ? -1 : 1),
              endOffset:
                act.endOffset +
                offsetAdjustment *
                  (edit.sourceEnd < edit.insertionIndex ? -1 : 1),
            },
            index,
          });
        }
        // return workspaceEdit;
      } else {
        // isModify || isReplace
        const editIndex =
          "index" in edit
            ? edit.index
            : auton.auton.findIndex(({ uuid }) => uuid === edit.uuid);
        if (editIndex < 0) return workspaceEdit;

        /** actions in auton that will be modified or deleted by the edit */
        const affectedAutonActs: ActionWithOffset[] = isReplace
          ? auton.auton.slice(edit.index, edit.index + edit.count)
          : [auton.auton[editIndex]];

        /** new acts in edit */
        const editActs: Action[] = isReplace
          ? Array.isArray(edit.action)
            ? edit.action
            : [edit.action]
          : // { ...this.auton[index], ...mod.newProperties }
            affectedAutonActs;

        /** where should the next edit be written (used for new actions) */
        let writeOffset: number =
          auton.auton.at(Math.max(editIndex - 1, 0))?.offset ?? 0;

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
            adjustEdits.push(
              updateActionParams(
                { ...modifiedAct, params: newAct.params } as ActionWithOffset,
                doc,
                workspaceEdit
              )
            );
          else {
            // add new action's text to document
            const newText = generateTextForAction(newAct);
            const actualNewTextLength = newText.trimStart().length;
            const newActOffset =
              writeOffset + newText.length - actualNewTextLength;
            const newActEndOffset = newActOffset + actualNewTextLength;
            adjustEdits.push(
              {
                uuid: newAct.uuid,
                newProperties: {
                  offset: newActOffset,
                  endOffset: newActEndOffset,
                },
                reason: reason.concat(
                  "server.translator.translateAutonEdit.newOffsets"
                ),
              },
              OffsetAdjustment.addNewAction(
                auton.getIndexFromId(newAct.uuid) + 1,
                newText.length
              )
            );

            workspaceEdit.insert(doc.uri, doc.positionAt(writeOffset), newText);
          }
          // update next action location
          writeOffset += workspaceEdit.get(doc.uri).at(-1)?.newText.length ?? 0;
        }

        // removes text associated with the actions that will be deleted
        if (isReplace)
          edit.deletedActs.forEach((act) =>
            adjustEdits.push(
              OffsetAdjustment.removeAction(act, workspaceEdit, doc)
            )
          );
      }
      auton.makeEdit(
        adjustEdits.flatMap((adjust) =>
          AutonEdit.TypeGuards.isModify(adjust)
            ? adjust
            : OffsetAdjustment.fillCreateEdits(adjust, {
                auton,
                reason: reason.concat("server.translator.translateAutonEdit"),
              })
        )
      );
      return workspaceEdit;
    }
    export class OffsetAdjustment {
      public auton?: Auton<ActionWithOffset>;
      public start?: number | UUID;
      public end?: number | UUID;
      public reason?: string[];
      constructor(
        public readonly adjuster: typeof OffsetAdjustment.Adjuster.prototype
      ) {}
      static changeActionLength(
        action: UUID,
        change: number
      ): OffsetAdjustment {
        let adjustment = new OffsetAdjustment(
          new this.Adjuster.SemiDynamic(
            new this.Adjuster.Constant(change),
            Object.fromEntries([
              [
                action,
                new this.Adjuster.Dynamic(({ offset, endOffset }) => {
                  return { offset, endOffset: endOffset + change };
                }),
              ],
            ])
          )
        );
        adjustment.start = action;
        return adjustment;
      }
      static addNewAction(
        actionIndex: number,
        newTextLength: number
      ): OffsetAdjustment {
        let adjustment = new OffsetAdjustment(
          new this.Adjuster.Constant(newTextLength)
        );
        adjustment.start = actionIndex;
        return adjustment;
      }
      /**
       * @description updates workspaceEdit and creates a OffsetAdjustment representing removal of action
       *
       * @param workspaceEdit removes text that represents action from doc
       * @param doc document containing action
       *
       * @returns OffsetAdjustment representing removal of action
       */
      static removeAction(
        {
          uuid,
          offset,
          endOffset,
        }: Pick<ActionWithOffset, "uuid" | "offset" | "endOffset">,
        workspaceEdit: vscode.WorkspaceEdit,
        doc: vscode.TextDocument
      ): OffsetAdjustment {
        const newOffset = offset - doc.positionAt(offset).character - 1;
        let adjustment = new OffsetAdjustment(
          new this.Adjuster.Constant(newOffset - endOffset)
        );
        workspaceEdit.delete(
          doc.uri,
          upgradeOffsetsToRange({ offset: newOffset, endOffset }, doc)
        );
        adjustment.start = uuid;
        return adjustment;
      }
      public static fill(
        adjustment: OffsetAdjustment,
        filling: {
          [k in keyof Omit<
            OffsetAdjustment,
            "adjuster" | "end" | "start"
          >]-?: OffsetAdjustment[k];
        } & {
          [k in keyof Pick<
            OffsetAdjustment,
            "end" | "start"
          >]?: OffsetAdjustment[k];
        }
      ): Parameters<typeof OffsetAdjustment.createEdits>[0] {
        adjustment.auton ??= filling.auton;
        adjustment.start ??= filling?.start ?? 0;
        adjustment.end ??= filling?.end ?? adjustment.auton.auton.length;
        adjustment.reason ??= filling.reason;
        if (typeof adjustment.start === "string")
          adjustment.start = adjustment.auton.getIndexFromId(adjustment.start);
        if (typeof adjustment.end === "string")
          adjustment.end = adjustment.auton.getIndexFromId(adjustment.end);
        return adjustment as Parameters<typeof OffsetAdjustment.createEdits>[0];
      }
      public static createEdits({
        auton,
        start,
        end,
        adjuster,
        reason,
      }: {
        [k in keyof OffsetAdjustment]-?: Exclude<OffsetAdjustment[k], UUID>;
      }): AutonEdit.Modify<ActionWithOffset>[] {
        return auton.auton
          .slice(start, end)
          .map((act, index): AutonEdit.Modify<ActionWithOffset> => {
            return {
              newProperties: adjuster.adjust(act),
              index,
              reason: reason.concat(
                "server.translator.createAdjustOffsetEdits.adjustOffset"
              ),
            };
          });
      }
      public static fillCreateEdits(
        adjustment: OffsetAdjustment,
        filling: Parameters<typeof OffsetAdjustment.fill>[1]
      ): AutonEdit.Modify<ActionWithOffset>[] {
        return this.createEdits(this.fill(adjustment, filling));
      }
      static Adjuster = class Adjuster {
        adjust({
          offset,
          endOffset,
          uuid,
        }: {
          offset: number;
          endOffset: number;
          uuid: UUID;
        }): {
          offset: number;
          endOffset: number;
        } {
          throw "Method Unimplemented";
        }
        static Constant = class Constant extends Adjuster {
          constructor(public readonly adjustment: number) {
            super();
          }
          adjust({ offset, endOffset }: { offset: number; endOffset: number }) {
            return {
              offset: offset + this.adjustment,
              endOffset: endOffset + this.adjustment,
            };
          }
        };
        static Dynamic = class Dynamic extends Adjuster {
          constructor(
            public readonly adjust: ({
              offset,
              endOffset,
              uuid,
            }: {
              offset: number;
              endOffset: number;
              uuid: UUID;
            }) => {
              offset: number;
              endOffset: number;
            }
          ) {
            super();
          }
        };
        static SemiDynamic = class SemiDynamic extends Adjuster {
          constructor(
            public readonly defaultAdjuster: Adjuster,
            public readonly adjusterMap: {
              [k: UUID]: Adjuster;
            }
          ) {
            super();
          }
          adjust({
            offset,
            endOffset,
            uuid,
          }: {
            uuid: UUID;
            offset: number;
            endOffset: number;
          }) {
            return (
              uuid in this.adjusterMap
                ? this.adjusterMap[uuid]
                : this.defaultAdjuster
            ).adjust({
              offset,
              endOffset,
              uuid,
            });
          }
        };
      };
    }
    /**
     * adds a replace {@link vscode.TextEdit TextEdit } to workspaceEdit that updates the params
     */
    export function updateActionParams(
      action: ActionWithOffset,
      doc: vscode.TextDocument,
      workspaceEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit()
    ): OffsetAdjustment {
      const currentText: string = doc.getText(
        upgradeOffsetsToRange(action, doc)
      );
      return OffsetAdjustment.changeActionLength(
        action.uuid,
        Object.entries(action.groupIndices)
          .filter(([group]) => !group.startsWith("_"))
          // remove type from group and get param name
          .map(([group, indices]): [string, [number, number]] => [
            group.split("_").slice(1).join(""),
            indices,
          ])
          .reduce((offsetAdjustment, [group, [start, end]]) => {
            const newText: string | undefined = (
              action.params as {
                [k: string]: boolean | number | string | undefined;
              }
            )[group]?.toString();
            const currText = currentText.slice(
              start - action.offset,
              end - action.offset
            );
            if (newText && newText !== currText) {
              workspaceEdit.replace(
                doc.uri,
                upgradeOffsetsToRange(action, doc),
                newText
              );
              offsetAdjustment += newText.length - currText.length;
            }
            return offsetAdjustment;
          }, 0)
      );
    }
    /**
     * generates text for an action
     * @param indent specifies how the start of the string should be indented
     */
    export function generateTextForAction(
      action: Action,
      indent: string = "\t"
    ): string {
      let actionParamsAsMap = action.params as {
        [k: string]: boolean | number | string | undefined;
      };
      let paramsLeft: number = Object.keys(action.params).length;
      return CppToAuton.PATTERNS.PATTERNS.find((e) => e.name === action.type)!
        .pattern.composition.map((e): string => {
          if (typeof e === "object") {
            if ("separator" in e) return e.separator;
            if ("indent" in e) return "\t".repeat(e.indent);
            if ("paramName" in e && e.paramName in action.params)
              return (
                (e.type == "string"
                  ? `"${actionParamsAsMap[e.paramName]!.toString()}"`
                  : actionParamsAsMap[e.paramName]!.toString()) +
                (--paramsLeft > 0 ? ", " : "")
              );
            return "";
          }
          return e;
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

// 1000 lines
