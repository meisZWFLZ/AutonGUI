import { CoordinateUtilities, Position } from "./coordinates.js";
import {
  SetPose,
  Action,
  GoTo,
  Intake,
  TurnTo,
  Follow,
  Expand,
  PistonShoot,
  Shoot,
  StopIntake,
  ActionTypeGuards,
} from "./action.js";

export type AutonData = [SetPose, ...Action[]];

export default class Auton {
  private _auton: AutonData;

  constructor(
    startPos: Position = { x: 0, y: 0, heading: 0 },
    actions: Action[] = []
  ) {
    this._auton = [Auton.createSetPose(startPos), ...actions];
  }

  public get auton(): AutonData {
    return this._auton;
  }
  public set auton(auton: AutonData) {
    this._auton = auton;
  }
  public setStartPos(startPos: Position) {
    this.auton[0] = Auton.createSetPose(startPos);
  }
  public getStartPos(): Position {
    return this.auton[0].params;
  }
  public append({ action: _act }: AutonEdit.Append) {
    const acts: Action[] = Array.isArray(_act) ? _act : [_act];
    this._auton.push(...acts);
  }
  /**
   * @throws will throw if inserting action not of type {@link SetPose} into the 0th index
   */
  public insert({ action: _act, index }: AutonEdit.Insert) {
    const acts: Action[] = Array.isArray(_act) ? _act : [_act];
    if (
      index === 0 &&
      !(
        ActionTypeGuards.isSetPose(acts[0]) ||
        CoordinateUtilities.isPosition(acts[0].params)
      )
    )
      throw 'cannot put an action not of type "SetPose" in 0th index of auton';
    this._auton.splice(index, 0, ...acts);
  }
  /**
   * @throws will throw if replacing 0th index with an action not of type {@link SetPose}
   */
  public replace({ action: _act, index, count }: AutonEdit.Replace) {
    const acts: Action[] = Array.isArray(_act) ? _act : [_act];
    if (
      index === 0 &&
      !(
        ActionTypeGuards.isSetPose(acts[0]) &&
        CoordinateUtilities.isPosition(acts[0].params)
      )
    )
      throw 'cannot put an action not of type "SetPose" in 0th index of auton';
    this.auton.splice(index, count ?? acts.length, ...acts);
  }
  /**
   * @throws will throw if removing 0th element
   */
  public remove({ index, count = 1 }: AutonEdit.Remove) {
    if (index === 0) throw "cannot remove the 0th element of auton";
    this.auton.splice(index, count);
  }
  /**
   * @description performs edits starting from the 0th index
   * @throws will throw if inserting action not of type {@link SetPose} into the 0th index
   * @throws will throw if replacing 0th index with an action not of type {@link SetPose}
   * @throws will throw if removing 0th element
   */
  public makeEdit(_edit: AutonEdit.AutonEdit | AutonEdit.AutonEdit[]) {
    const edits: AutonEdit.AutonEdit[] = Array.isArray(_edit) ? _edit : [_edit];
    edits.forEach((edit) => {
      switch (edit.type) {
        case "append":
          this.append(edit);
          break;
        case "insert":
          this.insert(edit);
          break;
        case "replace":
          this.replace(edit);
          break;
        case "remove":
          this.remove(edit);
          break;
      }
    });
  }

  // if for some reason the create functions must be redone, I used this snippet:
  // "Create Action": {
  //   "prefix": "act",
  //   "body": "  static create$1(params: $1.Params): $1 {\nreturn { type: \"$2\", params };\n}"
  // }
  static createSetPose(params: SetPose.Params): SetPose {
    return { type: "set_pose", params };
  }
  static createGoTo(params: GoTo.Params): GoTo {
    return { type: "go_to", params };
  }
  static createTurnTo(params: TurnTo.Params): TurnTo {
    return { type: "turn_to", params };
  }
  static createFollow(params: Follow.Params): Follow {
    return { type: "follow", params };
  }
  static createIntake(): Intake {
    return { type: "intake", params: undefined };
  }
  static createStopIntake(): StopIntake {
    return { type: "stop_intake", params: undefined };
  }
  static createShoot(): Shoot {
    return { type: "shoot", params: undefined };
  }
  static createPistonShoot(): PistonShoot {
    return { type: "piston_shoot", params: undefined };
  }
  static createExpand(): Expand {
    return { type: "expand", params: undefined };
  }
}

export namespace AutonEdit {
  export interface Base {
    readonly type: "append" | "insert" | "replace" | "remove";
  }
  export interface Append extends Base {
    readonly type: "append";
    readonly action: Action | Action[];
  }
  /**
   * @warn if index is zero, oth element of action must be {@link SetPose}
   */
  export interface Insert extends Base {
    readonly type: "insert";
    readonly action: Action | Action[];
    readonly index: number;
  }
  /**
   * @warn if index is zero, 0th element of action must be {@link SetPose}
   */
  export interface Replace extends Base {
    readonly type: "replace";
    readonly action: Action | Action[];
    readonly index: number;
    /**
     * @description specifies the number of elements of the original array to replace with the new elements (0 acts like insert)
     * @defaultvalue actions.length or 1 if action is not an array
     */
    readonly count?: number;
  }
  /**
   * @warn index must be greater than zero
   */
  export interface Remove extends Base {
    readonly type: "remove";
    readonly index: number;
    readonly count?: number;
  }
  export type AutonEdit = Append | Insert | Replace | Remove;
}
