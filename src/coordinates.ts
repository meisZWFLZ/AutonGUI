class Coordinate {
  public x: number;
  public y: number;
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class Position extends Coordinate {
  public heading: number;
  constructor(x: number, y: number, heading: number) {
    super(x, y);
    this.heading = heading;
  }
}

abstract class _DimensionProvider {
  public abstract get robotOffsetWidth(): number;
  public abstract get fieldWidth(): number;
  /** gets the coordinate of the top left corner of field relative to the view port */
  public abstract get fieldCoord(): Coordinate;
}


abstract class ConvertibleCoordinate extends Coordinate {
  public static DimensionProvider = _DimensionProvider;
  protected dimProvider: _DimensionProvider;

  public constructor(x: number, y: number, dimProvider: _DimensionProvider) {
    super(x, y);
    this.dimProvider = dimProvider;
  }
  public abstract toRelative(): Relative;
  public abstract toAbsolute(): Absolute;
  public abstract toPhysical(): Physical;
}
/** length of physical field in inches */
const irlFieldLength: number = 2 * 6 * 12;
// Should custom annotations be used here?
// ex - @origin
/**
 * Measures pixels relative to field html element.
 * The bottom left of field is the origin (Blue goal corner for Spin Up).
 */
class Relative extends ConvertibleCoordinate {
  /**
   * @deprecated conversion to self
   */
  toRelative(): Relative {
    console.warn("converting to self!");
    return this;
  }
  toAbsolute(): Absolute {
    const fieldCoord = this.dimProvider.fieldCoord;
    return {
      ...this,
      x: this.x + fieldCoord.x,
      y: this.dimProvider.fieldWidth + fieldCoord.y - this.y
    }
  }
  toPhysical(): Physical {
    const pxPerInch = this.dimProvider.fieldWidth / irlFieldLength;
    const halfRobotWidth = this.dimProvider.robotOffsetWidth / 2;
    return {
      ...this,
      x: (this.x + halfRobotWidth) / pxPerInch,
      y: (this.y + halfRobotWidth) / pxPerInch,
    };
  }

};
/**
 * Measures pixels relative to viewport.
 * The top left of viewport is the origin.
 */
class Absolute extends ConvertibleCoordinate {
  toRelative(): Relative {
    const fieldCoord = this.dimProvider.fieldCoord;
    return {
      ...this,
      x: this.x - fieldCoord.x,
      y: this.y - this.dimProvider.fieldWidth - fieldCoord.y
    }
  }
  /**
   * @deprecated conversion to self
   */
  toAbsolute(): Absolute {
    console.warn("converting to self!");
    return this;
  }
  toPhysical(): Physical {
    return this.toRelative().toPhysical();
  }
};
/**
 * Measures inches relative to physical field.
 * The bottom left of field is the origin (Blue goal corner for Spin Up).
 */
class Physical extends ConvertibleCoordinate {
  toRelative(): Relative {
    const pxPerInch = this.dimProvider.fieldWidth / irlFieldLength;
    const halfRobotWidth = this.dimProvider.robotOffsetWidth / 2;
    return {
      ...this,
      x: this.x * pxPerInch - halfRobotWidth,
      y: this.y * pxPerInch - halfRobotWidth,
    };
  }
  toAbsolute(): Absolute {
    return this.toRelative().toAbsolute();
  }
  /**
   * @deprecated conversion to self
   */
  toPhysical(): Physical {
    console.warn("converting to self!");
    return this;
  }

};