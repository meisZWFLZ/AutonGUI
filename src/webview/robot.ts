import {
  AbsoluteCoord,
  AbsolutePos,
  PhysicalCoord,
  PhysicalPos,
  RelativeCoord,
} from "../common/coordinates.js";
// console.log(Coordinates)
// let { AbsoluteCoord, PhysicalCoord, PhysicalPos } = Coordinates;
/* 
In this document, I often use the terms "IRL", "Rel", and "Abs" to refers to the dimensions and measurements
"IRL" - inches of the physical field
"Rel" - pixels relative to field
"Abs" - pixels relative to window

IRL and Rel positions utilize the bottom left corner of the field as the origin
(Blue goal corner for Spin Up)
*/

const irlFieldLength: number = 2 * 6 * 12;

// const field = document.querySelector(".field");
// if (!field) throw "no field";
// const fieldBounds = field.getBoundingClientRect();

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
  robotEl: HTMLElement;

  /**
   * in inches of physical field
   * @returns {PhysicalPos}
   */
  getIRLPos(): PhysicalPos {
    return this.#pos;
  }
  /**
   * in pixels relative to window
   * @returns {AbsolutePos}
   */
  getAbsPos(): AbsoluteCoord {
    const robotBounds = this.robotEl.getBoundingClientRect();
    const halfRobotWidth = this.robotEl.offsetWidth / 2;
    return AbsolutePos.fromCenter(
      {
        ...this.#setPos,
        x: robotBounds.left + halfRobotWidth,
        y: robotBounds.top + halfRobotWidth,
      },
      this.#pos._dimProvider
    );
  }
  /**
   * move bot to IRL pos
   * @param {PhysicalPos | PhysicalCoord | {heading: number}} pos
   */
  goTo(pos: any = this.#pos, opts: { duration: number } = { duration: 200 }) {
    pos = new PhysicalPos({ ...this.#pos, ...pos }, this.#pos._dimProvider);
    // console.log(pos);
    if (
      pos.x == this.#pos.x &&
      pos.y == this.#pos.y &&
      pos.heading == this.#pos.heading
    ) {
      throw "no change in robot position";
    }
    this.#setPos(pos, opts);
  }

  /**
   * reset position to last recorded position (for resizing)
   */
  resetPos(opts: { duration: number } = { duration: 200 }) {
    this.#setPos(this.#pos, opts);
  }

  /**
   * move bot to IRL pos
   * @param {PhysicalPos} pos
   */
  #setPos(
    pos: PhysicalPos,
    opts: { duration: number } = { duration: 200 }
  ): string {
    // if (pos.heading != undefined) this.#pos.heading = pos.heading;
    // if (pos.x != undefined) this.#pos.x = pos.x;
    // if (pos.y != undefined) this.#pos.y = pos.y;
    this.#pos = pos;

    this.#pos.heading = Math.round(this.#pos.heading);

    const horizontalRadius = Math.ceil(
      ((Math.sqrt(2 * Math.pow(this.#radiusIRL, 2)) - this.#radiusIRL) *
        (1 - Math.cos((4 * this.#pos.heading * Math.PI) / 180))) /
        2 +
        this.#radiusIRL
    );

    // maximum possible x pos for bot
    const maxX = irlFieldLength - horizontalRadius;

    this.#pos.x = Math.max(
      Math.min(Math.round(this.#pos.x), maxX),
      horizontalRadius
    );
    this.#pos.y = Math.max(
      Math.min(Math.round(this.#pos.y), maxX),
      horizontalRadius
    );

    // console.log(pos);
    const relPos = pos.toRelative();
    const transform = `translate(${relPos.x}px, ${
      relPos.y
    }px)rotate(${(this.#pos.heading %= 360)}deg)`;
    this.robotEl.animate(
      [{ transform: this.robotEl.style.transform }, { transform }],
      {
        duration: opts.duration,
      }
    );
    // @ts-ignore
    return (this.robotEl.style.transform = transform);
  }
  #pos: PhysicalPos;
  // #lengthIRL;
  #radiusIRL: number;
  /**
   * @param {Element} element
   * @param {PhysicalPos} pos
   * @param {{followCursor: boolean}} opts
   */
  constructor(
    element: HTMLElement,
    pos: PhysicalPos /* opts = { followCursor: true } */
  ) {
    this.robotEl = element;
    this.#pos = pos;
    // could be changed for custom robot length
    // this.#lengthIRL = 18;
    this.#radiusIRL = 16.25 / 2; // half or length
    // rectangular robot bounding box formula: https://www.desmos.com/calculator/2l4skiytvz
  }
}
