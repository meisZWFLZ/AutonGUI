// @ts-check

import {
  AbsoluteCoord,
  ConvertibleCoordinate,
  Coordinate,
  DimensionProvider,
  PhysicalCoord,
  PhysicalPos,
  Position,
  Rotatable,
} from "../common/coordinates.js";
import Message from "../common/message.js";
import NodeList from "./nodeList.js";
import type { Action, Node as MyNode } from "../common/node.js";
import ListManager from "./listManager.js";
import { ListAction, LIST_ACTION_TYPE } from "./eventList.js";

// @ts-ignore
const vscode = acquireVsCodeApi();

class JSONConversions {
  static toUint8Array(obj: any): Uint8Array {
    return new Uint8Array(
      Array.from(JSON.stringify(obj)).map((e) => e.charCodeAt(0))
    );
  }
  static toJSON(data: Uint8Array): any {
    return JSON.parse(String.fromCharCode(...data));
  }
  static fromJSON = this.toUint8Array;
  static fromUint8Array = this.toJSON;
}
class MyNodeClass implements MyNode {
  position: Position = { x: 0, y: 0, heading: 0 };
  actions?: Action[] | undefined;
}

// /**
//  * @param {Uint8Array} initialContent
//  * @return {Promise<HTMLImageElement>}
//  */
// async function loadImageFromData(initialContent) {
//   const blob = new Blob([initialContent], { type: "image/png" });
//   const url = URL.createObjectURL(blob);
//   try {
//     const img = document.createElement("img");
//     img.crossOrigin = "anonymous";
//     img.src = url;
//     await new Promise((resolve, reject) => {
//       img.onload = resolve;
//       img.onerror = reject;
//     });
//     return img;
//   } finally {
//     URL.revokeObjectURL(url);
//   }
// }

class PawDrawEditor {
  ready: boolean;
  editable: boolean;
  dimProvider: DimensionProvider;
  // robot: Robot;
  startList: NodeList | undefined;
  listManager: ListManager;

  constructor(/** @type {HTMLElement} */ parent: HTMLElement) {
    this.ready = false;

    this.editable = false;

    const field = document.querySelector(".field");
    if (!field) throw "no field";

    const robotEl: HTMLElement | null = document.querySelector(".robot");
    if (robotEl) {
      /** used for initializing new Convertible Coordinates */
      this.dimProvider = new (class extends DimensionProvider {
        get robotOffsetWidth() {
          return robotEl.offsetWidth;
        }
        get fieldWidth() {
          return field.getBoundingClientRect().width;
        }
        get fieldCoord() {
          return field.getBoundingClientRect();
        }
      })();
      this.listManager = new ListManager(
        robotEl,
        new NodeList(),
        0,
        this.dimProvider
      );
      // this.robot = new Robot(
      //   robotEl,
      //   new PhysicalPos({ x: 0, y: 0, heading: 0 }, this.dimProvider)
      // );
    } else throw "no robot";

    // this.robotPos = { x: 0, y: 0, heading: 0 };

    // // they are the same, but in future, might be different to accommodate custom robot dimensions
    // this.robotHeight = this.robot.getBoundingClientRect().height;
    // this.robotWidth = this.robot.getBoundingClientRect().width;

    // this.drawingColor = "black";
    // console.log(this.robotPos);

    // /** @type {Array<Stroke>} */
    // this.strokes = [];

    // /** @type {Stroke | undefined} */
    // this.currentStroke = undefined;

    this._initElements(parent);
  }

  // addPoint(/** @type {number} */ x, /** @type {number} */ y) {
  // 	if (this.currentStroke) {
  // 		this.currentStroke.addPoint(x, y)
  // 	}
  // }

  // beginStoke(/** @type {string} */ color) {
  // 	this.currentStroke = new Stroke(color);
  // 	this.strokes.push(this.currentStroke);
  // }

  // endStroke() {
  // 	const previous = this.currentStroke;
  // 	this.currentStroke = undefined;
  // 	return previous;
  // }

