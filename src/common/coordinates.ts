type Coordinate = {
  x: number;
  y: number;
};
type Rotatable = {
  /** degrees */
  heading: number;
};
type HasMarginOfError = {
  /** @member margin how far can the robot be from the target? in inches */
  marginOfError: number;
};

type Position = Coordinate & Rotatable;
/** responsible for retrieving the dimensions of elements required to convert coordinate systems */
abstract class DimensionProvider {
  /**
   * gets the offset width of the robot element
   * @example robotEl.offsetWidth
   */
  public abstract get robotOffsetWidth(): number;
  /**
   * gets the width of field element in pixels
   * @example field.getBoundingClientRect().width;
   */
  public abstract get fieldWidth(): number;
  /**
   * gets the coordinate of the top left corner of field relative to the view port
   * @example field.getBoundingClientRect()
   */
  public abstract get fieldCoord(): Coordinate;
  public toJSON() {
    return undefined;
  }
}

abstract class ConvertibleCoordinate implements Coordinate {
  public x: number;
  public y: number;
  public _dimProvider: DimensionProvider;
  /**
   *  @see DimensionProvider
   */
  public constructor(
    { x = 0, y = 0 }: Coordinate,
    dimProvider: DimensionProvider
  ) {
    this.x = x;
    this.y = y;
    this._dimProvider = dimProvider;
  }
  // public static Generator = class Generator {
  //   constructor(protected _dimProvider: DimensionProvider) {}
  //   public get dimProvider(): DimensionProvider {
  //     return this._dimProvider;
  //   }
  // };
  public abstract toRelative(): Relative;
  public abstract toAbsolute(): Absolute;
  public abstract toPhysical(): Physical;
}

/** length of physical field in inches */
const irlFieldLength: number = 2 * 6 * 12;
// Should custom annotations be used here?
// ex - @origin

/**
 * Measures top left of robot in pixels relative to field html element.
 * The top left of field is the origin.
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
    const fieldCoord = this._dimProvider.fieldCoord;
    return new Absolute(
      {
        ...this,
        x: this.x + fieldCoord.x,
        y: this._dimProvider.fieldWidth + fieldCoord.y + this.y,
      },
      this._dimProvider
    );
    // return {
    //   ...this,
    //   x: this.x + fieldCoord.x,
    //   y: this._dimProvider.fieldWidth + fieldCoord.y - this.y
    // }
  }
  public toPhysical(): Physical {
    const pxPerInch = this._dimProvider.fieldWidth / irlFieldLength;
    const halfRobotWidth = this._dimProvider.robotOffsetWidth / 2;
    // console.log(halfRobotWidth);
    return new Physical(
      {
        ...this,
        x: (this.x + halfRobotWidth) / pxPerInch,
        y: (-this.y + halfRobotWidth) / pxPerInch,
      },
      this._dimProvider
    );
    // return {
    //   ...this,
    //   x: (this.x + halfRobotWidth) / pxPerInch,
    //   y: (-this.y + halfRobotWidth) / pxPerInch,
    // };
  }
  /** untested */
  public static fromCenter(
    coord: Coordinate,
    dimProvider: DimensionProvider
  ): Relative {
    const halfRobotWidth = dimProvider.robotOffsetWidth / 2;
    return new Relative(
      {
        ...coord,
        x: coord.x - halfRobotWidth,
        y: coord.y + halfRobotWidth,
      },
      dimProvider
    );
  }
  /** untested */
  public getCenter(): Coordinate {
    const halfRobotWidth = this._dimProvider.robotOffsetWidth / 2;
    return {
      x: this.x + halfRobotWidth,
      y: this.y - halfRobotWidth,
    };
  }
}
/**
 * Measures top left of robot in pixels relative to viewport.
 * The top left of viewport is the origin.
 */
