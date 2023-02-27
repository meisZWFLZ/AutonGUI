import EventList, { ListAction } from "./eventList.js";
// import Message from "../common/message.js";
import { Node } from "../common/node.js";

export default class NodeList extends EventList<Node> {
  private startList: Node[];
  public constructor(arr: Node[] = []) {
    super(arr);
    this.startList = structuredClone(arr);
  }

  public toJSON(): Node[] {
    // console.log(this)

    return super.get({ all: true });
  }

  public update(content?: Node[], edits?: ListAction<Node>[]) {
    // console.log("edits", edits, "arr", this.startList);
    if (content) {
      this.setList(content);
      this.startList = structuredClone(content);
    } else this.setList(structuredClone(this.startList));
    for (const edit of edits || []) this.performNewAction(edit);
    // console.log("result", this);
  }
}