  setEditable(editable: boolean) {
    this.editable = editable;
    const colorButtons: NodeListOf<HTMLButtonElement> =
      document.querySelectorAll(".drawing-controls button");
    for (const colorButton of Array.from(colorButtons)) {
      colorButton.disabled = !editable;
    }
  }
  // /**
  //  * @returns {{x: number, y: number}};
  //  */
  // getLocalFieldPos(/** @type {{x: number, y: number}} */ globalPos) {
  //   const fieldLength = 2 * 6 * 12; // field length in inches

  //   const fieldBounds = this.field.getBoundingClientRect();

  //   // get center of robot in px in relation to field
  //   let pos = {
  //     x: globalPos.x - fieldBounds.x,
  //     y: fieldBounds.bottom - globalPos.y,
  //   };

  //   // translate to inches
  //   pos.x /= fieldBounds.width / fieldLength;
  //   pos.y /= fieldBounds.height / fieldLength;

  //   // pos.x = Math.round(pos.x / 3) * 3;
  //   // pos.y = Math.round(pos.y / 3) * 3;

  //   // console.log(pos);
  //   return pos;
  // }

  // /**
  //  * @returns {{x: number, y: number}};
  //  */
  // getRobotAbsoluteCenter() {
  //   const robotBounds = this.robot.getBoundingClientRect();
  //   return {
  //     x: this.robot.offsetWidth / 2 + robotBounds.left,
  //     y: robotBounds.top + this.robot.offsetHeight / 2,
  //   };
  // }

  // /**
  //  * @returns {{heading: number, x: number, y: number}};
  //  */
  // getRobotPosition() {
  //   let getHeading = (el) => {
  //     try {
  //       const transformValues = window
  //         .getComputedStyle(el)
  //         .getPropertyValue("transform")
  //         .split("(")[1]
  //         .split(")")[0]
  //         .split(",");
  //       console.log(transformValues);
  //       // const rotation =
  //       //   Math.round(
  //       //     Math.atan2(
  //       //       parseFloat(transformValues[1]),
  //       //       parseFloat(transformValues[0])
  //       //     )
  //       //   ) *
  //       //   (180 / Math.PI);
  //       // const rotation = Math.round(
  //       //   Math.asin(parseFloat(transformValues[1])) * (180 / Math.PI)
  //       // );
  //       return Math.round(Math.asin(parseFloat(transformValues[1])) * (180 / Math.PI));
  //     } catch {
  //       return 0;
  //     }
  //   };
  //   // const fieldLength = 2 * 6 * 12; // field length in inches

  //   // const fieldBounds = this.field.getBoundingClientRect();
  //   // const robotBounds = this.robot.getBoundingClientRect();

  //   // // get center of robot in px in relation to field
  //   // let pos = {
  //   //   heading: getHeading(this.robot),
  //   //   x: robotBounds.width / 2 + robotBounds.left - fieldBounds.x,
  //   //   y: fieldBounds.bottom - robotBounds.top - robotBounds.height / 2,
  //   // };

  //   // // translate to inches
  //   // pos.x /= fieldBounds.width / fieldLength;
  //   // pos.y /= fieldBounds.height / fieldLength;

  //   // console.log(pos);
  //   // return pos;
  //   const robotCenter = this.getRobotAbsoluteCenter(); /* = {
  //     x: this.robot.offsetWidth / 2 + robotBounds.left,
  //     y: robotBounds.top + this.robot.offsetHeight / 2,
  //   }; */
  //   let pos = {
  //     ...this.getLocalFieldPos(robotCenter),
  //     heading: getHeading(this.robot),
  //   };
  //   console.log(pos);
  //   return pos;
  // }

  // setRobotPosition(
  //   /** @type {{heading?: number, x?: number, y?: number}} */ pos,
  //   /** @type {{duration?: number, check: boolean}} */ opts = {
  //     duration: 200,
  //     check: true,
  //   }
  // ) {
  //   if (
  //     opts.check &&
  //     (pos.x == undefined || pos.x == this.robotPos.x) &&
  //     (pos.y == undefined || pos.y == this.robotPos.y) &&
  //     (pos.heading == undefined || pos.heading == this.robotPos.heading)
  //   )
  //     throw "no change in robot position";

  //   // pos.x = Math.max(widthHalf, Math.min(pos.x, fieldBounds.width - widthHalf));
  //   // pos.y =
  //   //  console.log({ pos: { ...pos }, robot: { ...this.robotPos } });

  //   const fieldLength = 2 * 6 * 12; // field length in inches

