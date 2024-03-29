import {
  Selection,
  TextDocumentContentChangeEvent,
  TextEditorEdit,
} from "vscode";
import Auton, { AutonData, AutonEdit } from "./auton";
import { Action } from "./action";
import { v4 as uuidV4 } from "uuid";
import { UUID } from "crypto";
// import { ListAction } from "../webview/eventList.js";
// import { Node } from "./node.js";

export enum MSG_TARGET {
  WEBVIEW,
  EXTENSION,
}
/**
 * type of message sent to webview
 */
export enum MSG_TO_WEBVIEW_TYPE {
  EDIT,
  UPDATE_AUTON,
  UPDATE_AUTON_INDEX,
  MODIFY_RESPONSE,
  // INITIALIZE,
  // GET_FILE,
}
/**
 * type of message sent to extension
 */
export enum MSG_TO_EXTENSION_TYPE {
  MODIFY,
  UPDATE_AUTON_INDEX,
  READY,
  // GET_FILE_RESPONSE,
}
export default class Message {
  constructor(
    public readonly target: MSG_TARGET,
    public readonly id: UUID = uuidV4() as UUID,
  ) {}

  static ToWebview = class ToWebview extends Message {
    public static test(msg: Message): msg is ToWebview {
      return msg.target === MSG_TARGET.WEBVIEW;
    }

    public override readonly target: MSG_TARGET.WEBVIEW = MSG_TARGET.WEBVIEW;
    constructor(
      public readonly type: MSG_TO_WEBVIEW_TYPE,
      id?: UUID,
    ) {
      super(MSG_TARGET.WEBVIEW, id);
    }

    static Edit = class Edit extends ToWebview {
      public static test(msg: Message): msg is Edit {
        return ToWebview.test(msg) && msg.type === MSG_TO_WEBVIEW_TYPE.EDIT;
      }

      public override readonly type: MSG_TO_WEBVIEW_TYPE.EDIT =
        MSG_TO_WEBVIEW_TYPE.EDIT;

      constructor(
        public readonly edit: AutonEdit.AutonEdit[],
        public readonly newIndex?: number,
        id?: UUID,
      ) {
        super(MSG_TO_WEBVIEW_TYPE.EDIT, id);
      }
    };

    static IndexUpdate = class IndexUpdate extends ToWebview {
      public static test(msg: Message): msg is IndexUpdate {
        return (
          ToWebview.test(msg) &&
          msg.type === MSG_TO_WEBVIEW_TYPE.UPDATE_AUTON_INDEX
        );
      }

      public override readonly type: MSG_TO_WEBVIEW_TYPE.UPDATE_AUTON_INDEX =
        MSG_TO_WEBVIEW_TYPE.UPDATE_AUTON_INDEX;

      constructor(
        public readonly newIndex: number,
        id?: UUID,
      ) {
        super(MSG_TO_WEBVIEW_TYPE.UPDATE_AUTON_INDEX, id);
      }
    };

    static AutonUpdate = class AutonUpdate extends ToWebview {
      public static test(msg: Message): msg is AutonUpdate {
        return (
          ToWebview.test(msg) && msg.type === MSG_TO_WEBVIEW_TYPE.UPDATE_AUTON
        );
      }

      public override readonly type: MSG_TO_WEBVIEW_TYPE.UPDATE_AUTON =
        MSG_TO_WEBVIEW_TYPE.UPDATE_AUTON;

      constructor(
        public readonly newAuton: AutonData,
        public readonly newIndex: number,
        id?: UUID,
      ) {
        super(MSG_TO_WEBVIEW_TYPE.UPDATE_AUTON, id);
      }
    };

    static ModifyResponse = class ModifyResponse extends ToWebview {
      public static test(msg: Message): msg is ModifyResponse {
        return (
          ToWebview.test(msg) &&
          msg.type === MSG_TO_WEBVIEW_TYPE.MODIFY_RESPONSE
        );
      }

      public override readonly type: MSG_TO_WEBVIEW_TYPE.MODIFY_RESPONSE =
        MSG_TO_WEBVIEW_TYPE.MODIFY_RESPONSE;

      constructor(
        public readonly state: "success" | "failure",
        /** UUID of the action modified by the {@link Message.ToExtension.Modify.prototype.mod mod} {@link AutonEdit} of the corresponding {@link Message.ToExtension.Modify Modify message */
        public readonly uuidOfModAct: UUID,
        id?: UUID,
      ) {
        super(MSG_TO_WEBVIEW_TYPE.MODIFY_RESPONSE, id);
      }

      static respondWithFailure(uuidOfModAct: UUID): ModifyResponse {
        return new ModifyResponse("failure", uuidOfModAct);
      }

      static respondWithSuccess(uuidOfModAct: UUID): ModifyResponse {
        return new ModifyResponse("success", uuidOfModAct);
      }
    };
    // static Initialize = class Initialize extends ToWebview {
    //   public static test(msg: Message): msg is Initialize {
    //     return ToWebview.test(msg) && msg.type === MSG_WEBVIEW_TYPE.INITIALIZE;
    //   }
    //   public override readonly type: MSG_WEBVIEW_TYPE.INITIALIZE =
    //     MSG_WEBVIEW_TYPE.INITIALIZE;
    //   public readonly untitled: boolean;
    //   public readonly editable: boolean;
    //   public readonly content: string;
    //   protected constructor(
    //     {
    //       untitled,
    //       editable,
    //       content = "",
    //     }: {
    //       readonly untitled: boolean;
    //       readonly editable: boolean;
    //       readonly content: string;
    //     },
    //     id?: number
    //   ) {
    //     super(MSG_WEBVIEW_TYPE.INITIALIZE, id);
    //     this.untitled = untitled;
    //     this.editable = editable;
    //     this.content = content;
    //   }
    //   static Untitled = class Untitled extends Initialize {
    //     constructor(id?: number) {
    //       super({ untitled: true, editable: true, content: "" }, id);
    //     }
    //   };
    //   static Existing = class Existing extends Initialize {
    //     constructor(
    //       {
    //         content,
    //         editable,
    //       }: { readonly content: string; readonly editable?: boolean },
    //       id?: number
    //     ) {
    //       super(
    //         {
    //           untitled: false,
    //           editable: editable != undefined ? editable : true,
    //           content,
    //         },
    //         id
    //       );
    //     }
    //   };
    // };
    // static GetFileRequest = class GetFileRequest extends ToWebview {
    //   public static test(msg: Message): msg is GetFileRequest {
    //     return ToWebview.test(msg) && msg.type === MSG_WEBVIEW_TYPE.GET_FILE;
    //   }
    //   public override readonly type: MSG_WEBVIEW_TYPE.GET_FILE =
    //     MSG_WEBVIEW_TYPE.GET_FILE;
    //   constructor(id?: number) {
    //     super(MSG_WEBVIEW_TYPE.GET_FILE, id);
    //   }
    // };
  };

