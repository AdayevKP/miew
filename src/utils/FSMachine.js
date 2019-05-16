import _ from 'lodash';

export default class FSMachine {
  constructor() {
    this._curState = 'INITIAL';
    this._resultWord = [];
    this._currentSubWord = [];
    //hardcode FIX IT
    this._havePatern = false;

    this._states = {
      INITIAL: this._initialState,
      N: this._Nstate,
      NC: this._NCstate,
      NCC: this._NCCstate,
      C: this._Cstate,
      CC: this._CCstate,
      CCN: this._CCNstate,
      END: this._ENDstate,
    };
  }

  clone() {
    return Object.assign(Object.create(this), this);
  }

  _changeState(state, Node, drop = false) {
    if (drop) {
      this._currentSubWord = [];
    }

    this._curState = state;
    if (Node) {
      this._currentSubWord.push(Node);
    }
  }

  _ENDstate(Node) {
    this._pushBackResult();
    return false;
  }

  _initialState(Node) {
    const name = Node.element.name;
    const bonds = Node._bonds.length;
    if (name === 'N' || (name === 'C' && bonds === 3)) {
      this._changeState(name, Node);
    }
    return true;
  }

  _pushBackResult() {
    for (let i = 0; i < this._currentSubWord.length; i++) {
      this._resultWord.push(this._currentSubWord[i]);
    }

    if (this._resultWord.length >= 3) {
      this._havePatern = true;
    }
  }

  _dropState() {
    let newState;
    let res;
    if (this._havePatern) {
      newState = 'END';
      res = false;
    } else {
      newState = 'INITIAL';
      res = true;
    }
    this._changeState(newState, null, true);
    return res;
  }

  _Nstate(Node) {
    const name = Node.element.name;
    const bonds = Node._bonds.length;
    if (name === 'C' && bonds === 4) {
      this._changeState('NC', Node);
    } else if (name === 'C' && bonds === 3) {
      this._changeState('C', Node, true);
    } else {
      return this._dropState();
    }
    return true;
  }

  _NCstate(Node) {
    const name = Node.element.name;
    const bonds = Node._bonds.length;
    if (name === 'C' && bonds === 3) {
      this._changeState('NCC', Node);
    } else {
      return this._dropState();
    }
    return true;
  }

  _NCCstate(Node) {
    const name = Node.element.name;
    this._pushBackResult();
    if (name === 'N') {
      this._changeState('N', Node, true);
    } else {
      return this._dropState();
    }
    return true;
  }

  _Cstate(Node) {
    const name = Node.element.name;
    const bonds = Node._bonds.length;
    if (name === 'C' && bonds === 4) {
      this._changeState('CC', Node);
    } else if (name === 'N') {
      this._changeState('N', Node, true);
    } else {
      return this._dropState();
    }
    return true;
  }

  _CCstate(Node) {
    const name = Node.element.name;
    if (name === 'N') {
      this._changeState('CCN', Node);
    } else {
      return this._dropState();
    }
    return true;
  }

  _CCNstate(Node) {
    this._pushBackResult();
    const name = Node.element.name;
    const bonds = Node._bonds.length;
    if (name === 'C' && bonds === 3) {
      this._changeState('C', Node, true);
    } else {
      return this._dropState();
    }
    return true;
  }

  eatNode(Node) {
    const func = this._states[this._curState];
    if (_.isFunction(func)) {
      return func.call(this, Node);
    }

    return false;
  }

  eatPath(path) {
    for (let i = 0; i < path.length; i++) {
      this.eatNode(path[i]);
    }
  }

  getResult() {
    this._pushBackResult();
    return this._resultWord;
  }
}
