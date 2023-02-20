class Coordinate {
  public x: number;
  public y: number;
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor({ x, y }: { x: number, y: number }) {
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
  constructor(pos: { x: number, y: number, heading: number }) {
    super(pos);
    this.heading = pos.heading;
  }
}
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

abstract class ConvertibleCoordinate extends Coordinate {
  public _dimProvider: DimensionProvider;
  /**
   *  @see DimensionProvider
  */
  public constructor(coord: Coordinate, dimProvider: DimensionProvider) {
    super(coord);
    this._dimProvider = dimProvider;
  }

  public abstract toRelative(): Relative;
  public abstract toAbsolute(): Absolute;
  public abstract toPhysical(): Physical;

  // public static Generator = class {
  //   protected dimProvider: DimensionProvider;
  //   constructor(dimProvider: DimensionProvider) {
  //     this.dimProvider = dimProvider;
  //   }
  //   public newRelative(coord: Coordinate): Relative {
  //     return new Relative(coord, this.dimProvider);
  //   }
  //   public newAbsolute(coord: Coordinate): Absolute {
  //     return new Absolute(coord, this.dimProvider);
  //   }
  //   public newPhysical(coord: Coordinate): Physical {
  //     return new Physical(coord, this.dimProvider);
  //   }
  // };
  // public toJSON() {
  //   const out = Object.fromEntries(Object.entries({ ...this }).filter((e: [string, any]) => {
  //     console.log({ e, dimP: this._dimProvider });
  //     // return (typeof e[1] != "object") || Object.entries(e[1]).some(f => DimensionProvider.prototype);
  //     return !(e[1] instanceof DimensionProvider);
  //   }));
  //   console.log(out);
  //   return out;
  // }
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
    return new Absolute({
      ...this,
      x: this.x + fieldCoord.x,
      y: this._dimProvider.fieldWidth + fieldCoord.y - this.y
    }, this._dimProvider);
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
    return new Physical({
      ...this,
      x: (this.x + halfRobotWidth) / pxPerInch,
      y: (-this.y + halfRobotWidth) / pxPerInch,
    }, this._dimProvider);
    // return {
    //   ...this,
    //   x: (this.x + halfRobotWidth) / pxPerInch,
    //   y: (-this.y + halfRobotWidth) / pxPerInch,
    // };
  }
  /** untested */
  public static fromCenter(coord: Coordinate, dimProvider: DimensionProvider): Relative {
    const halfRobotWidth = dimProvider.robotOffsetWidth / 2;
    return new Relative(
      {
        ...coord,
        x: coord.x - halfRobotWidth,
        y: coord.y - halfRobotWidth,
      },
      dimProvider,
    );
  };
  /** untested */
  public getCenter(): Coordinate {
    const halfRobotWidth = this._dimProvider.robotOffsetWidth / 2;
    return new Coordinate(
      {
        ...this,
        x: this.x + halfRobotWidth,
        y: this.y + halfRobotWidth,
      }
    );
  }
};
/**
 * Measures top left of robot in pixels relative to viewport.
 * The top left of viewport is the origin.
*/
class Absolute extends ConvertibleCoordinate {
  public toRelative(): Relative {
    const fieldCoord = this._dimProvider.fieldCoord;
    return new Relative({
      ...this,
      x: this.x - fieldCoord.x,
      y: this.y - this._dimProvider.fieldWidth - fieldCoord.y
    }, this._dimProvider);
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
  public static fromCenter(coord: Coordinate, dimProvider: DimensionProvider): Absolute {
    const halfRobotWidth = dimProvider.robotOffsetWidth / 2;
    return new Absolute(
      {
        ...coord,
        x: coord.x - halfRobotWidth,
        y: coord.y + halfRobotWidth,
      },
      dimProvider,
    );
  };
  /** untested */
  public getCenter(): Coordinate {
    const halfRobotWidth = this._dimProvider.robotOffsetWidth / 2;
    console.log(this)
    return new Coordinate(
      {
        ...this,
        x: this.x + halfRobotWidth,
        y: this.y - halfRobotWidth,
      }
    );
  }
};
/**
 * Measures center of robot in inches relative to physical field.
 * The bottom left of field is the origin (Blue goal corner for Spin Up).
*/
class Physical extends ConvertibleCoordinate {
  public toRelative(): Relative {
    const pxPerInch = this._dimProvider.fieldWidth / irlFieldLength;
    const halfRobotWidth = this._dimProvider.robotOffsetWidth / 2;
    return new Relative({
      ...this,
      x: this.x * pxPerInch - halfRobotWidth,
      y: -(this.y * pxPerInch - halfRobotWidth),
    }, this._dimProvider);
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
};
class RelativePos extends Relative implements Rotatable {
  public heading: number;
  constructor(pos: { x: number, y: number, heading: number }, dimProvider: DimensionProvider) {
    super(pos, dimProvider);
    this.heading = pos.heading;
  }
}
class AbsolutePos extends Absolute implements Rotatable {
  public heading: number;
  constructor(pos: { x: number, y: number, heading: number }, dimProvider: DimensionProvider) {
    super(pos, dimProvider);
    this.heading = pos.heading;
  }
}
class PhysicalPos extends Physical implements Rotatable {
  public heading: number;
  constructor(pos: { x: number, y: number, heading: number }, dimProvider: DimensionProvider) {
    super(pos, dimProvider);
    this.heading = pos.heading;
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
  DimensionProvider
}

