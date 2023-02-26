import {
  Coordinate,
  DimensionProvider,
  PhysicalPos,
  Position,
  Rotatable,
} from "../common/coordinates.js";
import { Node } from "../common/node.js";
import { ListAction } from "./eventList";
import NodeList from "./nodeList.js";
import { Robot } from "./robot.js";
export default class ListManager {
  public _robot: Robot;
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
  constructor(
    robotEl: HTMLElement,
    public list: NodeList = new NodeList(),
    public index: number = 0,
    protected dimProvider: DimensionProvider
  ) {
    if (this.list.length <= 0)
      this.list.update([{ position: { x: 0, y: 0 } } as Node]);
    this._robot = new Robot(robotEl, this.getPosAtIndex());
  }
  protected get robotPos(): PhysicalPos {
    return this._robot?.getIRLPos();
  }
  /** @throws will throw if index outside of array bounds */
  public goToIndex(index: number): void {
    this.index = index;
    this._robot.goTo(this.getPosAtIndex());
  }
  /** @throws will throw if index outside of array bounds */
  public goToNext() {
    this.index++;
    this.goToIndex((this.index %= this.list.length));
  }
  /** @throws will throw if index outside of array bounds */
  public goToPrevious() {
    this.index--;
    this.goToIndex((this.index %= this.list.length));
  }
  public setCurrNode({ position: pos, actions: acts }: RecursivePartial<Node>) {
    let { position, actions } = this.getNodeAtIndex();
    this.list.replace({
      index: this.index,
      newElement: {
        position: { ...position, ...pos },
        actions:
          actions || acts ? [...(actions || []), ...(acts || [])] : undefined,
      },
    });
    this._robot.goTo(this.getCurPos());
  }
  public appendNode(node: Node) {
    this.list.add({ newElement: node });
  }
  public moveRobotTo(pos: Partial<PhysicalPos>) {
    this.setCurrNode({ position: pos });
  }
  public getCurPos(): PhysicalPos {
    return this.getPosAtIndex();
  }
  public getCurNode(): Node {
    return this.getNodeAtIndex();
  }
  public update({
    content,
    edits = [],
  }: {
    content?: Node[];
    edits: ListAction<Node>[];
  }) {
    this.list.update(content, edits);
    this.setCurrNode({});
  }
  public appendNewNode() {
    this.appendNode({ position: { x: 72, y: 72, heading: 0 } });
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
