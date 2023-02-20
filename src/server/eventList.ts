import { EventEmitter } from "events";

abstract class ListAction<T> {
	abstract do(list: T[]): void;
	abstract undo(list: T[]): void;
}
namespace ListAction {
	export class Append<T> extends ListAction<T> {
		constructor(private element: T) {
			super();
		}

		do(list: T[]): void {
			list.push(this.element);
		}

		undo(list: T[]): void {
			list.pop();
		}
	}

	export class Insert<T> extends ListAction<T> {
		constructor(private index: number, private element: T) {
			super();
		}

		do(list: T[]): void {
			list.splice(this.index, 0, this.element);
		}

		undo(list: T[]): void {
			list.splice(this.index, 1);
		}
	}

	export class Replace<T> extends ListAction<T> {
		oldElement: T[] | undefined;
		constructor(private index: number, private newElement: T) {
			super();
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
		private removedElements: T[] | undefined;

		constructor(private index: number, private count: number) {
			super();
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

	private performNewAction(action: ListAction<T>) {
		action.do(this.list);
		this.undoStack.push(action);
		this.redoStack = [];
	}

	constructor(list: T[]) {
		super();
		this.list = list;
		this.on("add", (element: T) =>
			this.performNewAction(new ListAction.Append<T>(element))
		);
		this.on("insert", (index: number, element: T) =>
			this.performNewAction(new ListAction.Insert<T>(index, element))
		);
		this.on("replace", (index: number, newElement: T) =>
			this.performNewAction(new ListAction.Replace<T>(index, newElement))
		);
		this.on("remove", (index: number, count: number = 1) =>
			this.performNewAction(new ListAction.Remove<T>(index, count))
		);
		this.on("get", ({ index = 0, all = false, count = 1 }: { index?: number, all?: boolean, count?: number }): void => {
			let response: T[] = [];
			if (all)
				response = list;
			else response = list.splice(index, index + count)
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

export {
	EventList,
	ListAction
}