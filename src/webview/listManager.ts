import {
  Coordinate,
  DimensionProvider,
  PhysicalPos,
  Position,
  Rotatable,
} from "../common/coordinates.js";
import { Node } from "../common/node.js";
import NodeList from "./../common/nodeList.js";
import { Robot } from "./robot.js";
export default class ListManager {
  public _robot: Robot;
  private upgradeToIRLPos(pos: Partial<PhysicalPos>): PhysicalPos {
    return new PhysicalPos(
      {
        ...(this.pos || { x: 0, y: 0, heading: 0 }),
        ...pos,
      },
      this.dimProvider
    );
  }
  /** @throws will throw if index outside of array bounds */
  protected getNodeAtIndex(index: number = this.index): Node {
    if (index >= this.list.length || index < 0)
      throw new Error("out of array bounds");
    return this.list.get({ index })[0];
  }
  /** @throws will throw if index outside of array bounds */
  protected getAtIndex(index: number = this.index): PhysicalPos {
    return this.upgradeToIRLPos(this.getNodeAtIndex(index).position);
  }

  /** @throws will throw if index outside of array bounds */
  constructor(
    robotEl: HTMLElement,
    public list: NodeList = new NodeList(),
    public index: number = 0,
    protected dimProvider: DimensionProvider
  ) {
    this._robot = new Robot(robotEl, this.getAtIndex());
  }
  protected get pos(): PhysicalPos {
    return this._robot?.getIRLPos();
  }
  /** @throws will throw if index outside of array bounds */
  public goToIndex(index: number): void {
    this.index = index;
    this._robot.goTo(this.getAtIndex());
  }
  /** @throws will throw if index outside of array bounds */
  public goToNext() {
    this.goToIndex(++this.index);
  }
  /** @throws will throw if index outside of array bounds */
  public goToPrevious() {
    this.goToIndex(--this.index);
  }
  public setCurrNode({ position: pos, actions: acts }: RecursivePartial<Node>) {
    if (pos && pos !== this.pos) this._robot.goTo(this.upgradeToIRLPos(pos));
    else if (!acts) return;
    let { position, actions } = this.getNodeAtIndex();
    this.list.replace(this.index, {
      position: { ...position, ...pos },
      actions:
        actions || acts ? [...(actions || []), ...(acts || [])] : undefined,
    });
  }
  public moveRobotTo(pos: Partial<PhysicalPos>) {
    this.setCurrNode({ position: pos });
  }
  public getCurPos(): PhysicalPos {
    return this.pos;
  }
  public getCurNode(): Node {
    return this.getNodeAtIndex();
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
