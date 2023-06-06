import Auton, { AutonData, AutonEdit } from "../common/auton.js";
import Message from "../common/message.js";
import { Action, ActionTypeGuards } from "../common/action.js";
import { Robot } from "./robot.js";
import {
  Coordinate,
  CoordinateUtilities,
  DimensionProvider,
  PhysicalPos,
  Position,
} from "../common/coordinates.js";
import { GameObject } from "./gameObject.js";
import { FieldContainer } from "./fieldContainer.js";

console.log("TOP OF WEBVIEW");

// @ts-ignore
const vscode = acquireVsCodeApi();

class AutonView {
  robot: typeof GameObject.Draggable.prototype;
  fieldContainer: FieldContainer;

  constructor(
    protected auton: Auton = Auton.newAutonAtOrigin(),
    protected index: number = 0
  ) {
    this.fieldContainer = new FieldContainer(this.html.field);
    this.robot = new GameObject.Draggable(
      this.html.robot,
      this.fieldContainer,
      auton.getStartPos()
    );

    // end of constructor
    this.msgHandler.sendReady();
  }
  /**
   * Gets robot position at index
   * @param index auton index
   * @returns Robot position at {@link index auton index}
   */
  getRobotPos(index: number = this.index): Position {
    let pos: Partial<Position> = {};
    let turnTo: Coordinate | undefined;
    for (const { type, params } of this.auton.auton
      .slice(0, index + 1)
      .reverse()) {
      switch (type) {
        case "set_pose":
          if (!turnTo) pos.heading ??= params.heading;
        case "move_to":
          if (turnTo)
            pos.heading = Math.atan2(params.x - turnTo.x, params.y - turnTo.y);
          if (CoordinateUtilities.isCoordinate(pos)) continue;
          pos.x = params.x;
          pos.y = params.y;
          break;
        case "turn_to":
          if (CoordinateUtilities.isRotatable(pos)) continue;
          turnTo ??= params;
          break;
        default:
          continue;
      }
      if (CoordinateUtilities.isPosition(pos)) break;
    }
    return { ...{ x: 0, y: 0, heading: 0 }, ...pos };
  }
  /**
   * gets robot pos at current auton index and moves robot to it
   */
  reCalculateRobotPos(reason: string[]) {
    try {
      this.robot.animateMove(
        this.getRobotPos(),
        reason.concat("webview.AutonView.reCalculateRobotPos")
      );
    } catch (e) {
      console.error(e);
    }
    console.log("robot: ", this.getRobotPos());
  }
  setIndex(newIndex: number, reason: string[]) {
    if (newIndex === this.index) return;
    this.index = newIndex;
    this.reCalculateRobotPos(reason.concat("webview.AutonView.setIndex"));
  }

  html = new (class HtmlElements {
    // public readonly index: HTMLElement;
    public readonly fieldBackground: SVGImageElement;
    // public readonly canvas: HTMLCanvasElement;
    // public readonly actions: HTMLDivElement;
    public readonly robot: SVGImageElement;
    public readonly field: SVGSVGElement;

    // public readonly dimProvider: DimensionProvider;
    constructor() {
      // this.actions = this.getElement<HTMLDivElement>(
      //   ".actions",
      //   "action container"
      // );
      // this.index = this.getElement<HTMLElement>(".index", "index");
      // this.canvas = this.getElement<HTMLCanvasElement>(".mycanvas", "canvas");
      this.field = this.getElement(".field-svg", "field svg");
      this.robot = this.getElement(".robot", "robot");
      this.fieldBackground = this.getElement(
        ".field-background",
        "field background"
      );

      // const els = this;
      // this.dimProvider = {
      //   get robotOffsetWidth() {
      //     return /* els.robot.offsetWidth */ 0;
      //   },
      //   get fieldWidth() {
      //     return /* els.field.getBoundingClientRect().width */ 0;
      //   },
      //   get fieldCoord() {
      //     return /* els.field.getBoundingClientRect() */ { x: 0, y: 0 };
      //   },
      // };
    }
    private getElement<
      D extends ParentNode,
      T extends NonNullable<ReturnType<D["querySelector"]>>
    >(query: string, readableName: string, parent?: D) {
      const el: T | null = (parent ?? document).querySelector(query);
      if (el == null) throw "no " + readableName.trim() + " element";
      return el;
    }
  })();

  msgHandler = new (class MessageHandler {
    constructor(protected view: AutonView) {
      window.addEventListener("message", this.listener.bind(this));
    }
    listener({ data: msg }: { data: Message }) {
      console.log(msg);
      if (Message.ToWebview.Edit.test(msg)) this.onEdit(msg);
      else if (Message.ToWebview.IndexUpdate.test(msg))
        this.onIndexUpdate({
          ...msg,
          reason: [],
        });
      else if (Message.ToWebview.AutonUpdate.test(msg)) this.onAutonUpdate(msg);
    }
    onAutonUpdate({
      newAuton,
      newIndex,
    }: {
      readonly newAuton: AutonData;
      readonly newIndex: number;
    }) {
      this.onEdit({
        edit: [
          {
            action: newAuton,
            index: 0,
            count: Infinity,
            reason: ["webview.AutonView.msgHandler.onAutonUpdate"],
          },
        ],
        newIndex,
      });
    }
    onEdit({
      edit,
      newIndex,
    }: {
      readonly edit: AutonEdit.AutonEdit[];
      readonly newIndex: number;
    }) {
      this.view.auton.makeEdit(
        edit.map((e) => {
          return {
            ...e,
            reason: e.reason.concat("webview.AutonView.msgHandler.onEdit"),
          };
        })
      );
      this.onIndexUpdate({
        newIndex,
        reason: edit[0].reason.concat("webview.AutonView.msgHandler.onEdit"),
      });
    }
    onIndexUpdate({
      newIndex,
      reason,
    }: {
      readonly newIndex: number;
      readonly reason: string[];
    }) {
      console.log("new index: " + newIndex);
      this.view.setIndex(
        newIndex,
        reason.concat("webview.AutonView.msgHandler.onIndexUpdate")
      );
    }

    private sendMessage(msg: typeof Message.ToExtension.prototype) {
      vscode.postMessage(msg);
    }
    public sendModify(
      mod: AutonEdit.Modify<Action>[] | AutonEdit.Modify<Action>
    ) {
      this.sendMessage(
        new Message.ToExtension.Modify(Array.isArray(mod) ? mod : [mod])
      );
    }
    public sendIndexUpdate(newIndex: number) {
      this.sendMessage(new Message.ToExtension.IndexUpdate(newIndex));
    }
    public sendReady() {
      this.sendMessage(new Message.ToExtension.Ready());
    }
  })(this);

  eventListeners = new (class EventListeners {
    constructor(protected view: AutonView) {
      view.auton.onModifyEdit.sub(this.onAutonModified.bind(this));
    }
    onRobotMoved({
      pos,
      reason,
    }: Parameters<Parameters<GameObject["onDidChangePosition"]["sub"]>[0]>[0]) {
      if (
        reason.some((r) => r.toLowerCase().startsWith("sever")) ||
        reason.includes("webview.AutonView.msgHandler.onIndexUpdate")
      )
        return;
    }
    onAutonModified(
      mod: Parameters<Parameters<Auton["_onModifyEdit"]["sub"]>[0]>[0]
    ) {
      if (mod.reason.some((r) => r.toLowerCase().startsWith("server"))) return;
      this.view.msgHandler.sendModify(mod);
    }
  })(this);
}

export const autonView = new AutonView();

console.log("BOTTOM OF WEBVIEW");
