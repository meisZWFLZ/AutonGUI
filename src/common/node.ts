import { Coordinate, Position, Rotatable } from "./coordinates.js";

export enum ACTION_TYPE {
	SHOOT,
	PISTON_SHOOT,
	INTAKE,
	ROLLER,
	EXPAND
}
export abstract class Action {
	type!: ACTION_TYPE;
	Shoot = class extends Action {
		type = ACTION_TYPE.SHOOT;
	}
	PistonShoot = class extends Action {
		type = ACTION_TYPE.PISTON_SHOOT;
	}
	Intake = class extends Action {
		type = ACTION_TYPE.INTAKE;
	}
	Roller = class extends Action {
		type = ACTION_TYPE.ROLLER;
	}
	Expand = class extends Action {
		type = ACTION_TYPE.EXPAND;
	}
}
/** @param actions must not be empty */
export type Node = { position: Position | Coordinate | Rotatable, actions?: Action[] };