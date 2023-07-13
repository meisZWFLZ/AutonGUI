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
  protected dimensions: {
    width: number;
    height: number;
  };
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
    options?: {
      dimensions?: {
        width: number;
        height: number;
      };
      visibility?: "hidden" | "visible";
    }
  ) {
    this._pos = pos;
    this.dimensions = options?.dimensions ?? GameObject.getDimensions(el);
    if (options?.visibility)
      if (options.visibility == "hidden") this.hide();
      else this.show();
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
   * Restricts {@link pos} such that robot stays within field boundaries and rounds each value to 2 decimal places
   * @param pos position to be restricted
   *
   * Restricts to 140.40 inches as defined in {@link https://content.vexrobotics.com/docs/23-24/vrc-overunder/VRC-23-24-GameManual-0.1-Release.pdf#page=83 VRC Over Under Game Manual: Page A8}
   */
  private restrictPosition(pos: Position = this.pos): Position {
    const { height, width } = this.getBoundingRectangleDimensions(pos);
    const maxX = (140.4 - width) / 2;
    const maxY = (140.4 - height) / 2;
    const roundTo2Places = (n: number) => Math.round(n * 100) / 100;
    return {
      heading: roundTo2Places(pos.heading),
      x: roundTo2Places(Math.max(-maxX, Math.min(maxX, pos.x))),
      y: roundTo2Places(Math.max(-maxY, Math.min(maxY, pos.y))),
    };
  }
  setPosition(newPos: Partial<Position>, reason: string[]) {
    const restrictedPos = this.restrictPosition({
      x: newPos.x ?? this.pos.x,
      y: newPos.y ?? this.pos.y,
      heading: newPos.heading ?? this.pos.heading,
    });
    if (
      restrictedPos.x === this.pos.x &&
      restrictedPos.y === this.pos.y &&
      restrictedPos.heading === this.pos.heading
      && !reason.includes("webview.DraggableGameObject.onMouseUp")
    )
      return;
    this._pos = { ...this.pos, ...restrictedPos };
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
  hide() {
    this.el.setAttribute("visibility", "hidden");
  }
  show() {
    this.el.setAttribute("visibility", "visible");
  }

  static Draggable = class DraggableGameObject extends GameObject {
    private _draggable: boolean;
    constructor(
      el: SVGImageElement,
      field: FieldContainer,
      pos: Position,
      options: ConstructorParameters<typeof GameObject>[3] & {
        draggable: boolean;
      }
    ) {
      super(el, field, pos, options);
      this._draggable = options?.draggable;
      this.manageDragListeners();
    }
    get draggable() {
      return this._draggable;
    }
    set draggable(draggable) {
      if (draggable === this._draggable) return;
      this._draggable = draggable;
      this.manageDragListeners();
    }
    /** will add listener if draggable == true or remove listener if draggable == false */
    private manageDragListeners() {
      if (this.draggable)
        this.el.addEventListener("mousedown", this.onMouseDown);
      else this.el.removeEventListener("mousedown", this.onMouseDown);
    }
    private onMouseDrag = ((ev: MouseEvent, reason: string[] = []) =>
      this.setPosition(
        this.field.clientCoordToFieldCoord(ev),
        reason.concat("webview.DraggableGameObject.onMouseDrag")
      )).bind(this);
    private onMouseUp = ((ev: MouseEvent) => {
      this.field.field.removeEventListener("mousemove", this.onMouseDrag);
      this.field.field.removeEventListener("mouseup", this.onMouseUp);
      this.onMouseDrag(ev, ["webview.DraggableGameObject.onMouseUp"]);
    }).bind(this);

    protected onMouseDown = ((ev: MouseEvent) => {
      this.field.field.addEventListener("mousemove", this.onMouseDrag);
      this.field.field.addEventListener("mouseup", this.onMouseUp);
      this.onMouseDrag(ev, ["webview.DraggableGameObject.onMouseDown"]);
    }).bind(this);
  };
}
