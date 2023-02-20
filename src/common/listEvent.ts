import { Node } from "./node";

export type ListEventName = "append" | "remove" | "replace" | "get" | "insert"

export default abstract class ListEvent {
	name!: ListEventName;
	public static Append = class implements ListEvent {
		name: "append" = "append";
		constructor(public el: Node) { }
	};
	public static Insert = class implements ListEvent {
		name: "insert" = "insert";
		constructor(public el: Node, public index: number) { }
	};
	public static Replace = class implements ListEvent {
		name: "replace" = "replace";
		constructor(public el: Node, public index: number) { }
	};
	public static Remove = class implements ListEvent {
		name: "remove" = "remove";
		constructor(public index: number) { }
	};
	public static Get = class implements ListEvent {
		name: "get" = "get";
		public opts: { index: number, count: number, all: boolean } = { index: 0, count: 1, all: false };
		public constructor(_opts: { index?: number, count?: number, all?: boolean }) { this.opts = { ...this.opts, ..._opts } }
	};
}