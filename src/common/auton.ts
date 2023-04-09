import { CoordinateUtilities, Position } from "./coordinates.js";
import {
  SetPose,
  Action,
  MoveTo,
  Intake,
  TurnTo,
  Follow,
  Expand,
  PistonShoot,
  Shoot,
  StopIntake,
  ActionTypeGuards,
  Roller,
} from "./action.js";
import { randomUUID } from "crypto";

export type AutonData<A extends Action = Action> = [SetPose & A, ...A[]];

export default class Auton<A extends Action = Action> {
  protected _auton: AutonData<A>;

  constructor(startPos: SetPose & A, actions: A[] = []) {
    this._auton = [startPos, ...actions];
  }

  public get auton(): AutonData<A> {
    return this._auton;
  }
  public set auton(auton: AutonData<A>) {
    this._auton = auton;
  }
  public setStartPos(startPos: Position) {
    this.auton[0] = {
      ...this.auton[0],
      params: { ...this.auton[0].params, ...startPos },
    };
  }
  public getStartPos(): Position {
    return this.auton[0].params;
  }
  public append(...acts: A[]) {
    this.replace({ action: acts, index: this._auton.length, count: 0 });
  }
  /**
   * @throws will throw if inserting action not of type {@link SetPose} into the 0th index
   */
  public insert({ action: _act, index, count = 0 }: AutonEdit.Insert<A>) {
    const acts: A[] = Array.isArray(_act) ? _act : [_act];
    if (
      index === 0 &&
      !(
        ActionTypeGuards.isSetPose(acts[0]) ||
        CoordinateUtilities.isPosition(acts[0].params)
      )
    )
      throw 'cannot put an action not of type "SetPose" in 0th index of auton';
    this.replace({ index, count, action: acts });
  }
  /**
   * @throws will throw if replacing 0th index with an action not of type {@link SetPose}
   */
  public replace({ action: _act, index, count }: AutonEdit.Replace<A>) {
    const acts: A[] = Array.isArray(_act) ? _act : [_act];
    // ignore for now as this should alert the user (todo)
    // if (
    //   index === 0 &&
    //   !(
    //     ActionTypeGuards.isSetPose(acts[0]) &&
    //     CoordinateUtilities.isPosition(acts[0].params)
    //   )
    // )
    //   throw 'cannot put an action not of type "SetPose" in 0th index of auton';
    this.auton.splice(index, count ?? acts.length, ...acts);
  }
  /**
   * @throws will throw if removing 0th element
   */
  public remove({ index, count = 1, action = [] }: AutonEdit.Remove) {
    if (index === 0) throw "cannot remove the 0th element of auton";
    this.replace({ index, count, action });
  }
  /**
   * @description performs edits starting from the 0th index
   * @throws will throw if inserting action not of type {@link SetPose} into the 0th index
   * @throws will throw if replacing 0th index with an action not of type {@link SetPose}
   * @throws will throw if removing 0th element
   */
  public makeEdit(_edit: AutonEdit.AutonEdit<A> | AutonEdit.AutonEdit<A>[]) {
    const edits: AutonEdit.AutonEdit<A>[] = Array.isArray(_edit)
      ? _edit
      : [_edit];
    edits.forEach(this.replace, this);
  }

  // if for some reason the create functions must be redone, I used this snippet:
  // "Create Action": {
  //   "prefix": "act",
  //   "body": "  static create$1(params: $1.Params): $1 {\nreturn { type: \"$2\", params };\n}"
  // }
  static createSetPose(params: SetPose.Params): SetPose {
    return { type: "set_pose", params, uuid: randomUUID() };
  }
  static createMoveTo(params: MoveTo.Params): MoveTo {
    return { type: "move_to", params, uuid: randomUUID() };
  }
  static createTurnTo(params: TurnTo.Params): TurnTo {
    return { type: "turn_to", params, uuid: randomUUID() };
  }
  static createFollow(params: Follow.Params): Follow {
    return { type: "follow", params, uuid: randomUUID() };
  }
  static createIntake(): Intake {
    return { type: "intake", params: {}, uuid: randomUUID() };
  }
  static createStopIntake(): StopIntake {
    return { type: "stop_intake", params: {}, uuid: randomUUID() };
  }
  static createShoot(): Shoot {
    return { type: "shoot", params: {}, uuid: randomUUID() };
  }
  static createPistonShoot(): PistonShoot {
    return { type: "piston_shoot", params: {}, uuid: randomUUID() };
  }
  static createExpand(): Expand {
    return { type: "expand", params: {}, uuid: randomUUID() };
  }
  static createRoller(): Roller {
    return { type: "roller", params: {}, uuid: randomUUID() };
  }
}

export namespace AutonEdit {
  // export interface Base {
  //   readonly type: "append" | "insert" | "replace" | "remove";
  // }
  // export interface Append<A extends Action> extends Base {
  //   readonly type: "append";
  //   readonly action: A | A[];
  // }
  /**
   * @warn if index is zero, oth element of action must be {@link SetPose}
   */
  export interface Insert<A extends Action> extends Replace<A> {
    // readonly type: "insert";
    readonly action: A | A[];
    readonly index: number;
    readonly count: 0;
  }
  /**
   * @warn if index is zero, 0th element of action must be {@link SetPose}
   */
  export interface Replace<A extends Action> {
    readonly action: A | A[];
    readonly index: number;
    /**
     * @description specifies the number of elements of the original array to replace with the new elements (0 acts like insert)
     */
    readonly count: number;
  }
  /**
   * @warn index must be greater than zero
   */
  export interface Remove extends Replace<Action> {
    readonly action: [];
    readonly index: number;
    readonly count: number;
  }
  export type AutonEdit<A extends Action = Action> = Replace<A>;
}
