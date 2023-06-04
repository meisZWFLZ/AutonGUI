import { UUID } from "crypto";
import { Position } from "./coordinates.js";

export namespace BaseAction {
  export type Params = {};
}
/**
 * @interface Action an action that can be performed by the robot
 * @template P specifies parameters that must be passed to the action
 * @member params specifies parameters that will be passed to the action
 */
export interface BaseAction<P extends BaseAction.Params> {
  readonly type: string;
  /**
   * specifies parameters that will be passed to the action
   */
  readonly params: P;
  /**
   * used to identify when an action is being modified
   */
  readonly uuid: UUID;
}

export namespace SetPose {
  export type Params = Position & { radians?: boolean };
}
export interface SetPose
  extends BaseAction<SetPose.Params & BaseAction.Params> {
  readonly type: "set_pose";
}

export namespace MoveTo {
  export interface Params extends BaseAction.Params {
    readonly x: number;
    readonly y: number;
    readonly timeout: number;
    readonly maxSpeed?: number;
    readonly log?: boolean;
  }
}
export interface MoveTo extends BaseAction<MoveTo.Params> {
  readonly type: "move_to";
}

export namespace TurnTo {
  export interface Params extends BaseAction.Params {
    readonly x: number;
    readonly y: number;
    readonly timeout: number;
    readonly reversed?: boolean;
    readonly maxSpeed?: number;
    readonly log?: boolean;
  }
}
export interface TurnTo extends BaseAction<TurnTo.Params> {
  readonly type: "turn_to";
}

export namespace Follow {
  export interface Params extends BaseAction.Params {
    readonly filePath: string;
    readonly timeout: number;
    readonly lookahead: number;
    readonly reverse?: boolean;
    readonly maxSpeed?: number;
    readonly log?: boolean;
  }
}
export interface Follow extends BaseAction<Follow.Params> {
  readonly type: "follow";
}

export interface Roller extends BaseAction<BaseAction.Params> {
  readonly type: "roller";
}

export interface Expand extends BaseAction<BaseAction.Params> {
  readonly type: "expand";
}

export interface Shoot extends BaseAction<BaseAction.Params> {
  readonly type: "shoot";
}

export interface PistonShoot extends BaseAction<BaseAction.Params> {
  readonly type: "piston_shoot";
}

export interface Intake extends BaseAction<BaseAction.Params> {
  readonly type: "intake";
}

export interface StopIntake extends BaseAction<BaseAction.Params> {
  readonly type: "stop_intake";
}

export namespace Wait {
  export interface Params extends BaseAction.Params {
    readonly milliseconds: number;
  }
}
export interface Wait extends BaseAction<Wait.Params> {
  readonly type: "wait";
}

export namespace ActionTypeGuards {
  export function isBaseAction(obj: any): obj is BaseAction<{}> {
    return ["params", "type"].every((e) => e in obj);
  }
  /**
   * @warn does not check params!
   */
  export function isWait(obj: unknown): obj is Wait {
    return isBaseAction(obj) && obj.type == "wait";
  }
  /**
   * @warn does not check params!
   */
  export function isStopIntake(obj: unknown): obj is StopIntake {
    return isBaseAction(obj) && obj.type == "stop_intake";
  }
  /**
   * @warn does not check params!
   */
  export function isIntake(obj: unknown): obj is Intake {
    return isBaseAction(obj) && obj.type == "intake";
  }
  /**
   * @warn does not check params!
   */
  export function isPistonShoot(obj: unknown): obj is PistonShoot {
    return isBaseAction(obj) && obj.type == "piston_shoot";
  }
  /**
   * @warn does not check params!
   */
  export function isShoot(obj: unknown): obj is Shoot {
    return isBaseAction(obj) && obj.type == "shoot";
  }
  /**
   * @warn does not check params!
   */
  export function isExpand(obj: unknown): obj is Expand {
    return isBaseAction(obj) && obj.type == "expand";
  }
  /**
   * @warn does not check params!
   */
  export function isRoller(obj: unknown): obj is Roller {
    return isBaseAction(obj) && obj.type == "roller";
  }
  /**
   * @warn does not check params!
   */
  export function isFollow(obj: unknown): obj is Follow {
    return isBaseAction(obj) && obj.type == "follow";
  }
  /**
   * @warn does not check params!
   */
  export function isTurnTo(obj: unknown): obj is TurnTo {
    return isBaseAction(obj) && obj.type == "turn_to";
  }
  /**
   * @warn does not check params!
   */
  export function isGoTo(obj: unknown): obj is MoveTo {
    return isBaseAction(obj) && obj.type == "move_to";
  }
  /**
   * @warn does not check params!
   */
  export function isSetPose(obj: unknown): obj is SetPose {
    return isBaseAction(obj) && obj.type == "set_pose";
  }
  /**
   * @warn does not check params!
   */
  export function isAction(obj: unknown): obj is Action {
    return (
      isBaseAction(obj) &&
      [
        "wait",
        "stop_intake",
        "intake",
        "piston_shoot",
        "shoot",
        "expand",
        "roller",
        "follow",
        "turn_to",
        "move_to",
        "set_pose",
      ].includes(obj.type)
    );
  }
}

export type Action =
  | SetPose
  | MoveTo
  | TurnTo
  | Follow
  | Roller
  | Expand
  | Shoot
  | PistonShoot
  | Intake
  | StopIntake
  | Wait;
