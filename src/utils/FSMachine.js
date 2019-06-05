import _ from 'lodash';

export default class FSMachine {
  constructor() {
    this._curState = 'INITIAL';
    this._resultWord = [];
    this._currentSubWord = [];
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
    const clone = new FSMachine();
    for (let i = 0; i < this._currentSubWord.length; i++) {
      clone._currentSubWord[i] = this._currentSubWord[i];
    }

    for (let i = 0; i < this._resultWord.length; i++) {
      clone._resultWord[i] = this._resultWord[i];
    }

    clone._havePatern = this._havePatern;
    clone._curState = this._curState;
    return clone;
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

  _ENDstate() {
    this._pushBackResult();
    return false;
  }

  _initialState(Node) {
    const bonds = Node._bonds.length;
    if (Node.element.name === 'N' || (Node.element.name === 'C' && bonds === 3)) {
      this._changeState(Node.element.name, Node);
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

    this._currentSubWord = [];
  }

  _dropState() {
    let newState;
    let res;
    if (this._havePatern) {
      newState = 'END';
      res = false;
      this._pushBackResult();
    } else {
      newState = 'INITIAL';
      res = true;
    }
    this._changeState(newState, null, true);
    return res;
  }

  _Nstate(Node) {
    const bonds = Node._bonds.length;
    if (Node.element.name === 'C') {
      this._changeState('NC', Node);
    } else if (Node.element.name === 'C' && bonds === 3) {
      this._changeState('C', Node, true);
    } else {
      return this._dropState();
    }
    return true;
  }

  _NCstate(Node) {
    const bonds = Node._bonds.length;
    if (Node.element.name === 'C' && bonds === 3) {
      this._changeState('NCC', Node);
      this._pushBackResult();
    } else if (Node.element.name === 'C') {
      this._currentSubWord.shift();
      this._changeState('CC', Node, false);
    } else {
      return this._dropState();
    }
    return true;
  }

  _NCCstate(Node) {
    const bonds = Node._bonds.length;
    if (Node.element.name === 'N') {
      this._changeState('N', Node, true);
    } else if (Node.element.name === 'C' && bonds === 3) {
      this._changeState('C', Node, true);
    } else if (Node.element.name === 'C') {
      this._currentSubWord.shift();
      this._currentSubWord.shift();
      this._changeState('CC', Node, false);
    } else {
      return this._dropState();
    }
    return true;
  }

  _Cstate(Node) {
    const bonds = Node._bonds.length;
    if (Node.element.name === 'C') {
      this._changeState('CC', Node);
    } else if (Node.element.name === 'N') {
      this._changeState('N', Node, true);
    } else if (Node.element.name === 'C', bonds.length === 3) {
      this._changeState('C', Node, true);
    } else {
      return this._dropState();
    }
    return true;
  }

  _CCstate(Node) {
    const bonds = Node._bonds.length;
    if (Node.element.name === 'N') {
      this._changeState('CCN', Node);
      this._pushBackResult();
    } else if (Node.element.name === 'C' && bonds.length === 3) {
      this._changeState('C', Node, true);
    } else {
      return this._dropState();
    }
    return true;
  }

  _CCNstate(Node) {
    this._pushBackResult();
    const bonds = Node._bonds.length;
    if (Node.element.name === 'C' && bonds === 3) {
      this._changeState('C', Node, true);
    } else if (Node.element.name === 'C') {
      this._currentSubWord.shift();
      this._currentSubWord.shift();
      this._changeState('NC', Node, false);
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
    const intersec = _.intersectionWith(this._resultWord, this._currentSubWord, (a, b) => a._index === b._index);
    if (_.isEmpty(intersec)) {
      this._pushBackResult();
    }
    return this._resultWord;
  }
}
