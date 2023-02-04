export class Robot {
	getIRLPos(); // in inches, relative to game
	getAbsPos(); // in pixels, relative to window or smth 
	goTo();
	constructor(/** @type {HTMLElement} */ element) {
		this.robot = element;
	}
}