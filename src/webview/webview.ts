import Auton, { AutonData, AutonEdit } from "../common/auton.js";
import Message from "../common/message.js";
import { Action } from "../common/action.js";
import {
  Coordinate,
  CoordinateUtilities,
  Position,
} from "../common/coordinates.js";
import { GameObject } from "./gameObject.js";
import { FieldContainer } from "./fieldContainer.js";
import { UUID } from "crypto";

function webviewLog(...params: Parameters<typeof console.log>) {
  console.log("wv: ", ...params);
}

webviewLog("TOP OF WEBVIEW");

// @ts-expect-error vscode is silly, and doesn't define this
const vscode = acquireVsCodeApi();

class AutonView {
  robot: typeof GameObject.Draggable.prototype;
  turnToTarget: typeof GameObject.Draggable.prototype;
  fieldContainer: FieldContainer;

  constructor(
    protected auton: Auton = Auton.newAutonAtOrigin(),
    protected index: number = 0,
  ) {
    this.fieldContainer = new FieldContainer(this.html.field);
    this.robot = new GameObject.Draggable(
      this.html.robot,
      this.fieldContainer,
      auton.getStartPos(),
      { draggable: true },
    );
    this.turnToTarget = new GameObject.Draggable(
      this.html.turnTo,
      this.fieldContainer,
      auton.getStartPos(),
      { draggable: false, visibility: "hidden" },
    );
    // end of constructor
    this.eventListeners.onAutonViewConstructed();
    this.msgHandler.sendReady();
  }

  get curAct() {
    return this.auton.auton[this.index];
  }

  /**
   * Gets robot position at index
   * @param index auton index
   * @returns Robot position at {@link index auton index}
   */
  getRobotPos(index: number = this.index): Position {
    const pos: Partial<Position> = {};
    let turnTo: (Coordinate & { readonly reversed?: boolean }) | undefined;
    for (const { type, params } of this.auton.auton
      .slice(0, index + 1)
      .reverse()) {
      switch (type) {
        case "set_pose":
          if (turnTo == null) {
            pos.heading ??=
              params.heading * (params.radians ? 180 / Math.PI : 1);
          }
        // falls through
        case "move_to":
          if (turnTo != null) {
            pos.heading =
              Math.atan2(
                (turnTo.x - params.x) * (turnTo.reversed ? -1 : 1),
                (turnTo.y - params.y) * (turnTo.reversed ? 1 : -1),
              ) *
              (180 / Math.PI);
          }
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
        reason.concat("webview.AutonView.reCalculateRobotPos"),
      );
    } catch (e) {
      console.error(e);
    }
    webviewLog("robot: ", this.getRobotPos());
  }

  setIndex(newIndex: number, reason: string[]) {
    this.index = newIndex;
    this.reCalculateRobotPos(reason.concat("webview.AutonView.setIndex"));
    switch (this.curAct.type) {
      case "move_to":
      case "set_pose":
        this.robot.draggable = true;
        this.turnToTarget.draggable = false;
        this.turnToTarget.hide();
        break;
      case "turn_to":
        this.turnToTarget.setPosition(
          this.curAct.params,
          reason.concat("webview.AutonView.setIndex"),
        );
        this.turnToTarget.show();
        this.turnToTarget.draggable = true;
        this.robot.draggable = false;
        break;
      default:
        this.robot.draggable = false;
        this.turnToTarget.draggable = false;
        this.turnToTarget.hide();
        break;
    }
  }

  private _uuidToQueuedMod: {
    [k: UUID]: AutonEdit.Modify<Action> | undefined;
  } = {};

  /** uuids of mods to be performed */
  private readonly _uuidQueue: UUID[] = [];
  _onAutonModified(mod: AutonEdit.Result.Modify<Action> & { uuid: UUID }) {
    let modSent = false;
    if (this._uuidQueue.length == 0) {
      this.msgHandler.sendModify(mod);
      modSent = true;
    }
    if (!this._uuidQueue.includes(mod.uuid)) this._uuidQueue.push(mod.uuid);
    if (!modSent) this._uuidToQueuedMod[mod.uuid] = mod;
  }

  private _modifyEditResponse({
    uuidOfModAct,
  }: typeof Message.ToWebview.ModifyResponse.prototype) {
    this._uuidQueue.shift();
    if (this._uuidToQueuedMod[uuidOfModAct] != null)
      this._uuidQueue.push(uuidOfModAct);
    while (this._uuidQueue.length > 0) {
      const mod = this._uuidToQueuedMod[this._uuidQueue[0]];
      if (mod == undefined) {
        this._uuidQueue.shift();
        continue;
      }
      this.auton.modify(mod);
      this._uuidToQueuedMod[this._uuidQueue[0]] == undefined;
      break;
    }
  }

