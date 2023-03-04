// @ts-check

import {
  Coordinate,
  DimensionProvider,
  HasMarginOfError,
  PhysicalPos,
  Position,
} from "../common/coordinates.js";
import { ACTION, Node } from "../common/node.js";
import ActionsManager from "./actionsManager.js";
import ErrorManager from "./errorManager.js";
import { ListAction } from "./eventList.js";
import NodeList from "./nodeList.js";
import { Robot } from "./robot.js";

export default class ListManager {
  public _robot: Robot;
  public _actionsManager: ActionsManager;
  private error: ErrorManager;
  private DimProvider = new (class DimProvider extends DimensionProvider {
    constructor(private outerClass: ListManager) {
      super();
    }
    public get robotOffsetWidth(): number {
      return this.outerClass.els.robot.offsetWidth;
    }
    public get fieldWidth(): number {
      return this.outerClass.els._field.getBoundingClientRect().width;
    }
    public get fieldCoord(): Coordinate {
      return this.outerClass.els._field.getBoundingClientRect();
    }
  })(this);

  protected static readonly globalDefaultPos: Position & HasMarginOfError = {
    x: 72,
    y: 72,
    heading: 0,
    marginOfError: 6,
  };

  readonly newNode: Node = {
    position: this.opts?.defaultPosition ?? ListManager.globalDefaultPos,
  };

  private upgradeToIRLPos(
    pos: Position & HasMarginOfError
  ): PhysicalPos & HasMarginOfError {
    let _pos: PhysicalPos & Partial<HasMarginOfError> = new PhysicalPos(
      pos,
      this.DimProvider
    );
    _pos.marginOfError = pos.marginOfError;
    return _pos as PhysicalPos & HasMarginOfError;
  }
  /**
   * @returns true: index is in bounds
   * @returns false: index out of bounds
   */
  protected checkIndex(index: number = this.index): boolean {
    return index < this.list.length && index >= 0;
  }
  /** @throws will throw if index outside of array bounds */
  protected getNodeAtIndex(index: number = this.index): Node {
    if (!this.checkIndex(index)) throw new Error("out of array bounds");
    return this.list.get({ index })[0];
  }
  /** @throws will throw if index outside of array bounds */
  protected getPosAtIndex(
    index: number = this.index
  ): PhysicalPos & HasMarginOfError {
    return this.upgradeToIRLPos(this.getNodeAtIndex(index).position);
  }
  /** @throws will throw if index outside of array bounds */
  protected getActionsAtIndex(
    index: number = this.index
  ): ACTION[] | undefined {
    return this.getNodeAtIndex(index).actions;
  }

  /** @throws will throw if index outside of array bounds */
  constructor(
    protected els: {
      robot: HTMLElement;
      _field: HTMLElement;
      actions: HTMLElement;
      canvas: HTMLCanvasElement;
    },
    public list: NodeList = new NodeList(),
    private _index: number = 0,
    // protected dimProvider: DimensionProvider,
    private onEdit: () => void,
    private onIndexUpdate: (index: number) => void,
    protected opts: { defaultPosition: Position & HasMarginOfError } = {
      defaultPosition: ListManager.globalDefaultPos,
    }
  ) {
    if (this.list.length <= 0)
      this.list.update([{ position: { x: 0, y: 0 } } as Node]);
    this._robot = new Robot(this.els.robot, this.getCurPos());
    this._actionsManager = new ActionsManager(
      this.els.actions,
      this.onActionsManagerUpdate.bind(this),
      this.getActionsAtIndex()
    );
    this.error = new ErrorManager(
      this.els.canvas,
      this.getCurPos(),
      this.DimProvider,
      this.onErrorManagerUpdate.bind(this)
    );
  }

  protected onActionsManagerUpdate(actions: ACTION[]): void {
    this.setCurActions(actions);
    this.onEdit();
  }
  protected onErrorManagerUpdate(marginOfError: number) {
    this.setCurError(marginOfError);
    this.onEdit();
  }

  protected get robotPos(): PhysicalPos {
    return this._robot.getIRLPos();
  }

