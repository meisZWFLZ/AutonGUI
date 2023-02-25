import EventList, { ListAction } from "./eventList.js";
import Message from "./message.js";
import { Node } from "./node.js";

export default class NodeList extends EventList<Node> {
  public constructor(arr?: Node[]) {
    super(arr);
  }

  public toJSON(): Node[] {
    console.log(this);
    return super.get({ all: true });
  }

  public update(content: Node[], edits?: ListAction<Node>[]) {
    this.setList(content);
    for (const edit of (edits || []).reverse()) this.performNewAction(edit);
  }
}