  html = new (class HtmlElements {
    // public readonly index: HTMLElement;
    public readonly fieldBackground: SVGImageElement;
    // public readonly canvas: HTMLCanvasElement;
    // public readonly actions: HTMLDivElement;
    public readonly robot: SVGImageElement;
    public readonly turnTo: SVGImageElement;
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
      this.turnTo = this.getElement(".turn-to", "turnTo target");
      this.fieldBackground = this.getElement(
        ".field-background",
        "field background",
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
      T extends NonNullable<ReturnType<D["querySelector"]>>,
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
      webviewLog(msg);
      if (Message.ToWebview.Edit.test(msg)) this.onEdit(msg);
      else if (Message.ToWebview.IndexUpdate.test(msg)) {
        this.onIndexUpdate({
          ...msg,
          reason: [],
        });
      } else if (Message.ToWebview.AutonUpdate.test(msg))
        this.onAutonUpdate(msg);
      else if (Message.ToWebview.ModifyResponse.test(msg)) {
        this.view._modifyEditResponse(msg);
      }
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
      readonly newIndex?: number;
    }) {
      this.view.auton.makeEdit(
        edit.map((e) => {
          return {
            ...e,
            reason: e.reason.concat("webview.AutonView.msgHandler.onEdit"),
          };
        }),
      );
      this.onIndexUpdate({
        newIndex: newIndex ?? this.view.index,
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
      webviewLog("new index: " + newIndex);
      this.view.setIndex(
        newIndex,
        reason.concat("webview.AutonView.msgHandler.onIndexUpdate"),
      );
    }

    private sendMessage(msg: typeof Message.ToExtension.prototype) {
      vscode.postMessage(msg);
    }

    public sendModify(mod: AutonEdit.Result.Modify<Action>) {
      this.sendMessage(new Message.ToExtension.Modify({ ...mod }));
    }

    public sendIndexUpdate(newIndex: number) {
      this.sendMessage(new Message.ToExtension.IndexUpdate(newIndex));
    }

    public sendReady() {
      this.sendMessage(new Message.ToExtension.Ready());
    }
  })(this);

  eventListeners = new (class EventListeners {
    private static readonly maxTimeBetweenModMessages = 10;

    constructor(protected view: AutonView) {
      view.auton.onModifyEdit.sub(this.onAutonModified.bind(this));
    }

    onAutonViewConstructed() {
      this.view.robot.onDidChangePosition.sub(this.onRobotMoved.bind(this));
      this.view.turnToTarget.onDidChangePosition.sub(
        this.onTurnToTargetMoved.bind(this),
      );
    }

    private lastRobotMoveTime: DOMHighResTimeStamp = window.performance.now();
    onRobotMoved({
      pos,
      reason,
    }: Parameters<Parameters<GameObject["onDidChangePosition"]["sub"]>[0]>[0]) {
      if (
        reason.some((r) => r.toLowerCase().startsWith("sever")) ||
        reason.includes("webview.AutonView.reCalculateRobotPos") ||
        (window.performance.now() - this.lastRobotMoveTime <
          EventListeners.maxTimeBetweenModMessages &&
          !reason.includes("webview.DraggableGameObject.onMouseUp"))
      ) {
        return;
      }
      this.lastRobotMoveTime = window.performance.now();

      if (!["move_to", "set_pose"].includes(this.view.curAct.type)) return;
      const newPos: Partial<Position> = { x: pos.x, y: pos.y };
      if (this.view.curAct.type === "set_pose") {
        newPos.heading =
          pos.heading * (this.view.curAct.params.radians ? Math.PI / 180 : 1);
      }
      this.view.auton.modify({
        newProperties: { params: newPos },
        uuid: this.view.curAct.uuid,
        reason: reason.concat("webview.AutonView.eventListener.onRobotMoved"),
      });
    }

    private lastTurnToTargetMoveTime: DOMHighResTimeStamp =
      window.performance.now();

    onTurnToTargetMoved({
      pos,
      reason,
    }: Parameters<Parameters<GameObject["onDidChangePosition"]["sub"]>[0]>[0]) {
      if (
        reason.some((r) => r.toLowerCase().startsWith("sever")) ||
        reason.includes("webview.AutonView.msgHandler.onIndexUpdate") ||
        (window.performance.now() - this.lastTurnToTargetMoveTime <
          EventListeners.maxTimeBetweenModMessages &&
          !reason.includes("webview.DraggableGameObject.onMouseUp"))
      ) {
        return;
      }

      this.lastTurnToTargetMoveTime = window.performance.now();

      if (this.view.curAct.type !== "turn_to") return;
      const newTarget: Partial<Position> = { x: pos.x, y: pos.y };
      this.view.auton.modify({
        newProperties: {
          params: {
            ...this.view.curAct.params,
            ...newTarget,
          },
        },
        uuid: this.view.curAct.uuid,
        reason: reason.concat(
          "webview.AutonView.eventListener.onTurnToTargetMoved",
        ),
      });
      this.view.reCalculateRobotPos(
        reason.concat("webview.AutonView.eventListener.onTurnToTargetMoved"),
      );
    }

    onAutonModified(
      mod: Parameters<Parameters<Auton["_onModifyEdit"]["sub"]>[0]>[0],
    ) {
      if (mod.reason.some((r) => r.toLowerCase().startsWith("server"))) return;
      if ("uuid" in mod) this.view._onAutonModified(mod);
      else this.view.msgHandler.sendModify(mod);
    }
  })(this);
}

export const autonView = new AutonView();

webviewLog("BOTTOM OF WEBVIEW");
