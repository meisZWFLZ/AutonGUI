// @ts-check

import {
  AbsoluteCoord,
  CoordinateUtilities,
  DimensionProvider,
  HasMarginOfError,
  PhysicalCoord,
  Position,
} from "../common/coordinates.js";
import Message from "../common/message.js";
import NodeList from "./nodeList.js";
import type { ACTION, Node as MyNode } from "../common/node.js";
import ListManager from "./listManager.js";
import { ListAction, LIST_ACTION_TYPE } from "../common/eventList.js";

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
  indexEl: HTMLElement;
  readonly field: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly actionContainer: HTMLDivElement;

  constructor() {
    this.ready = false;

    this.editable = false;

    const _field: HTMLElement | null = document.querySelector(".field");
    if (!_field) throw "no field";
    this.field = _field;
    const _canvas: HTMLCanvasElement | null =
      document.querySelector(".mycanvas");
    if (!_canvas) throw "no canvas";
    this.canvas = _canvas;

    this.setCanvasSizing();

    const _indexEl: HTMLElement | null = document.querySelector(".index");
    if (!_indexEl) throw "no index element";
    this.indexEl = _indexEl;

    const _actionsContainer: HTMLDivElement | null =
      document.querySelector(".actions");
    if (!_actionsContainer) throw "no actions container";
    this.actionContainer = _actionsContainer;
    const robotEl: HTMLElement | null = document.querySelector(".robot");
    if (robotEl) {
      /** used for initializing new Convertible Coordinates */
      this.dimProvider = new (class extends DimensionProvider {
        get robotOffsetWidth() {
          return robotEl.offsetWidth;
        }
        get fieldWidth() {
          return _field.getBoundingClientRect().width;
        }
        get fieldCoord() {
          return _field.getBoundingClientRect();
        }
      })();
      this.listManager = new ListManager(
        {
          robot: robotEl,
          actions: this.actionContainer,
          _field: this.field,
          canvas: _canvas,
        },
        new NodeList(),
        0,
        this.postLastEdit.bind(this),
        this.setIndex.bind(this)
      );
      // this.robot = new Robot(
      //   robotEl,
      //   new PhysicalPos({ x: 0, y: 0, heading: 0 }, this.dimProvider)
      // );
    } else throw "no robot";

    _field.addEventListener("contextmenu", (ev) => ev.preventDefault());
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

    this.setIndex(0);
    this._initElements();
  }

  setIndex(index: number) {
    this.indexEl.textContent = index.toString();
  }

  setCanvasSizing() {
    const fieldRect = this.field.getBoundingClientRect();
    this.canvas.width = fieldRect.width;
    this.canvas.height = fieldRect.height;

    this.canvas.style.height = `${fieldRect.height}px`;
    this.canvas.style.width = `${fieldRect.width}px`;
    this.canvas.style.top = `${fieldRect.top}px`;
    this.canvas.style.left = `${fieldRect.left}px`;
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

  postEdit(editMsg: typeof Message.ToExtension.Edit.prototype) {
    vscode.postMessage(editMsg);
  }
  postLastEdit() {
    // throw new Error("function not implemented");
    // console.log("update", this.listManager.list.getEdits());
    this.postEdit(
      new Message.ToExtension.Edit(
        this.listManager.list.getEdits()[
          this.listManager.list.getEdits().length - 1
        ]
        // new ListAction.Replace<MyNode>(
        //   this.listManager.index,
        //   this.listManager.getCurNode()
        // )
      )
    );
  }

  _initElements() {
    this.listManager._robot.robotEl.addEventListener("mousedown", (ev) => {
      // @ts-ignore
      if (!ev.altKey) {
        let mouseMoveAbort = new AbortController();
        let mouseMoveListener = (ev: MouseEvent) => {
          try {
            // let mousePos = this.getLocalFieldPos({ x, y });
            let mousePos: PhysicalCoord = AbsoluteCoord.fromCenter(
              ev,
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
          if (!(ev.buttons % 2)) mouseMoveAbort.abort();
        };
        // case 0: //primary (left)
        document.addEventListener("mousemove", mouseMoveListener, {
          signal: mouseMoveAbort.signal,
        });
        document.addEventListener(
          "mouseup",
          () => {
            this.postLastEdit();
            document.removeEventListener("mousemove", mouseMoveListener);
          },
          { once: true }
        );
        return;
      } else {
        let mouseRotateAbort = new AbortController();
        let mouseRotateListener = ({ x, y, buttons }: MouseEvent) => {
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
                Math.atan2(x - robotCenter.x, robotCenter.y - y) *
                  (180 / Math.PI)
                //   /  10
              ) /* * 10, */,
            });
          } catch {}
          if (!(buttons % 2)) {
            mouseRotateAbort.abort();
          }
        };
        // case 2: // secondary (right)
        document.addEventListener("mousemove", mouseRotateListener, {
          signal: mouseRotateAbort.signal,
        });
        document.addEventListener(
          "mouseup",
          () => {
            this.postLastEdit();
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
      this.listManager.updateManagers();
      this.setCanvasSizing();
      // console.log("resize");
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
              x: currRobotPos.x + 1 * dir.x,
              y: currRobotPos.y + 1 * dir.y,
            });
          case "c":
            try {
              // this.setRobotPosition({ heading: 0 });
              this.listManager.moveRobotTo({ heading: 0 });
              this.postLastEdit();
            } catch {}
            return;
          case "n":
            this.listManager.insertNewNodeAfterCur();
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
        case "delete":
          this.listManager.removeCurNode();
          break;
        case "r":
        case "arrowup":
        case "w":
        case "arrowdown":
        case "s":
        case "arrowleft":
        case "a":
        case "arrowright":
        case "d":
          this.postLastEdit();
          break;
        case ",":
        case ".":
          this.toggleActions();
          break;
      }
    });
  }

  // static actionsStyleId = "actions-styling";

  getActionEls(): HTMLButtonElement[] {
    return Array.from(this.actionContainer.querySelectorAll("button"));

    // let el: HTMLStyleElement | null;
    // if (
    //   !(el = document.getElementById(
    //     PawDrawEditor.actionsStyleId
    //   ) as HTMLStyleElement)
    // ) {
    //   el = document.createElement("style");
    //   el.id = PawDrawEditor.actionsStyleId;
    //   this.actionContainer.append(el);
    // }
    // return el;
  }
  // setActionsClass(stylingClass: "hidden" | "shown") {
  //   this.getActionEls().forEach((e) => {
  //     if (stylingClass === "shown" && e.classList.contains("hidden"))
  //       e.classList.remove("hidden");
  //     else if (stylingClass === "hidden" && !e.classList.contains("hidden"))
  //       e.classList.add("hidden");
  //     console.log();
  //   });
  // }
  // private stateOfActionDisplay: "shown" | "hidden" = "shown";
  // hideActions() {
  //   this.setActionsClass("hidden");
  //   this.stateOfActionDisplay = "hidden";
  // }
  // showActions() {
  //   this.setActionsClass("shown");
  //   this.stateOfActionDisplay = "shown";
  // }
  toggleActions() {
    this.getActionEls().forEach((e) => e.classList.toggle("hidden"));

    // if (this.stateOfActionDisplay === "shown") this.hideActions();
    // else this.showActions();
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
      if (
        !(
          CoordinateUtilities.isCoordinate(nodeArr[0]) &&
          CoordinateUtilities.hasMarginOfError(nodeArr[0])
        )
      )
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
        return e;
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

export const editor = new PawDrawEditor();

// Handle messages from the extension
window.addEventListener("message", async ({ data: msg }: { data: Message }) => {
  // console.log("from extension", msg);
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
  } else if (Message.ToWebview.Edit.test(msg))
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
