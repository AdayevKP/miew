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
  }

  DFS(startNode) {
    if (!startNode) {
      return null;
    }
    const vertsStack = [];
    this._visited = new Array(this._vertices.length).fill(false);
    this._distances = new Array(this._vertices.length).fill(-1);
    this._startNode = startNode;
    this._parents[this._startNode._index] = { node: this._startNode, parent: this._startNode._index };

    const automats = [];

    let automat = new FSMachine();
    automats.push(automat);
    vertsStack.push({ node: startNode, auto: automat });

    while (!_.isEmpty(vertsStack)) {
      const data = vertsStack.pop();
      const Node = data.node;
      automat = data.auto;

      //let resAut = automat;
      const bonds = Node._bonds;
      this._visited[Node._index] = true;
      for (let i = 0; i < Node._bonds.length; i++) {
        const nextNode = (bonds[i]._left._index === Node._index) ? bonds[i]._right : bonds[i]._left;
        const autClone = automat.clone();
        if (!this._visited[nextNode._index] && autClone.eatNode(nextNode)) {
          this._distances[nextNode._index] = this._distances[Node._index] + 1;
          this._parents[nextNode._index] = { node: nextNode, parent: Node._index };
          vertsStack.push({ node: nextNode, auto: autClone });
          automats.push(autClone);
          //const newAut = doDfs.call(this, nextNode, autClone);
          //resAut = newAut._resultWord > resAut._resultWord ? newAut : resAut;
        }
      }
    }

    automats.sort((a, b) => a._resultWord.length - b._resultWord.length);
    this._automat = automats.pop();
    const maxIndx = this._distances.indexOf(Math.max(...this._distances));
    return this._vertices.find(V => V._index === maxIndx);
  }
/*
  DFS(startNode) {
    if (!startNode) {
      return null;
    }

    this._startNode = startNode;
    this._parents[this._startNode._index] = { node: this._startNode, parent: this._startNode._index };
    function doDfs(Node, automat) {
      let resAut = automat;
      this._visited[Node._index] = true;
      const bonds = Node._bonds;
      for (let i = 0; i < Node._bonds.length; i++) {
        const nextNode = (bonds[i]._left._index === Node._index) ? bonds[i]._right : bonds[i]._left;
        const autClone = automat.clone();
        if (!this._visited[nextNode._index] && autClone.eatNode(nextNode)) {
          this._distances[nextNode._index] = this._distances[Node._index] + 1;
          this._parents[nextNode._index] = { node: nextNode, parent: Node._index };
          const newAut = doDfs.call(this, nextNode, autClone);
          resAut = newAut._resultWord > resAut._resultWord ? newAut : resAut;
        }
      }

      return resAut;
    }

    this._distances = new Array(this._vertices.length).fill(-1);
    this._visited = new Array(this._vertices.length).fill(false);
    const automat = new FSMachine();
    this._automat = doDfs.call(this, startNode, automat);
    const maxIndx = this._distances.indexOf(Math.max(...this._distances));
    return this._vertices.find(V => V._index === maxIndx);
  }
*/

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
      return this._automat.getResult();
    }

    return [];
  }
}
