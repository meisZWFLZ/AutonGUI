import EventList from "./eventList";
import ListEvent from "./listEvent";
import { Node } from "./node";

class NodeList extends EventList<Node> {
	public emitEvent(ev: ListEvent) {
		super.emit(ev.name, ev)
	};
};