  /** @throws will throw if index outside of array bounds */
  public goToIndex(index: number = this.index): void {
    this.index = index;
    this.updateManagers();
  }
  public goToNext() {
    this.goToIndex(this._fixIndexWrap(++this.index));
  }
  public goToPrevious() {
    this.goToIndex(this._fixIndexWrap(--this.index));
  }
  public setCurNode(
    { position: pos, actions: acts }: Node,
    opts: { move: boolean } = { move: true }
  ) {
    if (opts.move)
      try {
        this._robot.goTo(this.upgradeToIRLPos(pos));
      } catch {}
    this.list.replace({
      index: this.index,
      newElement: {
        position: {
          marginOfError: pos.marginOfError,
          x: this.robotPos.x,
          y: this.robotPos.y,
          heading: this.robotPos.heading,
        },
        actions: acts,
      },
    });
    this._actionsManager.setActions(this.getActionsAtIndex());
    this.error.update(this.getCurPos());
  }
  public setCurActions(actions?: ACTION[]) {
    this.setCurNode({ position: this.getCurPos(), actions }, { move: false });
  }
  public setCurError(marginOfError: number) {
    const { position, actions } = this.getCurNode();
    this.setCurNode(
      { position: { ...position, marginOfError }, actions },
      { move: false }
    );
  }
  public moveRobotTo(pos: Partial<PhysicalPos>) {
    const { position, actions } = this.getCurNode();
    this.setCurNode({ position: { ...position, ...pos }, actions });
  }
  public insertAfterCurNode(node: Node) {
    this.list.insert({ newElement: node, index: ++this.index });
    this.onEdit();
    this.goToIndex();
  }
  /** checks if index is in bounds, if not, it will return it in bounds using modulo*/
  public _fixIndexWrap(index: number = this.index): number {
    return (index =
      (index < 0 ? this.list.length - 1 : 0) + (index % this.list.length));
  }
  /** checks if index is in bounds, if not, it will return it in bounds by shifting the number in bounds*/
  public _fixIndexShift(index: number = this.index): number {
    return (index = Math.min(Math.max(index, 0), this.list.length - 1));
  }
  public appendNode(node: Node) {
    this.list.add({ newElement: node });
    this.onEdit();
  }
  public removeNodeAt(index: number = this.index) {
    if (this.list.length > 1) {
      this.list.remove({ index: this.index });
      this.index = this._fixIndexShift();
      this.updateRobotPos();
      this.updateActions();
    }
    this.onEdit();
    this.updateManagers();
  }
  public removeCurNode() {
    this.removeNodeAt();
  }
  public getCurPos(): PhysicalPos & HasMarginOfError {
    return this.getPosAtIndex();
  }
  public getCurError(): number {
    return this.getCurPos().marginOfError;
  }
  public getCurNode(): Node {
    return this.getNodeAtIndex();
  }
  public getCurActions(): ACTION[] | undefined {
    return this.getActionsAtIndex();
  }
  protected updateRobotPos() {
    try {
      this._robot.goTo(this.getCurPos());
    } catch {}
  }
  protected updateError() {
    this.error.update(this.getCurPos());
  }
  protected updateActions() {
    this._actionsManager.setActions(this.getCurActions());
  }
  public updateManagers() {
    this.updateActions();
    this.updateRobotPos();
    this.updateError();
  }
  // public removeNode() {

  // }
  public update({
    content,
    edits = [],
  }: {
    content?: Node[];
    edits: ListAction<Node>[];
  }) {
    // console.log("update", structuredClone({ content, edits }));
    this.list.update(content, edits);
    // this.moveRobotTo({});
    this.updateManagers();
    // this.setCurNode({ position: { x: 0, y: 0, heading: 0 } }, { move: false });
  }
  public appendNewNode() {
    this.appendNode(this.newNode);
  }
  public insertNewNodeAfterCur() {
    this.insertAfterCurNode(this.newNode);
  }
  public get index(): number {
    return this._index;
  }
  public set index(index: number) {
    this._index = index;
    this.onIndexUpdate(index);
  }
}
// https://stackoverflow.com/a/51365037
type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};
