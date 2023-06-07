import { SimpleEventDispatcher } from "strongly-typed-events";
import { Position, Rotatable } from "../common/coordinates";
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
  private static getDimensions(el: SVGImageElement): {
    width: number;
    height: number;
  } {
    return {
      width: el.width.baseVal.value,
      height: el.height.baseVal.value,
    };
  }

  constructor(
    protected el: SVGImageElement,
    protected readonly field: FieldContainer,
    pos: Position,
    protected dimensions: {
      width: number;
      height: number;
    } = GameObject.getDimensions(el)
  ) {
    this._pos = pos;
  }
  get pos(): Position {
    return this._pos;
  }
  /**
   * returns the dimensions of the smallest rectangle, with parallel sides to the coordinate grid, capable of containing a rectangle with {@link dimensions} and {@link rotation}
   * @desmos https://www.desmos.com/calculator/2l4skiytvz
   */
  private getBoundingRectangleDimensions(
    { heading: rotation }: Rotatable = this.pos
  ): {
    width: number;
    height: number;
  } {
    return {
      width:
        Math.abs(this.dimensions.width * Math.cos(rotation)) +
        Math.abs(this.dimensions.height * Math.sin(rotation)),
      height:
        Math.abs(this.dimensions.height * Math.cos(rotation)) +
        Math.abs(this.dimensions.width * Math.sin(rotation)),
    };
  }
  /**
   * Restricts {@link pos} such that robot stays within field boundaries
   * @param pos position to be restricted
   *
   * Restricts to 140.40 inches as defined in {@link https://content.vexrobotics.com/docs/23-24/vrc-overunder/VRC-23-24-GameManual-0.1-Release.pdf#page=83 VRC Over Under Game Manual: Page A8}
   */
  private restrictPosition(pos: Position = this.pos): Position {
    const { height, width } = this.getBoundingRectangleDimensions(pos);
    const maxX = (140.4 - width) / 2;
    const maxY = (140.4 - height) / 2;
    return {
      heading: pos.heading,
      x: Math.max(-maxX, Math.min(maxX, pos.x)),
      y: Math.max(-maxY, Math.min(maxY, pos.y)),
    };
  }
  setPosition(
    {
      x = this.pos.x,
      y = this.pos.y,
      heading = this.pos.heading,
    }: Partial<Position>,
    reason: string[]
  ) {
    this._pos = this.restrictPosition({ x, y, heading });
    let transforms = this.el.transform.baseVal;
    let matrix = this.field.field
      .createSVGMatrix()
      .translate(this.pos.x, this.pos.y)
      .rotate(this.pos.heading);
    if (transforms.numberOfItems > 0) transforms.getItem(0).setMatrix(matrix);
    else
      transforms.appendItem(
        this.field.field.createSVGTransformFromMatrix(matrix)
      );
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
    const restrictedPos = this.restrictPosition({ x, y, heading });
    let animation = this.el.animate(
      [
        {
          transform: `translate(0,0) rotate(0)`,
          composite: "add",
          easing: "ease-in-out",
        },
        {
          transform: `translate(${restrictedPos.x}px,${restrictedPos.y}px) rotate(${restrictedPos.heading}deg)`,
        },
      ],
      animationOptions
    );
    // Wait for the animation to finish
    await animation.finished;
    this.setPosition(restrictedPos, reason);
  }
  static Draggable = class DraggableGameObject extends GameObject {
    constructor(
      el: SVGImageElement,
      field: FieldContainer,
      pos: Position,
      dimensions?: {
        width: number;
        height: number;
      },
      private _draggable: boolean = true
    ) {
      super(el, field, pos, dimensions);
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
