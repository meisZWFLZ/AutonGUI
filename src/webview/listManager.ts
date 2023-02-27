import {
  Coordinate,
  DimensionProvider,
  PhysicalPos,
  Position,
  Rotatable,
} from "../common/coordinates.js";
import { ACTION, Node } from "../common/node.js";
import ActionsManager from "./actionsManager.js";
import { ListAction } from "./eventList.js";
import NodeList from "./nodeList.js";
import { Robot } from "./robot.js";

export default class ListManager {
  public _robot: Robot;
  public _actionsManager: ActionsManager;
  static readonly newNode: Node = { position: { x: 72, y: 72, heading: 0 } };
  private upgradeToIRLPos(pos: Partial<PhysicalPos>): PhysicalPos {
    return new PhysicalPos(
      {
        ...(this.robotPos || { x: 0, y: 0, heading: 0 }),
        ...pos,
      },
      this.dimProvider
    );
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
  protected getPosAtIndex(index: number = this.index): PhysicalPos {
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
    robotEl: HTMLElement,
    actionContainer: HTMLElement,
    public list: NodeList = new NodeList(),
    private _index: number = 0,
    protected dimProvider: DimensionProvider,
    private onActionsUpdate: (actions: ACTION[]) => void,
    private onIndexUpdate: (index: number) => void
  ) {
    if (this.list.length <= 0)
      this.list.update([{ position: { x: 0, y: 0 } } as Node]);
    this._robot = new Robot(robotEl, this.getPosAtIndex());
    this._actionsManager = new ActionsManager(
      actionContainer,
      this.onActionsManagerUpdate.bind(this),
      this.getActionsAtIndex()
    );
  }

  protected onActionsManagerUpdate(actions: ACTION[]): void {
    this.setCurrActions(actions);
    this.onActionsUpdate(actions);
  }
  protected get robotPos(): PhysicalPos {
    return this._robot?.getIRLPos();
  }
  /** @throws will throw if index outside of array bounds */
  public goToIndex(index: number): void {
    this.index = index;
    this._robot.goTo(this.getPosAtIndex());
    this._actionsManager.setActions(this.getActionsAtIndex());
  }
  /** @throws will throw if index outside of array bounds */
  public goToNext() {
    this.goToIndex((this.index + 1) % this.list.length);
  }
  /** @throws will throw if index outside of array bounds */
  public goToPrevious() {
    this.goToIndex(
      (this.index > 0 ? this.index - 1 : this.list.length - 1) %
        this.list.length
    );
  }
  public setCurrNode(
    { position: pos, actions: acts }: Node,
    opts: { move: boolean } = { move: true }
  ) {
    this.list.replace({
      index: this.index,
      newElement: {
        position: pos,
        actions: acts,
      },
    });
    if (opts.move)
      try {
        this._robot.goTo(this.getCurPos());
      } catch {}
    this._actionsManager.setActions(this.getActionsAtIndex());
  }
  public setCurrActions(actions?: ACTION[]) {
    this.setCurrNode({ position: this.getCurPos(), actions }, { move: false });
  }
  public insertAfterCurNode(node: Node) {
    this.list.insert({ newElement: node, index: this.index + 1 });
    this.index++;
  }
  public appendNode(node: Node) {
    this.list.add({ newElement: node });
  }
  public moveRobotTo(pos: Partial<PhysicalPos>) {
    const { position, actions } = this.getCurNode();
    this.setCurrNode({ position: { ...position, ...pos }, actions });
  }
  public getCurPos(): PhysicalPos {
    return this.getPosAtIndex();
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
  protected updateActions() {
    this._actionsManager.setActions(this.getCurActions());
  }
  public update({
    content,
    edits = [],
  }: {
    content?: Node[];
    edits: ListAction<Node>[];
  }) {
    console.log("update", structuredClone({ content, edits }));
    this.list.update(content, edits);
    // this.moveRobotTo({});
    this.updateActions();
    this.updateRobotPos();
    // this.setCurrNode({ position: { x: 0, y: 0, heading: 0 } }, { move: false });
  }
  public appendNewNode() {
    this.appendNode(ListManager.newNode);
  }
  public insertNewNodeAfterCur() {
    this.insertAfterCurNode(ListManager.newNode);
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
