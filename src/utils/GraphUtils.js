import FSMachine from './FSMachine';
import _ from "lodash";

export default class GraphUtils {
  constructor(vertices) {
    this._vertices = vertices;
    this._distances = [];
    this._parents = [];
    this._startNode = null;
    this._automat = null;
    this._visited = [];
    this._newStart = {};
  }

  traverse(startNode) {
    const vertsStack = [];
    let lastNode = null;
    const automats = [];

    let automat = new FSMachine();
    automats.push(automat);
    vertsStack.push({ node: startNode, auto: automat });
    let lastNode2 = {};

    while (!_.isEmpty(vertsStack)) {
      const data = vertsStack.pop();
      const Node = data.node;
      automat = data.auto;
      let haveway = false;
      let del = false;
      //let resAut = automat;
      const bonds = Node._bonds;
      this._visited[Node._index] = true;
      for (let i = 0; i < Node._bonds.length; i++) {
        const nextNode = (bonds[i]._left._index === Node._index) ? bonds[i]._right : bonds[i]._left;
        const autClone = automat.clone();
        const answer = autClone.eatNode(nextNode);
        if (!answer) {
          del = true;
        }
        if (!this._visited[nextNode._index] && answer) {
          if (autClone.haveOutput()) {
            lastNode = nextNode;
          }
          haveway = true;
          this._distances[nextNode._index] = this._distances[Node._index] + 1;
          this._parents[nextNode._index] = { node: nextNode, parent: Node._index };
          vertsStack.push({ node: nextNode, auto: autClone });
          automats.push(autClone);
        } else if (answer === false) {
          lastNode2 = nextNode;
        }
      }

      if (del || haveway || !automat._havePatern || (automat._curState !== 'NCC' && automat._curState !== 'CCN') || automat._resultWord.length <=3) {
        _.remove(automats, a => a === automat);
      }
    }

    automats.sort((a, b) => a._resultWord.length - b._resultWord.length);

    if (automats.length > 0) {
      //no
    }
    this._automat = automats.pop();

    const result = [];
    for (let i = 0; i < automats.length; i++) {
      result.push(automats[i]._resultWord);
    }

    this._automat = result;

    //const maxIndx = this._distances.indexOf(Math.max(...this._distances));

    this._newStart = this._newStart._index !== lastNode2._index ? lastNode2 : {};

    //for (let i = 0; i < this._vertices.length; i++) {
    //  if (this._vertices[i]._index === maxIndx) {
    //   this._newStart = this._vertices[i];
    //  }
    //}
    return lastNode;

  }

  traverse1(startNode) {
    const result = [];
    const vertsStack = [];

    let automat = new FSMachine();
    this._distances[startNode._index]++;
    vertsStack.push({ node: startNode, auto: automat });

    while (!_.isEmpty(vertsStack)) {
      const data = vertsStack.pop();
      const Node = data.node;
      automat = data.auto;
      const bonds = Node._bonds;
      this._visited[Node._index] = true;
      for (let i = 0; i < Node._bonds.length; i++) {
        const nextNode = (bonds[i]._left._index === Node._index) ? bonds[i]._right : bonds[i]._left;
        let autClone = automat.clone();
        if (autClone.eatNode(nextNode) === false) {
          result.push(nextNode);
          autClone = new FSMachine();
          autClone.eatNode(nextNode);
        }
        if (!this._visited[nextNode._index]) {
          vertsStack.push({ node: nextNode, auto: autClone });
        }
      }
    }

    return result;
  }

  DFS4BBone(startNode) {
    if (!startNode) {
      return null;
    }
    this._visited = new Array(this._vertices.length).fill(false);
    this._startNode = startNode;

    return this.traverse1(startNode);
  }


  DFS(startNode, type = 'one') {
    let start = null;
    if (!startNode) {
      return null;
    }
    this._startNode = startNode;
    this._parents[this._startNode._index] = { node: this._startNode, parent: this._startNode._index };
    this._visited = new Array(this._vertices.length).fill(false);
    this._distances = new Array(this._vertices.length).fill(false);

    start = startNode;
    if (type === 'one') {
      return this.traverse(start);
    }
    const result = [];
    while (!_.isEmpty(start)) {
      const newend = this.traverse(start);
      if (newend !== null) {
        result.push(newend);
      }
      start = this._newStart;
    }

    return result;
  }

  getPath(endNode) {
    let curNode = endNode;
    if (!curNode || this._parents.length === 0) {
      return [];
    }

    const path = [];
    path.push(curNode);
    let parent = this._parents[curNode._index];

    while (parent.parent !== curNode._index) {
      curNode = this._parents[parent.parent].node;
      path.push(curNode);
      parent = this._parents[curNode._index];
    }

    path.push(this._parents[parent.parent].node);

    return path;
  }

  getAutomatPath() {
    if (this._automat) {
      return [];//this._automat.getResult();
    }

    return [];
  }
}
