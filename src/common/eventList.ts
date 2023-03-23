export enum LIST_ACTION_TYPE {
  APPEND,
  INSERT,
  REPLACE,
  REMOVE,
}

export abstract class ListAction<T> {
  constructor(public readonly type: LIST_ACTION_TYPE) {}
  abstract do(list: T[]): void;
  abstract undo(list: T[]): void;
}
export namespace ListAction {
  export class Append<T> extends ListAction<T> {
    public override readonly type: LIST_ACTION_TYPE.APPEND =
      LIST_ACTION_TYPE.APPEND;
    constructor(public readonly element: T) {
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
    public override readonly type: LIST_ACTION_TYPE.INSERT =
      LIST_ACTION_TYPE.INSERT;
    constructor(public readonly index: number, public readonly element: T) {
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
    public override readonly type: LIST_ACTION_TYPE.REPLACE =
      LIST_ACTION_TYPE.REPLACE;
    public oldElement: T[] | undefined;
    constructor(public readonly index: number, public readonly newElement: T) {
      super(LIST_ACTION_TYPE.REPLACE);
    }

    do(list: T[]): void {
      this.oldElement = list.splice(this.index, 1, this.newElement);
    }

    undo(list: T[]): void {
      if (this.oldElement) list.splice(this.index, 1, ...this.oldElement);
      else throw new Error("replace action not yet performed");
    }
  }

  export class Remove<T> extends ListAction<T> {
    public override readonly type: LIST_ACTION_TYPE.REMOVE =
      LIST_ACTION_TYPE.REMOVE;
    public removedElements: T[] | undefined;

    constructor(public readonly index: number, public readonly count: number) {
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
export default class EventList<T> {
  protected _list: T[];
  private undoStack: ListAction<T>[] = [];
  private redoStack: ListAction<T>[] = [];

  public getEdits(): ListAction<T>[] {
    return this.undoStack;
  }

  public performNewAction(action: ListAction<T>) {
    action.do(this._list);
    this.undoStack.push(action);
    this.redoStack = [];
  }
  constructor(list?: T[]) {
    // super();
    this._list = list || [];
    // this.addEventListener("add", ({ element }: { element: T }) =>
    //   this.performNewAction(new ListAction.Append<T>(element))
    // );
    // this.addEventListener("insert", ({ el, index }: { el: T; index: number }) =>
    //   this.performNewAction(new ListAction.Insert<T>(index, el))
    // );
    // this.addEventListener("replace", ({ el, index }: { el: T; index: number }) =>
    //   this.performNewAction(new ListAction.Replace<T>(index, el))
    // );
    // this.addEventListener("remove", ({ count, index }: { count: number; index: number }) =>
    //   this.performNewAction(new ListAction.Remove<T>(index, count))
    // );
  }

  public add({ newElement }: { newElement: T }): void {
    // this.emit("add", newElement);
    this.performNewAction(new ListAction.Append<T>(newElement));
  }

  public insert({ index, newElement }: { index: number; newElement: T }): void {
    // this.emit("insert", index, newElement);
    this.performNewAction(new ListAction.Insert<T>(index, newElement));
  }

  public replace({
    index,
    newElement,
  }: {
    index: number;
    newElement: T;
  }): void {
    // this.emit("replace", index, newElement);
    this.performNewAction(new ListAction.Replace<T>(index, newElement));
  }

  public remove({ index, count = 1 }: { index: number; count?: number }): void {
    // this.emit("remove", index, count);
    this.performNewAction(new ListAction.Remove<T>(index, count));
  }

  public get({
    index = 0,
    all = false,
    count = 1,
  }: {
    index?: number;
    all?: boolean;
    count?: number;
  }): T[] {
    let out: T[] = [];
    if (all) out = this._list;
    else out = this._list.slice(index, index + count);
    return out;
  }

  public undo() {
    const action = this.undoStack.pop();
    if (action) {
      action.undo(this._list);
      this.redoStack.push(action);
    }
  }

  public redo() {
    const action = this.redoStack.pop();
    if (action) {
      action.do(this._list);
      this.undoStack.push(action);
    }
  }

  public setList(list: T[]): void {
    this._list = list;
  }
  get list(): T[] {
    return this._list;
  }

  get length(): number {
    return this._list.length;
  }
}
