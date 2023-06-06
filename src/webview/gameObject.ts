import { SimpleEventDispatcher } from "strongly-typed-events";
import { Position } from "../common/coordinates";
import { FieldContainer } from "./fieldContainer";

export class GameObject {
  private _pos: Position;
  private _onDidChangePosition: SimpleEventDispatcher<{
    pos: Position;
    reason: string[];
  }> = new SimpleEventDispatcher();
  public get onDidChangePosition() {
    return this._onDidChangePosition.asEvent();
  }
  constructor(
    protected el: SVGImageElement,
    protected readonly field: FieldContainer,
    pos: Position
  ) {
    this._pos = pos;
  }
  get pos(): Position {
    return this._pos;
  }
  setPosition(
    {
      x = this.pos.x,
      y = this.pos.y,
      heading = this.pos.heading,
    }: Partial<Position>,
    reason: string[]
  ) {
    let transforms = this.el.transform.baseVal;
    let matrix = this.field.field
      .createSVGMatrix()
      .translate(x, y)
      .rotate(heading);
    if (transforms.numberOfItems > 0) transforms.getItem(0).setMatrix(matrix);
    else
      transforms.appendItem(
        this.field.field.createSVGTransformFromMatrix(matrix)
      );
    this._pos = { x, y, heading };
    this._onDidChangePosition.dispatch({ pos: this._pos, reason });
  }
  async animateMove(
    {
      x = this.pos.x,
      y = this.pos.y,
      heading = this.pos.heading,
    }: Partial<Position>,
    reason: string[],
    animationOptions: Parameters<SVGSVGElement["animate"]>[1] = {
      duration: 1000,
    }
  ) {
    let animation = this.el.animate(
      [
        {
          transform: `translate(0,0) rotate(0)`,
          composite: "add",
          easing: "ease-in-out",
        },
        {
          transform: `translate(${x}px,${y}px) rotate(${heading}deg)`,
        },
      ],
      animationOptions
    );
    // Wait for the animation to finish
    await animation.finished;
    this.setPosition({ x, y, heading }, reason);
  }
  static Draggable = class DraggableGameObject extends GameObject {
    constructor(
      protected el: SVGImageElement,
      protected readonly field: FieldContainer,
      pos: Position,
      private _draggable: boolean = true
    ) {
      super(el, field, pos);
      this.manageDragListeners();
    }
    get draggable() {
      return this._draggable;
    }
    set draggable(draggable) {
      if (draggable !== this._draggable) this.manageDragListeners();
      this._draggable = draggable;
    }
    /** will add listener if draggable == true or remove listener if draggable == false */
    private manageDragListeners() {
      if (this.draggable)
        this.el.addEventListener("mousedown", this.onMouseDown);
      else this.el.removeEventListener("mousedown", this.onMouseDown);
    }
    private onMouseDrag = ((ev: MouseEvent) =>
      this.setPosition(this.field.clientCoordToFieldCoord(ev), [
        "webview.DraggableGameObject.onMouseDrag",
      ])).bind(this);
    private onMouseUp = (() => {
      this.field.field.removeEventListener("mousemove", this.onMouseDrag);
      this.field.field.removeEventListener("mouseup", this.onMouseUp);
    }).bind(this);

    protected onMouseDown = ((ev: MouseEvent) => {
      this.field.field.addEventListener("mousemove", this.onMouseDrag);
      this.field.field.addEventListener("mouseup", this.onMouseUp);
      this.onMouseDrag(ev);
    }).bind(this);
  };
}
