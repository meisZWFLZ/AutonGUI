import {
  Coordinate,
  Position,
  ConvertibleCoordinate,
  RelativeCoord,
  AbsoluteCoord,
  PhysicalCoord,
  RelativePos,
  AbsolutePos,
  PhysicalPos,
} from "../out/coordinates";

/* 
In this document, I often use the terms "IRL", "Rel", and "Abs" to refers to the dimensions and measurements
"IRL" - inches of the physical field
"Rel" - pixels relative to field
"Abs" - pixels relative to window

IRL and Rel positions utilize the bottom left corner of the field as the origin
(Blue goal corner for Spin Up)
*/

// const irlFieldLength = 2 * 6 * 12;

const field = document.querySelector(".field");
if (!this.field) throw "no field";
const fieldBounds = field.getBoundingClientRect();

export class Robot {
  // /**
  //  * convert IRL inches to pixels relative to field element
  //  * @param {{x: number, y: number}} irlPos
  //  * @returns {{x: number, y: number}}
  //  */
  // static #convertIRLToRel(irlPos) {
  //   const pxPerInch = fieldBounds.width / irlFieldLength;
  //   const halfRobotWidth = this.robot.offsetWidth / 2;
  //   return {
  //     // if field ever becomes rectangular, this will not work
  //     x: irlPos.x * pxPerInch - halfRobotWidth,
  //     y: irlPos.y * pxPerInch - halfRobotWidth,
  //   };
  // }
  /*
  compute inverse:
  f(x) = x * (fw / ifl) - row / 2;
  x = y * (fw / ifl) - row / 2;
  x + row / 2 = y * ( fw / ifl );
  (x + row / 2) / ( fw / ifl ) = y;
  (x + row / 2) / ( fw / ifl ) = f-1(x);
  */
  // /**
  //  * convert IRL inches to pixels relative to field element
  //  * @param {{x: number, y: number}} relPos
  //  * @returns {{x: number, y: number}}
  //  */
  // static #convertRelToIRL(relPos) {
  //   const pxPerInch = fieldBounds.width / irlFieldLength;
  //   const halfRobotWidth = this.robot.offsetWidth / 2;
  //   return {
  //     // if field ever becomes rectangular, this will not work
  //     x: (relPos.x + halfRobotWidth) / pxPerInch,
  //     y: (relPos.y + halfRobotWidth) / pxPerInch,
  //   };
  // }
  /**
   * in inches of physical field
   * @returns {PhysicalPos}
   */
  getIRLPos() {
    return pos;
  }
  /**
   * in pixels relative to window
   * @returns {AbsoluteCoord}
   */
  getAbsPos() {
    const robotBounds = this.robot.getBoundingClientRect();
    const halfRobotWidth = this.robot.offsetWidth / 2;
    return {
      x: robotBounds.left + halfRobotWidth,
      y: robotBounds.top + halfRobotWidth,
    };
  }
  /**
   * move bot to IRL pos
   * @param {PhysicalPos} pos
   */
  goTo(pos = this.#pos) {
    if (
      (pos.x == undefined || pos.x == this.#pos.x) &&
      (pos.y == undefined || pos.y == this.#pos.y) &&
      (pos.heading == undefined || pos.heading == this.#pos.heading)
    )
      throw "no change in robot position";
    this.#setPos(pos);
  }

  /**
   * reset position to last recorded position (for resizing)
   */
  resetPos() {
    this.#setPos(this.#pos);
  }

  /**
   * move bot to IRL pos
   * @param {PhysicalPos} pos
   */
  #setPos(pos) {
    // if (pos.heading != undefined) this.#pos.heading = pos.heading;
    // if (pos.x != undefined) this.#pos.x = pos.x;
    // if (pos.y != undefined) this.#pos.y = pos.y;
    this.#pos = { ...this.#pos, ...pos };

    this.#pos.heading = Math.round(this.#pos.heading);

    const horizontalRadius = Math.ceil(
      ((Math.sqrt(2 * Math.pow(this.#radiusIRL, 2)) - this.#radiusIRL) *
        (1 - Math.cos((4 * this.#pos.heading * Math.PI) / 180))) /
        2 +
        this.#radiusIRL
    );

    // maximum possible x pos for bot
    const maxX = irlFieldLength - horizontalRadius;

    this.#pos.x = Math.max(Math.min(Math.round(this.#pos.x), maxX), horizontalRadius);
    this.#pos.y = Math.max(Math.min(Math.round(this.#pos.y), maxX), horizontalRadius);

    // console.log(robotBounds);
    const relPos = pos.toRelative();
    const transform = `translate(${relPos.x}px, ${
      relPos.y
    }px)rotate(${(this.#pos.heading %= 360)}deg)`;
    this.robot.animate([{ transform: this.robot.style.transform }, { transform }], {
      duration: opts.duration,
    });
    // @ts-ignore
    return (this.robot.style.transform = transform);
  }

  /**
   * @param {Element} element
   * @param {PhysicalPos} pos
   * @param {{followCursor: boolean}} opts
   */
  constructor(element, pos, opts = { followCursor: true }) {
    this.robot = element;
    this.#pos = pos;
    // could be changed for custom robot length
    this.#lengthIRL = 18;
    this.#radiusIRL = 18 / 2; // half or length
  }
}