  //   const fieldBounds = this.field.getBoundingClientRect();
  //   const robotBounds = this.robot.getBoundingClientRect();

  //   if (pos.heading != undefined) this.robotPos.heading = pos.heading;

  //   const horizontalRadius = Math.ceil(
  //     ((Math.sqrt(2 * Math.pow(9 /*L*/, 2)) - 9) *
  //       // Math.cos((((Math.abs(this.robotPos.heading) + 45) % 90) * Math.PI) / 180);
  //       // (-Math.cos(((this.robotPos.heading%90) * Math.PI) / 180) +
  //       //   1 +
  //       //   Math.sqrt(1 / 2));
  //       (1 - Math.cos((4 * this.robotPos.heading * Math.PI) / 180))) /
  //       2 +
  //       9
  //   );

  //   if (pos.x != undefined) this.robotPos.x = pos.x;

  //   if (pos.y != undefined) this.robotPos.y = pos.y;

  //   // console.log({ heading: this.robotPos.heading, horizontalRadius });
  //   this.robotPos.x = Math.max(
  //     Math.min(Math.round(this.robotPos.x), fieldLength - horizontalRadius),
  //     horizontalRadius
  //   );
  //   this.robotPos.y = Math.max(
  //     Math.min(Math.round(this.robotPos.y), fieldLength - horizontalRadius),
  //     horizontalRadius
  //   );
  //   // if (!opts || !opts.editFin) {
  //   //   vscode.postMessage({
  //   //     type: "stroke",
  //   //     x: this.robotPos.x,
  //   //     y: this.robotPos.y,
  //   //     heading: this.robotPos.heading,
  //   //   });
  //   // }

  //   let width = robotBounds.width;
  //   let height = robotBounds.height;

  //   // console.log(robotBounds);

  //   const transform = `translate(${
  //     //   Math.max(
  //     //     width-this.robotWidth,
  //     //     Math.min(
  //     this.robotPos.x * (fieldBounds.width / fieldLength) - this.robot.offsetWidth / 2 /* , */
  //     //   fieldBounds.width - width
  //     // )
  //     // )
  //   }px, ${
  //     // Math.min(
  //     // height-this.robotHeight,
  //     // Math.max(
  //     -this.robotPos.y * (fieldBounds.height / fieldLength) + this.robot.offsetHeight / 2 /* , */
  //     //   -fieldBounds.height + height
  //     // )
  //     // )
  //   }px)rotate(${(this.robotPos.heading %= 360)}deg)`;
  //   this.robot.animate([{ transform: this.robot.style.transform }, { transform }], {
  //     duration: opts.duration,
  //   });
  //   // @ts-ignore
  //   return (this.robot.style.transform = transform);
  // }

  updateRobotPosition() {
    // throw new Error("function not implemented");
    console.log("update", this.listManager.getCurNode());
    vscode.postMessage(
      new Message.ToExtension.Edit(
        new ListAction.Replace<MyNode>(
          this.listManager.index,
          this.listManager.getCurNode()
        )
      )
    );

    // // console.log("update robot pos");
    // const pos = this.robot.getIRLPos();
    // // vscode.postMessage({
    // //   type: "stroke",
    // //   ...pos,
    // // });
    // vscode.postMessage(new Message.ToExtension.Edit())
  }

