import { Context } from "vm";
import {
  AbsoluteCoord,
  ConvertibleCoordinate,
  Coordinate,
  CoordinateUtilities,
  DimensionProvider,
  HasMarginOfError,
  PhysicalCoord,
  RelativeCoord,
} from "../common/coordinates";

export type Circle = Coordinate & {
  radius: number;
};

/** circle that will update graphically whenever modified (all measurements in px)*/
export class DrawableCircle implements Circle {
  protected width: number;
  protected height: number;

  /**
   * @param width width of canvas
   * @param height height of canvas
   * @param opts.clear should the canvas be cleared before drawing
   */
  public constructor(
    private _center: Coordinate,
    private _radius: number,
    protected context: Context,
    { width, height }: { width: number; height: number },
    protected opts: { clear: boolean; circumferenceWidth: number } = {
      clear: true,
      circumferenceWidth: 10,
    }
  ) {
    this.width = width;
    this.height = height;
    this.draw();
  }

  public draw() {
    if (this.opts.clear) this.context.clearRect(0, 0, this.width, this.height);
    this.context.beginPath();
    this.context.lineWidth = this.opts.circumferenceWidth; // make circle thicker
    this.context.arc(
      this._center.x,
      this._center.y,
      this._radius,
      0,
      2 * Math.PI
    );
    this.context.stroke();
  }

  public get center(): Coordinate {
    return this._center;
  }
  public set center(c: Coordinate) {
    this.draw();
    this._center = c;
  }
  public get radius(): number {
    return this._radius;
  }
  public set radius(r: number) {
    this.draw();
    this._radius = r;
  }
  public get x(): number {
    return this._center.x;
  }
  public set x(x1: number) {
    this.draw();
    this.center.x = x1;
  }
  public get y(): number {
    return this._center.y;
  }
  public set y(y1: number) {
    this.draw();
    this.center.y = y1;
  }
}

export class LengthConverter {
  private static irlFieldLength = 12 * 2 * 6;
  protected pxPerInch: Readonly<number>;
  constructor(dimProvider: DimensionProvider) {
    this.pxPerInch = dimProvider.fieldWidth / LengthConverter.irlFieldLength;
  }
  public inches = new (class inches {
    constructor(private outerClass: LengthConverter) {}
    public toPX(inches: number): number {
      return inches * this.outerClass.pxPerInch;
    }
  })(this);
  public px = new (class px {
    public constructor(private outerClass: LengthConverter) {}
    public toInches(px: number): number {
      return px / this.outerClass.pxPerInch;
    }
  })(this);
}
export default class ErrorManager implements HasMarginOfError {
  protected context: Context;
  protected circle: DrawableCircle;
  protected lenConverter: LengthConverter;

  /** how far can the click be from the circumference to register (in px) */
  protected static distanceFromCircumference = 10;
  constructor(
    protected canvas: HTMLCanvasElement,
    robotCoord: ConvertibleCoordinate & HasMarginOfError,
    protected _dimProvider: DimensionProvider,
    public onErrorChanged?: (marginOfError: number) => void
  ) {
    let _context = canvas.getContext("2d");
    if (!_context) throw "no context";
    this.context = _context;
    this.circle = new DrawableCircle(
      robotCoord.toAbsolute(),
      0,
      this.context,
      this.canvas
    );
    this.lenConverter = new LengthConverter(_dimProvider);
  }

  public get marginOfError(): number {
    return this.lenConverter.px.toInches(this.circle.radius);
  }
  public set marginOfError(marginOfError: number) {
    this.circle.radius = this.lenConverter.inches.toPX(marginOfError);
  }

  public update(
    coord: ConvertibleCoordinate | HasMarginOfError,
    opts: { emitChangeEvent: boolean } = { emitChangeEvent: false }
  ) {
    if (CoordinateUtilities.hasMarginOfError(coord)) {
      this.circle.radius = coord.marginOfError;
      if (opts.emitChangeEvent) this.onErrorChanged?.(this.circle.radius);
    }
    if (CoordinateUtilities.isCoordinate(coord)) this.circle.center = coord;
  }

  /** @param mouse in px */
  protected isMouseOnCircumference(mouse: Coordinate): boolean {
    return (
      CoordinateUtilities.distance(this.circle, mouse) - this.circle.radius <
      ErrorManager.distanceFromCircumference
    );
  }

  /** @param circumferentialPt in px */
  protected setRadiusUsingCircumferentialPt(circumferentialPt: AbsoluteCoord) {
    return CoordinateUtilities.distance(this.circle, circumferentialPt);
  }

  private dragging: boolean = false;
  private onmousedown(coord: MouseEvent) {
    this.dragging = this.isMouseOnCircumference(
      new AbsoluteCoord(coord, this._dimProvider)
    );
  }
  private onmouseup() {
    if (this.dragging) this.onErrorChanged?.(this.circle.radius);
    this.dragging = false;
  }
  private onmousemove(coord: MouseEvent) {
    if (this.dragging)
      this.setRadiusUsingCircumferentialPt(
        new AbsoluteCoord(coord, this._dimProvider)
      );
  }
}
