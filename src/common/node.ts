import { Coordinate, Position, Rotatable } from "./coordinates.js";

export enum ACTION {
  SHOOT,
  PISTON_SHOOT,
  INTAKE,
  ROLLER,
  EXPAND,
}
// export abstract class Action {
//   type!: ACTION_TYPE;
//   static Shoot = class extends Action {
//     type = ACTION_TYPE.SHOOT;
//   };
//   static PistonShoot = class extends Action {
//     type = ACTION_TYPE.PISTON_SHOOT;
//   };
//   static Intake = class extends Action {
//     type = ACTION_TYPE.INTAKE;
//   };
//   static Roller = class extends Action {
//     type = ACTION_TYPE.ROLLER;
//   };
//   static Expand = class extends Action {
//     type = ACTION_TYPE.EXPAND;
//   };
// }
/** @param actions must not be empty */
export type Node = {
  position: Position /* | Coordinate | Rotatable */;
  actions?: ACTION[];
};
