import chem from '../chem';
import _ from 'lodash';

const {
  Complex,
  Element,
  Bond,
  Molecule,
} = chem;

class FSMachine {
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
    const clone = new FSMachine();
    clone._curState = this._curState.slice();
    clone._resultWord = this._resultWord.slice();
    clone._currentSubWord = this._currentSubWord.slice();
    clone._havePatern = this._havePatern;
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

  _ENDstate(Node) {
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
    if (name === 'N') {
      this._pushBackResult();
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
    const name = Node.element.name;
    const bonds = Node._bonds.length;
    if (name === 'C' && bonds === 3) {
      this._pushBackResult();
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
    return this._resultWord;
  }
}

class GraphUtils {
  constructor(edges, vertices) {
    this._edges = edges;
    this._vertices = vertices;
    this._endNode = null;
    this._distances = [];
    this._vertsQueue = [];
    this._parents = [];
    this._startNode = null;

    this._bbone = null;

    this._visited = [];
  }

  DFS(startNode, endNode = null) {
    if (!startNode) {
      return null;
    }

    this._startNode = startNode;

    this._parents[this._startNode._index] = { node: this._startNode, parent: this._startNode._index };
    function doDfs(Node, automat) {
      this._visited[Node._index] = true;
      const bonds = Node._bonds;
      for (let i = 0; i < Node._bonds.length; i++) {
        const nextNode = (bonds[i]._left._index === Node._index) ? bonds[i]._right : bonds[i]._left;
        const autClone = automat.clone();
        if (!this._visited[nextNode._index] && autClone.eatNode(nextNode)) {
          this._distances[nextNode._index] = this._distances[Node._index] + 1;
          this._parents[nextNode._index] = {node: nextNode, parent: Node._index};
          doDfs.call(this, nextNode, autClone);
        }
      }
    }

    this._distances = new Array(this._vertices.length).fill(-1);
    this._visited = new Array(this._vertices.length).fill(false);
    const automat = new FSMachine();
    doDfs.call(this, startNode, automat);
    const maxIndx = this._distances.indexOf(Math.max(...this._distances));
    return this._vertices.find(V => V._index === maxIndx);
  }
/*
  BFS(startNode, endNode = null) {
    if (!startNode) {
      return null;
    }

    this._startNode = startNode;

    this._distances = new Array(this._vertices.length).fill(-1);
    this._distances[this._startNode._index] = 0;
    this._parents[this._startNode._index] = { node: this._startNode, parent: this._startNode._index };

    this._vertsQueue = [];
    this._vertsQueue.push(startNode);
    while (this._vertsQueue.length > 0) {
      const curNode = this._vertsQueue.shift();
      const bonds = curNode._bonds;
      for (let i = 0; i < curNode._bonds.length; i++) {
        const nextNode = (bonds[i]._left._index === curNode._index) ? bonds[i]._right : bonds[i]._left;
        if (this._distances[nextNode._index] === -1) {
          this._distances[nextNode._index] = this._distances[curNode._index] + 1;
          this._parents[nextNode._index] = {node: nextNode, parent: curNode._index};
          this._vertsQueue.push(nextNode);
        }
      }
    }

    //pizdec
    if (endNode) {
      return this.getPath(endNode);
    } else {
      const pathes = this.getAllPathes();
      const backbonePathes = [];

      for (let i = 0; i < pathes.length; i++) {
        const FSM = new FSMachine();
        FSM.eatPath(pathes[i]);
        backbonePathes.push(FSM.getResult());
      }

      const lengths = backbonePathes.map(function(a) {
        return a.length;
      });
      const indx = lengths.indexOf(Math.max.apply(Math, lengths));

      this._bbone = backbonePathes[indx];
      return this._bbone[0];
      //const maxIndx = this._distances.indexOf(Math.max(...this._distances));
      //return this._vertices.find(V => V._index === maxIndx);
    }
  }
*/

  getPath(endNode) {
    let curNode = endNode;
    if (!curNode) {
      return null;
    }

    const path = [];
    path.push(curNode);
    let parent;
    parent = this._parents[curNode._index].parent;

    while (parent !== curNode._index) {
      curNode = this._parents[parent].node;
      path.push(curNode);
      parent = this._parents[curNode._index].parent;
    }

    path.push(this._parents[parent].node);

    return path;
  }

  getAllPathes() {
    const pathes = [];
    const verts = this._vertices;
    for (let i = 0; i < verts.length; i++) {
      pathes.push(this.getPath(verts[i]));
    }
    return pathes;
  }
}

export default class ResiudeSeq {
  constructor() {
    this._complex = null;
    this._backbone = [];
  }

  defineResidues(complex) {
    this._complex = complex;

    this._findBackbone();
  }

  _findBackbone() {
    const graph = new GraphUtils(this._complex._bonds, this._complex._atoms);

    const first = graph.DFS(this._complex._atoms[0]);
    const second = graph.DFS(first);
    const path = graph.getPath(first);

    /*
    const first = graph.BFS(this._complex._atoms[0]);
    const second = graph.BFS(first);

    const path = graph.BFS(first, second);
*/

    for (let i = 0; i < path.length; i++) {
      path[i]._occupancy = 0;
    }

    return 1;
  }

  _finalizeBackbone() {

  }

  _nameResidues() {

  }
}