  _initElements(/** @type {HTMLElement} */ parent: HTMLElement) {
    let mouseMoveListener = (mouseClientPos: { x: number; y: number }) => {
      try {
        // let mousePos = this.getLocalFieldPos({ x, y });
        let mousePos: PhysicalCoord = AbsoluteCoord.fromCenter(
          mouseClientPos,
          this.dimProvider
        ).toPhysical();
        mousePos.x = Math.round(mousePos.x);
        mousePos.y = Math.round(mousePos.y);
        // this.setRobotPosition(mousePos);
        // this.robot.goTo(mousePos);
        this.listManager.moveRobotTo(mousePos);
      } catch (err) {
        /* console.log(err);  */
      }
    };
    let mouseRotateListener = ({ x, y }: { x: number; y: number }) => {
      // const robotCenter = this.getRobotAbsoluteCenter();
      // const robotCenter = this.robot.getAbsPos().getCenter();
      const robotCenter = this.listManager._robot.getAbsPos().getCenter();
      // console.log(JSON.stringify({ mouse: { x, y }, robot: robotCenter }));
      try {
        // this.setRobotPosition({
        // this.robot.goTo({
        this.listManager.moveRobotTo({
          // x: undefined,
          // y: undefined,
          // ...this.robotPos,
          heading: Math.round(
            Math.atan2(x - robotCenter.x, robotCenter.y - y) * (180 / Math.PI)
            //   /  10
          ) /* * 10, */,
        });
      } catch {}
    };
    // this.robot.addEventListener("mousedown", (ev) => {
    // this.robot.robotEl.addEventListener("mousedown", (ev) => {
    this.listManager._robot.robotEl.addEventListener("mousedown", (ev) => {
      // @ts-ignore
      if (!ev.altKey) {
        // case 0: //primary (left)
        document.addEventListener("mousemove", mouseMoveListener);
        document.addEventListener(
          "mouseup",
          () => {
            this.updateRobotPosition();
            document.removeEventListener("mousemove", mouseMoveListener);
          },
          { once: true }
        );
        return;
      } else {
        // case 2: // secondary (right)
        document.addEventListener("mousemove", mouseRotateListener);
        document.addEventListener(
          "mouseup",
          () => {
            this.updateRobotPosition();
            document.removeEventListener("mousemove", mouseRotateListener);
          },
          { once: true }
        );
        return;
      }
    });
    window.addEventListener("resize", () => {
      // this.setRobotPosition({}, { check: false });
      // this.robot.resetPos();
      this.listManager._robot.resetPos();
      console.log("resize");
    });

    window.addEventListener("keydown", (ev) => {
      if (!ev.ctrlKey && !ev.altKey) {
        // console.log(ev);
        // for moving
        let dir = null;
        switch (ev.key.toLowerCase()) {
          case "r":
            // return this.robot.goTo({
            return this.listManager.moveRobotTo({
              // ...this.robot.getIRLPos(),
              heading:
                this.listManager._robot.getIRLPos().heading +
                (ev.shiftKey ? -90 : 90),
            });
          case "arrowup":
          case "w":
            dir = { x: 0, y: 1 };
          case "arrowdown":
          case "s":
            if (!dir) dir = { x: 0, y: -1 };
          case "arrowleft":
          case "a":
            if (!dir) dir = { x: -1, y: 0 };
          case "arrowright":
          case "d":
            if (!dir) dir = { x: 1, y: 0 };
            let currRobotPos = this.listManager._robot.getIRLPos();
            // return this.setRobotPosition({
            return this.listManager.moveRobotTo({
              ...currRobotPos,
              x: currRobotPos.x + 3 * dir.x,
              y: currRobotPos.y + 3 * dir.y,
            });
          case "c":
            try {
              // this.setRobotPosition({ heading: 0 });
              this.listManager.moveRobotTo({ heading: 0 });
              this.updateRobotPosition();
            } catch {}
            return;
          case "n":
            this.listManager.appendNewNode();
            this.updateRobotPosition();
            return;
          case "j":
            this.listManager.goToPrevious();
            return;
          case "l":
            this.listManager.goToNext();
            return;
        }
      }
    });
    window.addEventListener("keyup", (ev) => {
      // console.log(ev);
      switch (ev.key.toLowerCase()) {
        case "r":
        case "arrowup":
        case "w":
        case "arrowdown":
        case "s":
        case "arrowleft":
        case "a":
        case "arrowright":
        case "d":
          this.updateRobotPosition();
          break;
      }
    });

    // const colorButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('.drawing-controls button'));
    // for (const colorButton of colorButtons) {
    // 	colorButton.addEventListener('click', e => {
    // 		e.stopPropagation();
    // 		colorButtons.forEach(button => button.classList.remove('active'));
    // 		colorButton.classList.add('active');
    // 		this.drawingColor = colorButton.dataset['color'];
    // 	});
    // }
    // Array.from(document.styleSheets)
    // const field = document.querySelector(".field");
    // if (field) {
    //   field.style.height = "100%";
    //   field.style.height = "100%";
    // }
    // this.wrapper = document.createElement("div");
    // this.wrapper.style.position = "relative";
    // parent.append(this.wrapper);

    // this.initialCanvas = document.createElement("canvas");
    // this.initialCtx = this.initialCanvas.getContext("2d");
    // this.wrapper.append(this.initialCanvas);

    // this.drawingCanvas = document.createElement("canvas");
    // this.drawingCanvas.style.position = "absolute";
    // this.drawingCanvas.style.top = "0";
    // this.drawingCanvas.style.left = "0";
    // this.drawingCtx = this.drawingCanvas.getContext("2d");
    // this.wrapper.append(this.drawingCanvas);

    // let isDrawing = false;

    // parent.addEventListener('mousedown', () => {
    // 	if (!this.ready || !this.editable) {
    // 		return;
    // 	}

    // 	this.beginStoke(this.drawingColor);
    // 	this.drawingCtx.strokeStyle = this.drawingColor;

    // 	isDrawing = true;
    // 	document.body.classList.add('isDrawing');
    // 	this.drawingCtx.beginPath();
    // });

    // document.body.addEventListener('mouseup', async () => {
    // 	if (!isDrawing || !this.ready || !this.editable) {
    // 		return;
    // 	}

    // 	isDrawing = false;
    // 	document.body.classList.remove('isDrawing');
    // 	this.drawingCtx.closePath();

    // 	const edit = this.endStroke();

    // 	if (edit.stroke.length) {
    // 		vscode.postMessage({
    // 			type: 'stroke',
    // 			color: edit.color,
    // 			stroke: edit.stroke,
    // 		});
    // 	}
    // });

    // parent.addEventListener('mousemove', e => {
    // 	if (!isDrawing || !this.ready || !this.editable) {
    // 		return;
    // 	}
    // 	const rect = this.wrapper.getBoundingClientRect();
    // 	const x = e.clientX - rect.left;
    // 	const y = e.clientY - rect.top;
    // 	this.drawingCtx.lineTo(x, y);
    // 	this.drawingCtx.stroke();
    // 	this.addPoint(x, y);
    // });
  }

