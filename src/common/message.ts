import { ListAction } from "./eventList";
import { Node } from "./node";

export enum MSG_TARGET { WEBVIEW, EXTENSION }
export enum MSG_WEBVIEW_TYPE { UPDATE, INITIALIZE, GET_FILE };
export enum MSG_EXTENSION_TYPE { READY, GET_FILE_RESPONSE, EDIT };
export default class Message {
	private static lastId: number = 0;
	constructor(public target: MSG_TARGET, public id: number = Message.lastId++) { }
	static ToWebview = class ToWebview extends Message {
		public override target: MSG_TARGET.WEBVIEW = MSG_TARGET.WEBVIEW;
		constructor(public type: MSG_WEBVIEW_TYPE, id?: number) { super(MSG_TARGET.WEBVIEW, id); }
		static Update = class Update extends ToWebview {
			public override type: MSG_WEBVIEW_TYPE.UPDATE = MSG_WEBVIEW_TYPE.UPDATE;
			constructor(public readonly edits: readonly ListAction<Node>[], public content?: Uint8Array, id?: number) { super(MSG_WEBVIEW_TYPE.UPDATE, id); }
		}
		static Initialize = class Initialize extends ToWebview {
			public override type: MSG_WEBVIEW_TYPE.INITIALIZE = MSG_WEBVIEW_TYPE.INITIALIZE;
			public untitled: boolean;
			public editable: boolean;
			public value?: Uint8Array;

			protected constructor({ untitled, editable, value }: { untitled: boolean, editable: boolean, value?: Uint8Array }, id?: number) {
				super(MSG_WEBVIEW_TYPE.INITIALIZE, id);
				this.untitled = untitled;
				this.editable = editable;
				this.value = value;
			}
			static Untitled = class extends Initialize {
				constructor(id?: number) {
					super({ untitled: true, editable: true }, id)
				}
			}
			static Existing = class extends Initialize {
				constructor({ docData, editable }: { docData: Uint8Array, editable?: boolean }, id?: number) {
					super({ untitled: false, editable: editable != undefined ? editable : true, value: docData }, id)
				}
			}
		}
		static GetFileRequest = class extends ToWebview {
			public override type: MSG_WEBVIEW_TYPE.GET_FILE = MSG_WEBVIEW_TYPE.GET_FILE;
			constructor(id?: number) { super(MSG_WEBVIEW_TYPE.GET_FILE, id); }
		}
	}
	static ToExtension = class ToExtension extends Message {
		public override target: MSG_TARGET.EXTENSION = MSG_TARGET.EXTENSION;
		static Stroke: any;
		constructor(public type: MSG_EXTENSION_TYPE, id?: number) { super(MSG_TARGET.EXTENSION, id) }
		static Edit = class extends ToExtension {
			public override type: MSG_EXTENSION_TYPE.EDIT = MSG_EXTENSION_TYPE.EDIT;
			constructor(public edit: ListAction<Node>, id?: number) {
				super(MSG_EXTENSION_TYPE.EDIT, id);
			}
		}
		static GetFileResponse = class GetFileResponse extends ToExtension {
			public override type: MSG_EXTENSION_TYPE.GET_FILE_RESPONSE = MSG_EXTENSION_TYPE.GET_FILE_RESPONSE;
			protected constructor(public docData: Uint8Array, id?: number) {
				super(MSG_EXTENSION_TYPE.GET_FILE_RESPONSE, id);
			}
			static fromRequest(msg: Message, docData: Uint8Array): GetFileResponse {
				return new GetFileResponse(docData, msg.id)
			}
		}
		static Ready = class extends ToExtension {
			public override type: MSG_EXTENSION_TYPE.READY = MSG_EXTENSION_TYPE.READY;
			constructor(id?: number) {
				super(MSG_EXTENSION_TYPE.READY, id);
			}
		}
	}
}