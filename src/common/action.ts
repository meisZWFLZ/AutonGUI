import { Position } from "./coordinates";

/**
 * @interface Action an action that can be performed by the robot
 * @template P specifies parameters that must be passed to the action
 */
export interface BaseAction<P> {
  readonly type: string;
  /**
   * @member params specifies parameters that will be passed to the action
   */
  readonly params: P;
}

export namespace SetPose {
  export type Params = Position;
}
export interface SetPose extends BaseAction<SetPose.Params> {
  readonly type: "set_pose";
}

export namespace GoTo {
  export type Params = {
    readonly x: number;
    readonly y: number;
    readonly timeout: number;
    readonly maxSpeed?: number;
    readonly log?: boolean;
  };
}
export interface GoTo extends BaseAction<GoTo.Params> {
  readonly type: "go_to";
}

export namespace TurnTo {
  export type Params = {
    readonly x: number;
    readonly y: number;
    readonly timeout: number;
    readonly reversed?: boolean;
    readonly maxSpeed?: number;
    readonly log?: boolean;
  };
}
export interface TurnTo extends BaseAction<TurnTo.Params> {
  readonly type: "turn_to";
}

export namespace Follow {
  export type Params = {
    readonly filePath: string;
    readonly timeout: number;
    readonly lookahead: number;
    readonly reverse?: boolean;
    readonly maxSpeed?: number;
    readonly log?: boolean;
  };
}
export interface Follow extends BaseAction<Follow.Params> {
  readonly type: "follow";
}

export interface Roller extends BaseAction<undefined> {
  readonly type: "roller";
}

export interface Expand extends BaseAction<undefined> {
  readonly type: "expand";
}

export interface Shoot extends BaseAction<undefined> {
  readonly type: "shoot";
}

export interface PistonShoot extends BaseAction<undefined> {
  readonly type: "piston_shoot";
}

export interface Intake extends BaseAction<undefined> {
  readonly type: "intake";
}

export interface StopIntake extends BaseAction<undefined> {
  readonly type: "stop_intake";
}

export namespace Wait {
  export type Params = {
    readonly time: number;
  };
}
export interface Wait extends BaseAction<Wait.Params> {
  readonly type: "wait";
}

export const ActionTypeGuards = {
  isBaseAction(obj: any): obj is BaseAction<unknown> {
    return ["params", "type"].every((e) => e in obj);
  },
  /**
   * @warn does not check params!
   */
  isWait(obj: unknown): obj is Wait {
    return this.isBaseAction(obj) && obj.type == "wait";
  },
  /**
   * @warn does not check params!
   */
  isStopIntake(obj: unknown): obj is StopIntake {
    return this.isBaseAction(obj) && obj.type == "stop_intake";
  },
  /**
   * @warn does not check params!
   */
  isIntake(obj: unknown): obj is Intake {
    return this.isBaseAction(obj) && obj.type == "intake";
  },
  /**
   * @warn does not check params!
   */
  isPistonShoot(obj: unknown): obj is PistonShoot {
    return this.isBaseAction(obj) && obj.type == "piston_shoot";
  },
  /**
   * @warn does not check params!
   */
  isShoot(obj: unknown): obj is Shoot {
    return this.isBaseAction(obj) && obj.type == "shoot";
  },
  /**
   * @warn does not check params!
   */
  isExpand(obj: unknown): obj is Expand {
    return this.isBaseAction(obj) && obj.type == "expand";
  },
  /**
   * @warn does not check params!
   */
  isRoller(obj: unknown): obj is Roller {
    return this.isBaseAction(obj) && obj.type == "roller";
  },
  /**
   * @warn does not check params!
   */
  isFollow(obj: unknown): obj is Follow {
    return this.isBaseAction(obj) && obj.type == "follow";
  },
  /**
   * @warn does not check params!
   */
  isTurnTo(obj: unknown): obj is TurnTo {
    return this.isBaseAction(obj) && obj.type == "turn_to";
  },
  /**
   * @warn does not check params!
   */
  isGoTo(obj: unknown): obj is GoTo {
    return this.isBaseAction(obj) && obj.type == "go_to";
  },
  /**
   * @warn does not check params!
   */
  isSetPose(obj: unknown): obj is SetPose {
    return this.isBaseAction(obj) && obj.type == "set_pose";
  },
  /**
   * @warn does not check params!
   */
  isAction(obj: unknown): obj is Action {
    return (
      this.isBaseAction(obj) &&
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
        "go_to",
        "set_pose",
      ].includes(obj.type)
    );
  },
};

export type Action =
  | SetPose
  | GoTo
  | TurnTo
  | Follow
  | Roller
  | Expand
  | Shoot
  | PistonShoot
  | Intake
  | StopIntake
  | Wait;