class Absolute extends ConvertibleCoordinate {
  public toRelative(): Relative {
    const fieldCoord = this._dimProvider.fieldCoord;
    return new Relative(
      {
        ...this,
        x: this.x - fieldCoord.x,
        y: this.y - this._dimProvider.fieldWidth - fieldCoord.y,
      },
      this._dimProvider
    );
    // return {
    //   ...this,
    //   x: this.x - fieldCoord.x,
    //   y: this.y - this._dimProvider.fieldWidth - fieldCoord.y
    // }
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
  public static fromCenter(
    coord: Coordinate,
    dimProvider: DimensionProvider
  ): Absolute {
    const halfRobotWidth = dimProvider.robotOffsetWidth / 2;
    return new Absolute(
      {
        ...coord,
        x: coord.x - halfRobotWidth,
        y: coord.y + halfRobotWidth,
      },
      dimProvider
    );
  }

  public getCenter(): Coordinate {
    const halfRobotWidth = this._dimProvider.robotOffsetWidth / 2;
    // console.log(this)
    return {
      x: this.x + halfRobotWidth,
      y: this.y - halfRobotWidth,
    };
  }
}
/**
 * Measures center of robot in inches relative to physical field.
 * The bottom left of field is the origin (Blue goal corner for Spin Up).
 */
class Physical extends ConvertibleCoordinate {
  public toRelative(): Relative {
    const pxPerInch = this._dimProvider.fieldWidth / irlFieldLength;
    const halfRobotWidth = this._dimProvider.robotOffsetWidth / 2;
    return new Relative(
      {
        ...this,
        x: this.x * pxPerInch - halfRobotWidth,
        y: -(this.y * pxPerInch - halfRobotWidth),
      },
      this._dimProvider
    );
    // return {
    //   ...this,
    //   x: this.x * pxPerInch - halfRobotWidth,
    //   y: -(this.y * pxPerInch - halfRobotWidth),
    // };
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
}

type ConvertiblePosition = ConvertibleCoordinate & Rotatable;
// abstract class ConvertiblePosition
//   extends ConvertibleCoordinate
//   implements Rotatable
// {
//   public heading: number;
//   constructor(
//     { x = 0, y = 0, heading = 0 }: Position,
//     dimProvider: DimensionProvider
//   ) {
//     super({ x, y }, dimProvider);
//     this.heading = heading;
//   }
// }

// class RelativePos extends Relative implements ConvertiblePosition {
//   public heading!: number;
// }
class RelativePos extends Relative implements ConvertiblePosition {
  public heading: number;
  constructor(
    pos: { x: number; y: number; heading: number },
    dimProvider: DimensionProvider
  ) {
    super(pos, dimProvider);
    this.heading = pos.heading;
  }
}

// class AbsolutePos extends Absolute implements ConvertiblePosition {
//   public heading!: number;
// }
class AbsolutePos extends Absolute implements ConvertiblePosition {
  public heading: number;
  constructor(
    pos: { x: number; y: number; heading: number },
    dimProvider: DimensionProvider
  ) {
    super(pos, dimProvider);
    this.heading = pos.heading;
  }
}
// class PhysicalPos extends Physical implements ConvertiblePosition {
//   public heading!: number;
// }
class PhysicalPos extends Physical implements ConvertiblePosition {
  public heading: number;
  constructor(
    pos: { x: number; y: number; heading: number },
    dimProvider: DimensionProvider
  ) {
    super(pos, dimProvider);
    this.heading = pos.heading;
  }
}

class CoordinateUtilities {
  static distance(
    { x: x1, y: y1 }: Coordinate,
    { x: x2, y: y2 }: Coordinate
  ): number {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }
  static hasMarginOfError(obj: any): obj is HasMarginOfError {
    return "marginOfError" in obj && typeof obj.marginOfError == "number";
  }
  static isCoordinate(obj: any): obj is Coordinate {
    return (
      "x" in obj &&
      "y" in obj &&
      typeof obj.x == "number" &&
      typeof obj.y == "number"
    );
  }
  static isRotatable(obj: any): obj is Rotatable {
    return "heading" in obj && typeof obj.heading == "number";
  }
  static isPosition(obj: any): obj is Position {
    return this.isCoordinate(obj) && this.isRotatable(obj);
  }
}
// export default {
//   Coordinate,
//   Position,
//   ConvertibleCoordinate,
//   RelativeCoord: Relative,
//   AbsoluteCoord: Absolute,
//   PhysicalCoord: Physical,
//   RelativePos,
//   AbsolutePos,
//   PhysicalPos,
//   default: 1,
// };

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
  DimensionProvider,
  Rotatable,
  HasMarginOfError,
  ConvertiblePosition,
  CoordinateUtilities,
};
