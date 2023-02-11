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

interface Rotatable {
  get heading(): number;
  set heading(a: number);
};

class Position extends Coordinate implements Rotatable {
  public heading: number;
  constructor(x: number, y: number, heading: number) {
    super(x, y);
    this.heading = heading;
  }
}
/** responsible for retrieving the dimensions of elements required to convert coordinate systems */
abstract class _DimensionProvider {
  /**
   * gets the offset width of the robot element
   * @example robotEl.offsetWidth
   */
  public abstract get robotOffsetWidth(): number;
  /**
   * gets the width of field element
   * @example field.getBoundingClientRect().width;
   */
  public abstract get fieldWidth(): number;
  /**
   * gets the coordinate of the top left corner of field relative to the view port 
   * @example field.getBoundClientRect()
  */
  public abstract get fieldCoord(): Coordinate;
}
abstract class ConvertibleCoordinate extends Coordinate {
  public static DimensionProvider = _DimensionProvider;
  protected dimProvider: _DimensionProvider;

  /** @see _DimensionProvider */
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
  public toRelative(): Relative {
    console.warn("converting to self!");
    return this;
  }
  public toAbsolute(): Absolute {
    const fieldCoord = this.dimProvider.fieldCoord;
    return {
      ...this,
      x: this.x + fieldCoord.x,
      y: this.dimProvider.fieldWidth + fieldCoord.y - this.y
    }
  }
  public toPhysical(): Physical {
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
  public toRelative(): Relative {
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
  public toAbsolute(): Absolute {
    console.warn("converting to self!");
    return this;
  }
  public toPhysical(): Physical {
    return this.toRelative().toPhysical();
  }
};
/**
 * Measures inches relative to physical field.
 * The bottom left of field is the origin (Blue goal corner for Spin Up).
*/
class Physical extends ConvertibleCoordinate {
  public toRelative(): Relative {
    const pxPerInch = this.dimProvider.fieldWidth / irlFieldLength;
    const halfRobotWidth = this.dimProvider.robotOffsetWidth / 2;
    return {
      ...this,
      x: this.x * pxPerInch - halfRobotWidth,
      y: this.y * pxPerInch - halfRobotWidth,
    };
  }
  public toAbsolute(): Absolute {
    return this.toRelative().toAbsolute();
  }
  /**
   * @deprecated conversion to self
  */
  public toPhysical(): Physical {
    console.warn("converting to self!");
    return this;
  }
};
class RelativePos extends Relative implements Rotatable {
  public heading: number;
  constructor(x: number, y: number, dimProvider: _DimensionProvider, heading: number) {
    super(x, y, dimProvider);
    this.heading = heading;
  }
}
class AbsolutePos extends Absolute implements Rotatable {
  public heading: number;
  constructor(x: number, y: number, dimProvider: _DimensionProvider, heading: number) {
    super(x, y, dimProvider);
    this.heading = heading;
  }
}
class PhysicalPos extends Physical implements Rotatable {
  public heading: number;
  constructor(x: number, y: number, dimProvider: _DimensionProvider, heading: number) {
    super(x, y, dimProvider);
    this.heading = heading;
  }
}

export {
  Coordinate,
  Position,
  ConvertibleCoordinate,
  Relative as RelativeCoord,
  Absolute as AbsoluteCoord,
  Physical as PhysicalCoord,
  RelativePos,
  AbsolutePos,
  PhysicalPos,
}