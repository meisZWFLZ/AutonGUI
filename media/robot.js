const fieldLength = 2 * 6 * 12;
class Robot {
  /**
   * in inches, relative to game
   * @returns {{heading: number, x: number, y: number}}
   */
  getIRLPos() {}
  /**
   * in pixels, relative to window or smth
   * @returns {{heading: number, x: number, y: number}}
   */
  getAbsPos() {}
  /**
   * move bot to IRL pos
   * @param {{heading: number, x: number, y: number}} pos
   */
  goTo(pos = this.#pos) {
    if (
      opts.check &&
      (pos.x == undefined || pos.x == this.#pos.x) &&
      (pos.y == undefined || pos.y == this.#pos.y) &&
      (pos.heading == undefined || pos.heading == this.#pos.heading)
    )
      throw "no change in robot positon";
    this.#setPos(pos);
  }

  /**
   * reset position to last recorded position (for resizing)
   */
  resetPos() {
    this.#setPos(this.#pos);
  }
  /**
   * convert IRL inches to pixels relative to field element
   * @param {{x: number, y: number}} irlPos
   * @returns {{x: number, y: number}}
   */
  static #convertIRLToRel(irlPos) {
    return {
      x:
        irlPos.x * (fieldBounds.width / fieldLength) -
        this.robot.offsetWidth / 2,
      y:
        irlPos.y * (fieldBounds.width / fieldLength) -
        this.robot.offsetWidth / 2,
    };
  }

  /**
   * move bot to IRL pos
   * @param {{heading: number, x: number, y: number}} pos
   */
  #setPos(pos) {
    const fieldBounds = this.field.getBoundingClientRect();

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
    const maxX = fieldLength - horizontalRadius;

    this.#pos.x = Math.max(
      Math.min(Math.round(this.#pos.x), maxX),
      horizontalRadius
    );
    this.#pos.y = Math.max(
      Math.min(Math.round(this.#pos.y), maxX),
      horizontalRadius
    );

    // console.log(robotBounds);
    const relPos = Robot.#convertIRLToRel(this.#pos);
    const transform = `translate(${relPos.x}px, ${
      relPos.y
    }px)rotate(${(this.#pos.heading %= 360)}deg)`;
    this.robot.animate(
      [{ transform: this.robot.style.transform }, { transform }],
      { duration: opts.duration }
    );
    // @ts-ignore
    return (this.robot.style.transform = transform);
  }
  constructor(/** @type {HTMLElement} */ element) {
    this.robot = element;
    this.#pos = getIRLPos();
    // could be changed for custom robot length
    this.#lengthIRL = 18;
    this.#radiusIRL = 18 / 2; // half or length
  }
}
