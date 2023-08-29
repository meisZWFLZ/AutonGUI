import * as vscode from "vscode";
import Auton from "../common/auton";
import { ActionWithRanges } from "./astTranslator";
import { UUID } from "crypto";

export interface AutonListData<A extends ActionWithRanges = ActionWithRanges> {
  uri: string;
  funcName: string;
  auton: Auton<A>;
  range: vscode.Range;
}
/**
 * Collection of auton functions in workspace
 */
export class AutonList<A extends ActionWithRanges = ActionWithRanges> {
  constructor(private _data: Array<AutonListData<A>> = []) {}
  setUriAutons(uri: vscode.Uri, autons: Array<Omit<AutonListData<A>, "uri">>) {
    const uriString = uri.toString();
    this._data = this._data
      .filter(({ uri }) => uri !== uriString)
      .concat(
        autons.map((auton) => {
          return { ...auton, uri: uriString };
        }),
      );
  }

  getUriAutons(uri: vscode.Uri): Array<AutonListData<A>> {
    const uriString = uri.toString();
    return this._data.filter(({ uri }) => uri == uriString);
  }

  getFuncAutons(funcName: string, uri?: string): Array<AutonListData<A>> {
    return this._data.filter(
      ({ funcName: _funcName, uri: _uri }) =>
        funcName === _funcName && (uri === undefined || uri === _uri),
    );
  }

  getAllAutons(): Array<AutonListData<A>> {
    return this._data;
  }

  actions(): Array<
    Pick<AutonListData<A>, "uri" | "funcName"> & {
      readonly act: Readonly<A>;
    }
  > {
    return this._data.flatMap(({ uri, funcName, auton: { auton } }) =>
      auton.map((act) => {
        return { uri, funcName, act };
      }),
    );
  }

  findUUID(uuid: UUID):
    | (Pick<AutonListData<A>, "uri" | "funcName"> & {
        readonly act: Readonly<A>;
      })
    | undefined {
    return this.actions().find(({ act }) => act.uuid === uuid);
  }

  hasFunc(funcName: string): boolean {
    return this._data.some(({ funcName: fName }) => fName === funcName);
  }

  hasUri(uri: vscode.Uri): boolean {
    const uriString = uri.toString();
    return this._data.some(({ uri }) => uri === uriString);
  }

  getData(): ReadonlyArray<Readonly<AutonListData<A>>> {
    return this._data;
  }
}
