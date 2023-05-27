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
  BaseAction,
  Wait,
} from "./action.js";
import { randomUUID } from "crypto";
import { SimpleEventDispatcher, SignalDispatcher } from "strongly-typed-events";

export type AutonData<A extends BaseAction<{}> = Action> = [
  SetPose & A,
  ...A[]
];

export default class Auton<A extends BaseAction<{}> = Action> {
  protected _auton: AutonData<A>;

  constructor(startPos: SetPose & A, actions: A[] = []) {
    this._auton = [startPos, ...actions];

    // events
    this.onEdit.sub(() => {
      this._onModified.dispatch();
    });
    this.onReplaceEdit.sub((edit) => {
      this._onEdit.dispatch(edit);
    });
    this.onModifyEdit.sub((edit) => {
      this._onEdit.dispatch(edit);
    });
    this.onMoveEdit.sub((edit) => {
      this._onEdit.dispatch(edit);
    });
  }

  public get auton(): Readonly<AutonData<A>> {
    return this._auton;
  }
  // public set auton(auton: AutonData<A>) {
  //   this._auton = auton;
  //   this.onModified?.();
  // }
  public setStartPos(startPos: Position) {
    this._auton[0] = {
      ...this.auton[0],
      params: { ...this.auton[0].params, ...startPos },
    };
    this._onModified.dispatch();
  }
  public getStartPos(): Position {
    return this.auton[0].params;
  }
  public append(acts: A[], reason: AutonEdit.Base["reason"]) {
    this.replace({ action: acts, index: this._auton.length, count: 0, reason });
  }
  /**
   * @throws if inserting action not of type {@link SetPose} into the 0th index
   */
  public insert({
    action: _act,
    index,
    count = 0,
    reason,
  }: AutonEdit.Insert<A>) {
    const acts: A[] = Array.isArray(_act) ? _act : [_act];
    if (
      index == 0 &&
      !(
        ActionTypeGuards.isSetPose(acts[0]) ||
        CoordinateUtilities.isPosition(acts[0].params)
      )
    )
      throw 'auton.insert(): cannot put an action not of type "SetPose" in 0th index of auton';
    this.replace({ index, count, action: acts, reason });
  }
  /**
   * @throws if replacing 0th index with an action not of type {@link SetPose}
   */
  public replace({ action: _act, index, count, reason }: AutonEdit.Replace<A>) {
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
    this._auton.splice(index, count ?? acts.length, ...acts);
    this._onReplaceEdit.dispatch({ action: _act, index, count, reason });
  }
  /**
   * @throws if removing 0th element
   */
  public remove({ index, count = 1, action = [], reason }: AutonEdit.Remove) {
    if (index == 0) throw "auton.remove(): cannot remove the 0th element of auton";
    this.replace({ index, count, action, reason });
  }
  /**
   * @throws if modifying 0th element's params to a non positional type
   */
  public modify(mod: AutonEdit.Modify<A>) {
    const index: number =
      "index" in mod
        ? mod.index
        : this.auton.findIndex(({ uuid }) => uuid === mod.uuid);
    if (
      index != 0 ||
      !("params" in mod) ||
      CoordinateUtilities.isPosition(mod.newProperties.params)
    )
      this._auton[index] = { ...this.auton[index], ...mod.newProperties };
    else throw "auton.modify(): cannot set start position to non positional type";
    this._onModifyEdit.dispatch(mod);
  }
  /**
   * @throws if moving element to or from 0th index
   */
  public move(moveEdit: AutonEdit.Move) {
    let {
      sourceStart: start,
      sourceEnd: end,
      insertionIndex: index,
    } = moveEdit;
    try {
      if (start > end) throw "auton.move(): sourceStart cannot be greater than sourceEnd";
      if (
        end > this.auton.length ||
        index >= this.auton.length ||
        end < 0 ||
        start < 0
      )
        throw "auton.move(): out of auton array bounds";
      if (start <= index && index < end)
        throw "auton.move(): cannot move source to an insertionIndex within source";
      this.insert({
        index,
        action: this._auton.slice(start, end),
        count: 0,
        reason: moveEdit.reason.concat("common.auton.move.insert"),
      });
      this.remove({
        index: start + (end < index ? start - end : 0) + 1,
        count: end - start,
        action: [],
        reason: moveEdit.reason.concat("common.auton.move.remove"),
      });
      this._onMoveEdit.dispatch(moveEdit);
    } catch (error) {
      console.error(error);
    }
  }
  /**
   * @description performs edits starting from the 0th index
   * @throws if inserting action not of type {@link SetPose} into the 0th index
   * @throws if replacing 0th index with an action not of type {@link SetPose}
   * @throws if removing 0th element
   * @throws if moving element to or from 0th index
   */
  public makeEdit(_edit: AutonEdit.AutonEdit<A> | AutonEdit.AutonEdit<A>[]) {
    const edits: AutonEdit.AutonEdit<A>[] = Array.isArray(_edit)
      ? _edit
      : [_edit];
    edits.forEach((edit) => {
      if (AutonEdit.TypeGuards.isModify(edit)) this.modify(edit);
      else if (AutonEdit.TypeGuards.isReplace(edit)) this.replace(edit);
      else if (AutonEdit.TypeGuards.isMove(edit)) this.move(edit);
      else {
        //throw?
      }
    });
  }

