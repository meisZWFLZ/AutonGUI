import { ACTION } from "../common/node.js";

export default class ActionsManager {
  private _elements: HTMLElement[] = Array(5);

  private static getTypeOfAction(el: HTMLElement): ACTION | undefined {
    switch (el.getAttribute("data-action")) {
      case "intake":
        return ACTION.INTAKE;
      case "shoot":
        return ACTION.SHOOT;
      case "piston_shoot":
        return ACTION.PISTON_SHOOT;
      case "roller":
        return ACTION.ROLLER;
      case "expand":
        return ACTION.EXPAND;
      default:
        return undefined;
    }
  }

  private populateElements(): void {
    Array.from(this._container.children).forEach((e) => {
      const type = ActionsManager.getTypeOfAction(e as HTMLElement);
      if (type !== undefined) this._elements[type] = e as HTMLElement;
    });
  }

  public _displayActions() {
    this._elements.forEach((el, type) => {
      if (this.actions.includes(type)) {
        if (!el.classList.contains("active")) el.classList.add("active");
      } else if (el.classList.contains("active")) el.classList.remove("active");
    });
  }

  private actionListener(action: ACTION) {
    const index = this.actions.indexOf(action);
    if (index === -1) this.actions.push(action);
    else this.actions.splice(index, 1);
    this._displayActions();
    this.onUpdate(this.getActions());
  }

  private initListeners() {
    this._elements.forEach((el, i) => {
      el.onclick = () => this.actionListener(i);
    });
  }

  constructor(
    public _container: HTMLElement,
    public onUpdate: (actions: ACTION[]) => void,
    protected actions: ACTION[] = [],
  ) {
    this.populateElements();
    this._displayActions();
    this.initListeners();
  }

  setActions(actions: ACTION[] = []) {
    this.actions = structuredClone(actions);
    this._displayActions();
  }

  getActions(): ACTION[] {
    return structuredClone(this.actions);
  }
}