  // _redraw() {
  //   this.drawingCtx.clearRect(
  //     0,
  //     0,
  //     this.drawingCanvas.width,
  //     this.drawingCanvas.height
  //   );
  //   // for (const stroke of this.strokes) {
  //   //   this.drawingCtx.strokeStyle = stroke.color;
  //   //   this.drawingCtx.beginPath();
  //   //   for (const [x, y] of stroke.stroke) {
  //   //     this.drawingCtx.lineTo(x, y);
  //   //   }
  //   //   this.drawingCtx.stroke();
  //   //   this.drawingCtx.closePath();
  //   // }
  // }

  // /**
  //  * @param {Uint8Array | undefined} data
  //  */
  // //  * @param {Array<Stroke> | undefined} strokes
  // /* async */ reset(data?: string) {
  // return;

  // if (data) {
  //   const img = await loadImageFromData(data);
  //   this.initialCanvas.width /* = this.drawingCanvas.width */ = img.naturalWidth;
  //   this.initialCanvas.height /* = this.drawingCanvas.height */ =
  //     img.naturalHeight;
  //   this.initialCtx.drawImage(img, 0, 0);
  //   this.ready = true;
  // }
  // this.strokes = strokes;
  // this._redraw();
  // let str = data.map(String.fromCharCode).join("");
  // if (!this.startList) this.startList = list;
  // if (list) {
  // }
  // if (pos) this.setRobotPosition(pos);
  // if (pos) this.robot.goTo(pos);
  // }

  update({
    content,
    edits = [],
  }: {
    content: Uint8Array;
    edits?: ListAction<MyNode>[];
  }) {
    let nodeArr;
    try {
      nodeArr = JSONConversions.fromUint8Array(content);
      if (!(nodeArr instanceof Array))
        throw new Error("not instance of Node[]");
      if (!(nodeArr[0] instanceof MyNodeClass))
        throw new Error("not instance of Node[]");
    } catch {}
    return this.listManager.update({
      content: nodeArr,
      edits: edits.map((e) => {
        switch (e.type) {
          case LIST_ACTION_TYPE.APPEND: {
            Object.setPrototypeOf(
              e,
              Object.getPrototypeOf(ListAction.Append<MyNode>).Append.prototype
            );
            break;
          }
          case LIST_ACTION_TYPE.REMOVE: {
            Object.setPrototypeOf(
              e,
              Object.getPrototypeOf(ListAction.Remove<MyNode>).Remove.prototype
            );
            break;
          }

          case LIST_ACTION_TYPE.REPLACE: {
            Object.setPrototypeOf(
              e,
              Object.getPrototypeOf(ListAction.Replace<MyNode>).Replace
                .prototype
            );
            break;
          }
          case LIST_ACTION_TYPE.INSERT: {
            Object.setPrototypeOf(
              e,
              Object.getPrototypeOf(ListAction.Insert<MyNode>).Insert.prototype
            );
            break;
          }
        }
        return e as ListAction<MyNode>;
      }) /*  as unknown as ListAction<MyNode>[] */,
    });
  }

