// @ts-check

import {
  AbsolutePos,
  ConvertibleCoordinate,
  Coordinate,
  CoordinateUtilities,
  DimensionProvider,
  HasMarginOfError,
  RelativeCoord,
} from "../common/coordinates.js";

export type Circle = Coordinate & {
  radius: number;
};

/** circle that will update graphically whenever modified (all measurements in px)*/
export class DrawableCircle implements Circle {
  /**
   * @param width width of canvas
   * @param height height of canvas
   * @param opts.clear should the canvas be cleared before drawing
   */
  public constructor(
    private _center: Coordinate,
    private _radius: number,
    protected context: CanvasRenderingContext2D,
    protected canvasDims: { get width(): number; get height(): number },
    protected opts: {
      clear: boolean;
      circumferenceWidth: number;
      strokeStyle: typeof context.strokeStyle;
    } = {
      clear: true,
      circumferenceWidth: 10,
      strokeStyle: "red",
    }
  ) {
    this.draw();
  }

  public draw() {
    if (this.opts.clear)
      this.context.clearRect(
        0,
        0,
        this.canvasDims.width,
        this.canvasDims.height
      );
    this.context.strokeStyle = this.opts.strokeStyle;
    this.context.beginPath();
    this.context.lineWidth = this.opts.circumferenceWidth; // make circle thicker
    this.context.arc(
      this._center.x,
      this._center.y + this.canvasDims.height,
      // 100,
      // 100,
      this._radius,
      0,
      2 * Math.PI
    );
    this.context.stroke();
    console.log("draw", { ...this.center, this: this });
  }

  public get center(): Coordinate {
    return this._center;
  }
  public set center(c: Coordinate) {
    this._center = c;
    this.draw();
  }
  public get radius(): number {
    return this._radius;
  }
  public set radius(r: number) {
    this._radius = r;
    this.draw();
  }
  public get x(): number {
    return this._center.x;
  }
  public set x(x1: number) {
    this.center.x = x1;
    this.draw();
  }
  public get y(): number {
    return this._center.y;
  }
  public set y(y1: number) {
    this.center.y = y1;
    this.draw();
  }
}

export class LengthConverter {
  private static get irlFieldLength(): number {
    return 12 * 2 * 6;
  }
  protected pxPerInch: Readonly<number>;
  constructor(dimProvider: DimensionProvider) {
    this.pxPerInch = dimProvider.fieldWidth / LengthConverter.irlFieldLength;
  }
  public inches = new (class inches {
    constructor(private outerClass: LengthConverter) {}
    public toPX(inches: number): number {
      console.log({ inches, pxPerInch: this.outerClass.pxPerInch });
      return inches * this.outerClass.pxPerInch;
    }
  })(this);
  public px = new (class px {
    public constructor(private outerClass: LengthConverter) {}
    public toInches(px: number): number {
      console.log({ px, pxPerInch: this.outerClass.pxPerInch });
      return px / this.outerClass.pxPerInch;
    }
  })(this);
}
export default class ErrorManager implements HasMarginOfError {
  protected context: CanvasRenderingContext2D;
  protected circle: DrawableCircle;
  protected lenConverter: LengthConverter;

  /**
   * default value for {@link opts}.distanceFromCircumference.
   * defines how far can the click be from the circumference to register (in px)
   * @see {@link opts}
   */
  static readonly defaultDistanceFromCircumference = 10;

  /** @memberof opts defines far can the click be from the circumference to register (in px) */
  constructor(
    protected canvas: HTMLCanvasElement,
    robotCoord: ConvertibleCoordinate & HasMarginOfError,
    protected _dimProvider: DimensionProvider,
    public onErrorChanged?: (marginOfError: number) => void,
    protected readonly opts?: {
      lineWidth?: number;
      distanceFromCircumference?: number;
    }
  ) {
    this.lenConverter = new LengthConverter(_dimProvider);

    let _context = canvas.getContext("2d");
    if (!_context) throw "no context";

    this.context = _context;
    this.circle = new DrawableCircle(
      robotCoord.toRelative().getCenter(),
      this.lenConverter.inches.toPX(robotCoord.marginOfError),
      this.context,
      this.canvas,
      { circumferenceWidth: 5, clear: true, strokeStyle: "red" }
    );

    this.registerEventListeners(canvas);
  }