  static ToExtension = class ToExtension extends Message {
    public static test(msg: Message): msg is ToExtension {
      return msg.target === MSG_TARGET.EXTENSION;
    }

    public override readonly target: MSG_TARGET.EXTENSION =
      MSG_TARGET.EXTENSION;

    constructor(
      public readonly type: MSG_TO_EXTENSION_TYPE,
      id?: UUID,
    ) {
      super(MSG_TARGET.EXTENSION, id);
    }

    static Modify = class Modify extends ToExtension {
      public static test(msg: Message): msg is Modify {
        return (
          ToExtension.test(msg) && msg.type === MSG_TO_EXTENSION_TYPE.MODIFY
        );
      }

      public override readonly type: MSG_TO_EXTENSION_TYPE.MODIFY =
        MSG_TO_EXTENSION_TYPE.MODIFY;

      constructor(
        public readonly mod: AutonEdit.Result.Modify<Action>,
        id?: UUID,
      ) {
        super(MSG_TO_EXTENSION_TYPE.MODIFY, id);
      }
    };

    static IndexUpdate = class IndexUpdate extends ToExtension {
      public static test(msg: Message): msg is IndexUpdate {
        return (
          ToExtension.test(msg) &&
          msg.type === MSG_TO_EXTENSION_TYPE.UPDATE_AUTON_INDEX
        );
      }

      public override readonly type: MSG_TO_EXTENSION_TYPE.UPDATE_AUTON_INDEX =
        MSG_TO_EXTENSION_TYPE.UPDATE_AUTON_INDEX;

      constructor(
        public readonly newIndex: number,
        id?: UUID,
      ) {
        super(MSG_TO_EXTENSION_TYPE.UPDATE_AUTON_INDEX, id);
      }
    };

    // static GetFileResponse = class GetFileResponse extends ToExtension {
    //   public static test(msg: Message): msg is GetFileResponse {
    //     return (
    //       ToExtension.test(msg) &&
    //       msg.type === MSG_EXTENSION_TYPE.GET_FILE_RESPONSE
    //     );
    //   }
    //   public override readonly type: MSG_EXTENSION_TYPE.GET_FILE_RESPONSE =
    //     MSG_EXTENSION_TYPE.GET_FILE_RESPONSE;
    //   protected constructor(public readonly docData: string, id?: number) {
    //     super(MSG_EXTENSION_TYPE.GET_FILE_RESPONSE, id);
    //   }
    //   static fromRequest(msg: Message, docData: string): GetFileResponse {
    //     return new GetFileResponse(docData, msg.id);
    //   }
    // };
    static Ready = class Ready extends ToExtension {
      public static test(msg: Message): msg is Ready {
        return (
          ToExtension.test(msg) && msg.type === MSG_TO_EXTENSION_TYPE.READY
        );
      }

      public override readonly type: MSG_TO_EXTENSION_TYPE.READY =
        MSG_TO_EXTENSION_TYPE.READY;

      constructor(id?: UUID) {
        super(MSG_TO_EXTENSION_TYPE.READY, id);
      }
    };
  };

  // should rewrite type predicates to use this instead:
  // isToWebview(): this is typeof Message.ToWebview.prototype {
  //   return this.target === MSG_TARGET.WEBVIEW;
  // }
}
