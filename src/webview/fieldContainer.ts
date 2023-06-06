import { Coordinate } from "../common/coordinates";

export class FieldContainer {
  constructor(protected _field: SVGSVGElement) {}

  get field(): SVGSVGElement {
    return this._field;
  }

  clientCoordToFieldCoord({ x, y }: Coordinate): SVGPoint {
		// helped by chat gpt: https://chat.openai.com/share/8d963542-9c11-45de-a349-d299fcc86833
		// Get coord into a DOMPoint
    const svgPoint = this.field.createSVGPoint();
    svgPoint.x = x;
    svgPoint.y = y;

    // Point now has scale of user coordinate system
    const svgPointScaled = svgPoint.matrixTransform(
      this.field.getScreenCTM()?.inverse()
    );
    // Rotate point to match target coordinate system (match lemlib coordinates)
    return svgPointScaled.matrixTransform(
      this.field.createSVGMatrix().flipY()
    );
  }
}