  // /**
  //  * @param {Array<Stroke> | undefined} strokes
  //  */
  // async resetUntitled(strokes = []) {
  //   const size = 100;
  //   this.initialCanvas.width /* = this.drawingCanvas.width */ = size;
  //   this.initialCanvas.height /* = this.drawingCanvas.height */ = size;

  //   this.initialCtx.save();
  //   {
  //     this.initialCtx.fillStyle = "white";
  //     this.initialCtx.fillRect(0, 0, size, size);
  //   }
  //   this.initialCtx.restore();

  //   this.ready = true;

  //   // this.strokes = strokes;
  //   // this._redraw();
  // }

  // /** @return {Promise<Uint8Array>} */
  async getDocData(): Promise<Uint8Array> {
    // let x = new Uint8Array(
    //   Array.from(JSON.stringify(this.listManager.list)).map((e) =>
    //     e.charCodeAt(0)
    //   )
    // );
    // console.log("arr", x);
    return new Uint8Array(
      Array.from(JSON.stringify(this.listManager.list)).map((e) =>
        e.charCodeAt(0)
      )
    );
  }
}

export const editor = new PawDrawEditor(
  // @ts-ignore
  document.querySelector(".drawing-canvas")
);

// Handle messages from the extension
window.addEventListener("message", async ({ data: msg }: { data: Message }) => {
  console.log("from extension", msg);
  // const { type, body, requestId } = msg;
  if (!Message.ToWebview.test(msg)) return;
  if (Message.ToWebview.GetFileRequest.test(msg))
    editor
      .getDocData()
      .then((data) =>
        vscode.postMessage(
          Message.ToExtension.GetFileResponse.fromRequest(msg, data)
        )
      );
  else if (Message.ToWebview.Initialize.test(msg)) {
    if (Message.ToWebview.Initialize.Existing.test(msg))
      // editor.listManager.list.update(processUint8Array(msg.content));
      editor.update(msg);
  } else if (Message.ToWebview.Update.test(msg))
    // update
    // editor.listManager.list.update(processUint8Array(msg.content), msg.edits);
    editor.update(msg);

  return;
  // switch (type) {
  //   case "update": {
  //     // const strokes = body.edits.map(
  //     //   (edit) => new Stroke(edit.color, edit.stroke)
  //     // );
  //     // await editor.reset(body.content, strokes);

  //     console.log(body);

  //     // editor.reset(body.edits[body.edits.length]);

  //     /* if (body.edits.length)  */ editor.reset(body.edits[body.edits.length - 1]);
  //     return;
  //     // body.value = body.content;
  //   }
  //   case "init": {
  //     editor.setEditable(body.editable);
  //     console.log(body);
  //     let str = String.fromCharCode.apply(null, body.value);
  //     console.log(str);
  //     editor.reset(JSON.parse(str));
  //     editor.updateRobotPosition();
  //     // if (body.untitled) {
  //     //   await editor.resetUntitled();
  //     //   return;
  //     // } else {
  //     //   // Load the initial image into the canvas.\

  //     return;
  //     // }
  //   }

  //   case "getFileData": {
  //     // Get the image data for the canvas and post it back to the extension.
  //     editor.getImageData().then((data) => {
  //       vscode.postMessage({
  //         type: "response",
  //         requestId,
  //         body: Array.from(data),
  //       });
  //     });
  //     return;
  //   }
  // }
});

// Signal to VS Code that the webview is initialized.
vscode.postMessage(new Message.ToExtension.Ready());
// })();
