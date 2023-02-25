// import { Node } from "./node";

// export type ListEventName = "append" | "remove" | "replace" | "get" | "insert"

// export default abstract class ListEvent {
// 	name!: ListEventName;
// 	public static Append = class Append implements ListEvent {
// 		name: "append" = "append";
// 		constructor(public el: Node) { }
// 	};
// 	public static Insert = class Insert implements ListEvent {
// 		name: "insert" = "insert";
// 		constructor(public el: Node, public index: number) { }
// 	};
// 	public static Replace = class Replace implements ListEvent {
// 		name: "replace" = "replace";
// 		constructor(public el: Node, public index: number) { }
// 	};
// 	public static Remove = class Remove implements ListEvent {
// 		name: "remove" = "remove";
// 		constructor(public index: number) { }
// 	};
// 	public static Get = class Get implements ListEvent {
// 		name: "get" = "get";
// 		public opts: { index: number, count: number, all: boolean } = { index: 0, count: 1, all: false };
// 		public constructor(_opts: { index?: number, count?: number, all?: boolean }) { this.opts = { ...this.opts, ..._opts } }
// 		public static All = class All extends Get {
// 			public constructor() { super({ all: true }) }
// 		}
// 	};
// }