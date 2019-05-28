import FSMachine from './FSMachine';

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
          this._parents[nextNode._index] = { node: nextNode, parent: Node._index };
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

  getPath(endNode) {
    let curNode = endNode;
    if (!curNode || this._parents.length === 0) {
      return null;
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
