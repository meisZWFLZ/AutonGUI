import { ListAction } from "./eventList.js";
import { Node } from "./node.js";

export enum MSG_TARGET {
  WEBVIEW,
  EXTENSION,
}
export enum MSG_WEBVIEW_TYPE {
  UPDATE,
  INITIALIZE,
  GET_FILE,
}
export enum MSG_EXTENSION_TYPE {
  READY,
  GET_FILE_RESPONSE,
  EDIT,
}
export default class Message {
  private static lastId: number = 0;
  constructor(
    public readonly target: MSG_TARGET,
    public readonly id: number = Message.lastId++
  ) {}
  static ToWebview = class ToWebview extends Message {
    public override readonly target: MSG_TARGET.WEBVIEW = MSG_TARGET.WEBVIEW;
    constructor(public readonly type: MSG_WEBVIEW_TYPE, id?: number) {
      super(MSG_TARGET.WEBVIEW, id);
    }
    static Update = class Update extends ToWebview {
      public override readonly type: MSG_WEBVIEW_TYPE.UPDATE =
        MSG_WEBVIEW_TYPE.UPDATE;
      constructor(
        public readonly edits: ListAction<Node>[],
        public readonly content: Uint8Array = new Uint8Array(),
        id?: number
      ) {
        super(MSG_WEBVIEW_TYPE.UPDATE, id);
      }
    };
    static Initialize = class Initialize extends ToWebview {
      public override readonly type: MSG_WEBVIEW_TYPE.INITIALIZE =
        MSG_WEBVIEW_TYPE.INITIALIZE;
      public readonly untitled: boolean;
      public readonly editable: boolean;
      public readonly docData: Uint8Array;

      protected constructor(
        {
          untitled,
          editable,
          docData = new Uint8Array(),
        }: {
          readonly untitled: boolean;
          readonly editable: boolean;
          readonly docData: Uint8Array;
        },
        id?: number
      ) {
        super(MSG_WEBVIEW_TYPE.INITIALIZE, id);
        this.untitled = untitled;
        this.editable = editable;
        this.docData = docData;
      }
      static Untitled = class Untitled extends Initialize {
        constructor(id?: number) {
          super(
            { untitled: true, editable: true, docData: new Uint8Array() },
            id
          );
        }
      };
      static Existing = class Existing extends Initialize {
        constructor(
          {
            docData,
            editable,
          }: { readonly docData: Uint8Array; readonly editable?: boolean },
          id?: number
        ) {
          super(
            {
              untitled: false,
              editable: editable != undefined ? editable : true,
              docData,
            },
            id
          );
        }
      };
    };
    static GetFileRequest = class extends ToWebview {
      public override readonly type: MSG_WEBVIEW_TYPE.GET_FILE =
        MSG_WEBVIEW_TYPE.GET_FILE;
      constructor(id?: number) {
        super(MSG_WEBVIEW_TYPE.GET_FILE, id);
      }
    };
  };
  static ToExtension = class ToExtension extends Message {
    public override readonly target: MSG_TARGET.EXTENSION =
      MSG_TARGET.EXTENSION;
    static Stroke: any;
    constructor(public readonly type: MSG_EXTENSION_TYPE, id?: number) {
      super(MSG_TARGET.EXTENSION, id);
    }
    static Edit = class extends ToExtension {
      public override readonly type: MSG_EXTENSION_TYPE.EDIT =
        MSG_EXTENSION_TYPE.EDIT;
      constructor(public readonly edit: ListAction<Node>, id?: number) {
        super(MSG_EXTENSION_TYPE.EDIT, id);
      }
    };
    static GetFileResponse = class GetFileResponse extends ToExtension {
      public override readonly type: MSG_EXTENSION_TYPE.GET_FILE_RESPONSE =
        MSG_EXTENSION_TYPE.GET_FILE_RESPONSE;
      protected constructor(public readonly docData: Uint8Array, id?: number) {
        super(MSG_EXTENSION_TYPE.GET_FILE_RESPONSE, id);
      }
      static fromRequest(msg: Message, docData: Uint8Array): GetFileResponse {
        return new GetFileResponse(docData, msg.id);
      }
    };
    static Ready = class extends ToExtension {
      public override readonly type: MSG_EXTENSION_TYPE.READY =
        MSG_EXTENSION_TYPE.READY;
      constructor(id?: number) {
        super(MSG_EXTENSION_TYPE.READY, id);
      }
    };
  };
}