  // if for some reason the create functions must be redone, I used this snippet:
  // "Create Action": {
  //   "prefix": "act",
  //   "body": "  static create$1(params: $1.Params): $1 {\nreturn { type: \"$2\", params };\n}"
  // }

  // probably should replace '.Params' with '["params"]'
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
  static createWait(params: Wait.Params): Wait {
    return { type: "wait", params, uuid: randomUUID() };
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
  /**
   * @returns a new auton starting at the origin
   */
  static newAutonAtOrigin() {
    return new Auton(Auton.createSetPose({ x: 0, y: 0, heading: 0 }));
  }

  // Events
  private _onModified = new SignalDispatcher();
  private _onEdit = new SimpleEventDispatcher<AutonEdit.AutonEdit<A>>();
  private _onReplaceEdit = new SimpleEventDispatcher<AutonEdit.Replace<A>>();
  private _onModifyEdit = new SimpleEventDispatcher<AutonEdit.Modify<A>>();
  private _onMoveEdit = new SimpleEventDispatcher<AutonEdit.Move>();

  public get onModified() {
    return this._onModified.asEvent();
  }
  public get onEdit() {
    return this._onEdit.asEvent();
  }
  public get onReplaceEdit() {
    return this._onReplaceEdit.asEvent();
  }
  public get onModifyEdit() {
    return this._onModifyEdit.asEvent();
  }
  public get onMoveEdit() {
    return this._onMoveEdit.asEvent();
  }
}

export namespace AutonEdit {
  export interface Base {
    /**
     * first element indicates the origin of the cause of the edit
     * following elements indicate the path of causation of the edit
     */
    readonly reason: string[];
  }
  // export interface Append<A extends Action> extends Base {
  //   readonly type: "append";
  //   readonly action: A | A[];
  // }
  /**
   * @warn if index is zero, 0th element of action must be {@link SetPose}
   */
  export interface Insert<A extends BaseAction<{}>> extends Replace<A> {
    // readonly type: "insert";
    readonly action: A | A[];
    readonly index: number;
    readonly count: 0;
  }
  /**
   * @warn if index is zero, 0th element of action must be {@link SetPose}
   */
  export interface Replace<A extends BaseAction<{}>> extends Base {
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
  export interface Move extends Base {
    readonly sourceStart: number;
    readonly sourceEnd: number;
    readonly insertionIndex: number;
  }
  /**
   * @warn if index or uuid refers to the first element and modifies params, then params must be of type Position
   */
  export type Modify<A extends BaseAction<{}>> = {
    readonly newProperties: Partial<Omit<A, "type" | "uuid">>;
  } & ({ readonly index: number } | { readonly uuid: A["uuid"] }) &
    Base;

  export type AutonEdit<A extends BaseAction<{}> = Action> =
    | Replace<A>
    | Modify<A>
    | Move;

  export namespace TypeGuards {
    function isNonNullObject(obj: unknown): obj is NonNullable<Object> {
      return typeof obj == "object" && obj !== null;
    }
    function hasReason(obj: Object): obj is Base {
      return (
        "reason" in obj &&
        Array.isArray(obj.reason) &&
        obj.reason.every((str) => typeof str === "string")
      );
    }
    export function isModify(obj: unknown): obj is Modify<any> {
      return (
        isNonNullObject(obj) &&
        hasReason(obj) &&
        "newProperties" in obj &&
        isNonNullObject(obj.newProperties) &&
        (("index" in obj && Number.isInteger(obj.index)) ||
          ("uuid" in obj && typeof obj.uuid === "string")) &&
        !isReplace(obj) &&
        !isMove(obj)
      );
    }
    export function isReplace(obj: unknown): obj is Replace<any> {
      return (
        isNonNullObject(obj) &&
        hasReason(obj) &&
        "action" in obj &&
        (Array.isArray(obj.action)
          ? obj.action.every(ActionTypeGuards.isAction)
          : ActionTypeGuards.isAction(obj.action)) &&
        "index" in obj &&
        Number.isInteger(obj.index) &&
        "count" in obj &&
        Number.isInteger(obj.count) &&
        !isModify(obj) &&
        !isMove(obj)
      );
    }
    export function isMove(obj: unknown): obj is Move {
      return (
        isNonNullObject(obj) &&
        hasReason(obj) &&
        "sourceStart" in obj &&
        Number.isInteger(obj.sourceStart) &&
        "sourceEnd" in obj &&
        Number.isInteger(obj.sourceEnd) &&
        "insertionIndex" in obj &&
        Number.isInteger(obj.insertionIndex) &&
        !isModify(obj) &&
        !isReplace(obj)
      );
    }
  }
}
