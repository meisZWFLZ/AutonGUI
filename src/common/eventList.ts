import { EventEmitter } from "events";
export enum LIST_ACTION_TYPE {
	APPEND,
	INSERT,
	REPLACE,
	REMOVE,
}

export abstract class ListAction<T> {
	constructor(public type: LIST_ACTION_TYPE) { };
	abstract do(list: T[]): void;
	abstract undo(list: T[]): void;
}
export namespace ListAction {
	export class Append<T> extends ListAction<T> {
		public override type: LIST_ACTION_TYPE.APPEND = LIST_ACTION_TYPE.APPEND;
		constructor(private element: T) {
			super(LIST_ACTION_TYPE.APPEND);
		}

		do(list: T[]): void {
			list.push(this.element);
		}

		undo(list: T[]): void {
			list.pop();
		}
	}

	export class Insert<T> extends ListAction<T> {
		public override type: LIST_ACTION_TYPE.INSERT = LIST_ACTION_TYPE.INSERT;
		constructor(private index: number, private element: T) {
			super(LIST_ACTION_TYPE.INSERT);
		}

		do(list: T[]): void {
			list.splice(this.index, 0, this.element);
		}

		undo(list: T[]): void {
			list.splice(this.index, 1);
		}
	}

	export class Replace<T> extends ListAction<T> {
		public override type: LIST_ACTION_TYPE.REPLACE = LIST_ACTION_TYPE.REPLACE;
		oldElement: T[] | undefined;
		constructor(private index: number, private newElement: T) {
			super(LIST_ACTION_TYPE.REPLACE);
		}

		do(list: T[]): void {
			this.oldElement = list.splice(this.index, 1, this.newElement);
		}

		undo(list: T[]): void {
			if (this.oldElement)
				list.splice(this.index, 1, ...this.oldElement);
			else throw new Error("replace action not yet performed");
		}
	}

	export class Remove<T> extends ListAction<T> {
		public override type: LIST_ACTION_TYPE.REMOVE = LIST_ACTION_TYPE.REMOVE;
		private removedElements: T[] | undefined;

		constructor(private index: number, private count: number) {
			super(LIST_ACTION_TYPE.REMOVE);
		}

		do(list: T[]): void {
			this.removedElements = list.splice(this.index, this.count);
		}

		undo(list: T[]): void {
			if (this.removedElements)
				list.splice(this.index, 0, ...this.removedElements);
			else throw new Error("remove action not yet performed");
		}
	}
}
/**
 * List modifiable by firing events
 * also implements undo and redo
 */
export default class EventList<T> extends EventEmitter {
	private list: T[];
	private undoStack: ListAction<T>[] = [];
	private redoStack: ListAction<T>[] = [];

	public getEdits(): ListAction<T>[] {
		return this.undoStack;
	}

	private performNewAction(action: ListAction<T>) {
		action.do(this.list);
		this.undoStack.push(action);
		this.redoStack = [];
	}

	constructor(list: T[]) {
		super();
		this.list = list;
		this.on("add", ({ element }: { element: T }) =>
			this.performNewAction(new ListAction.Append<T>(element))
		);
		this.on("insert", ({ el, index }: { el: T, index: number }) =>
			this.performNewAction(new ListAction.Insert<T>(index, el))
		);
		this.on("replace", ({ el, index }: { el: T, index: number }) =>
			this.performNewAction(new ListAction.Replace<T>(index, el))
		);
		this.on("remove", ({ count, index }: { count: number, index: number }) =>
			this.performNewAction(new ListAction.Remove<T>(index, count))
		);
		this.on("get", ({ index = 0, all = false, count = 1 }: { index?: number, all?: boolean, count?: number }): void => {
			let response: T[] = [];
			if (all)
				response = list;
			else response = list.splice(index, index + count)
			this.emit("get-response", response);
		})
	}

	public add(newElement: T) {
		this.emit("add", newElement);
	}

	public insert(index: number, newElement: T) {
		this.emit("insert", index, newElement);
	}

	public replace(index: number, newElement: T) {
		this.emit("replace", index, newElement);
	}

	public remove(index: number, count: number = 1) {
		this.emit("remove", index, count);
	}

	public get(index: number): T {
		this.emit("get", index);
		return this.list[index];
	}

	public undo() {
		const action = this.undoStack.pop();
		if (action) {
			action.undo(this.list);
			this.redoStack.push(action);
		}
	}

	public redo() {
		const action = this.redoStack.pop();
		if (action) {
			action.do(this.list);
			this.undoStack.push(action);
		}
	}
}