  public get marginOfError(): number {
    return this.lenConverter.px.toInches(this.circle.radius);
  }
  public set marginOfError(marginOfError: number) {
    this.circle.radius = this.lenConverter.inches.toPX(marginOfError);
  }

  public update(
    coord: ConvertibleCoordinate & HasMarginOfError,
    opts: { emitChangeEvent: boolean } = { emitChangeEvent: false }
  ) {
    if (CoordinateUtilities.hasMarginOfError(coord)) {
      this.marginOfError = coord.marginOfError;
      if (opts.emitChangeEvent) this.onErrorChanged?.(this.marginOfError);
    }
    if (CoordinateUtilities.isCoordinate(coord))
      this.circle.center = coord.toRelative().getCenter();
  }

  /** @param mouse in px */
  protected isMouseOnCircumference(mouse: ConvertibleCoordinate): boolean {
    const distance = CoordinateUtilities.distance(
      this.circle,
      mouse.toRelative().getCenter()
    );
    const difference = distance - this.circle.radius;
    const abs = Math.abs(difference);
    const distFrCir =
      this.opts?.distanceFromCircumference ??
      ErrorManager.defaultDistanceFromCircumference;
    const out = abs < distFrCir;
    console.log({
      mouse: mouse.toRelative().getCenter(),
      circle: this.circle,
      distance,
      difference,
      abs,
      distFrCir,
      out,
      this: this,
    });

    return out;
  }

  /** @param circumferentialPt in px */
  protected setRadiusUsingCircumferentialPt(
    circumferentialPt: ConvertibleCoordinate
  ) {
    this.circle.radius = CoordinateUtilities.distance(
      this.circle,
      circumferentialPt.toRelative().getCenter()
    );
  }

  private registerEventListeners(el: HTMLElement): void {
    el.addEventListener("mousedown", this.onmousedown.bind(this));
    el.addEventListener("mouseup", this.onmouseup.bind(this));
    el.addEventListener("mousemove", this.onmousemove.bind(this));
  }

  private dragging: boolean = false;
  private onmousedown(ev: MouseEvent) {
    console.log("mousedown", this, "ev", ev);
    if (
      (this.dragging = this.isMouseOnCircumference(
        AbsolutePos.fromCenter(ev, this._dimProvider)
      ))
    )
      return;
    const bottomEl = document.elementsFromPoint(ev.x, ev.y)[1] as HTMLElement;
    // const entries = Object.entries(ev);
    // console.log("entries", structuredClone(entries));
    // const newEvOpts = Object.fromEntries(
    //   entries.filter(([k, v]: [string, any]) => {
    //     console.log(k);
    //     return [
    //       "screenX",
    //       "screenY",
    //       "clientX",
    //       "clientY",
    //       "ctrlKey",
    //       // "shiftKey",
    //       "altKey",
    //       // "metaKey",
    //       // "button",
    //       // "buttons",
    //       // "relatedTarget",
    //       // "region",
    //     ].includes(k);
    //   })
    // );
    // console.log(newEvOpts);

    const newEv = new MouseEvent(
      "mousedown",
      ev /* {
      altKey: ev.altKey,
      button: ev.button,
      buttons: ev.buttons,
    } */
    );

    console.log("bottomEl", bottomEl, "newEv", newEv);
    bottomEl.dispatchEvent(newEv);
  }
  private onmouseup() {
    if (this.dragging) this.onErrorChanged?.(this.marginOfError);
    this.dragging = false;
  }
  private onmousemove(coord: MouseEvent) {
    if (this.dragging)
      this.setRadiusUsingCircumferentialPt(
        AbsolutePos.fromCenter(coord, this._dimProvider)
      );
  }
}
