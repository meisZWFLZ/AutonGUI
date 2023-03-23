import EventList, { ListAction } from "../common/eventList.js";
// import Message from "../common/message.js";
import { Node as MyNode } from "../common/node.js";
import { HasMarginOfError, Position } from "../common/coordinates.js";

export default class NodeList extends EventList<MyNode> {
  private startList: MyNode[];
  public constructor(arr: MyNode[] = []) {
    super(arr);
    this.startList = structuredClone(arr);
  }

  public toJSON(): MyNode[] {
    // console.log(this)

    return super.get({ all: true }).map((node: MyNode) => {
      return {
        position: Object.fromEntries(
          Object.entries(node.position).sort(([k1], [k2]) => {
            function getVal(key: string): number {
              switch (key as "x" | "y" | "heading" | "marginOfError") {
                case "x":
                  return 4;
                case "y":
                  return 3;
                case "heading":
                  return 2;
                case "marginOfError":
                  return 1;
              }
            }
            return getVal(k2) - getVal(k1);
          })
        ) as Position & HasMarginOfError,
        actions: node.actions,
      };
    });
  }

  public update(content?: MyNode[], edits?: ListAction<MyNode>[]) {
    // console.log("edits", edits, "arr", this.startList);
    if (content) {
      this.setList(content);
      this.startList = structuredClone(content);
    } else this.setList(structuredClone(this.startList));
    for (const edit of edits || []) this.performNewAction(edit);
    // console.log("result", this);
  }
}
