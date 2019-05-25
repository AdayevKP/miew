import _ from 'lodash';

const primes = [1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
  101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199];

export default class SMILESGenerator {
  constructor() {
    this.cycleIndx = 0;
  }

  _finalizeRanks(dict, graph) {
    const keys = Object.keys(dict);
    for (let i = 0; i < keys.length; i++) {
      dict[keys[i]] = i + 1;
    }

    graph.forEach((elem) => { elem.rank = dict[elem.rank]; });
  }

  _buildClasses(graph) {
    const classes = {};
    let classesNumb = 0;

    for (let i = 0; i < graph.length; i++) {
      const eqvClass = graph[i].rank;
      if (!classes[eqvClass]) {
        classes[eqvClass] = [];
        classesNumb++;
      }
      classes[eqvClass].push(graph[i]);
    }

    classes.length = classesNumb;
    return classes;
  }

  _createInitialPartition(graph) {
    const dict = {};

    for (let i = 0; i < graph.length; i++) {
      const number = graph[i]._atom.element.number;
      const bondsNumb = graph[i]._adj.length;
      let bondType = 0;
      const key = number * 100 + bondsNumb;
      if (!dict[key]) {
        dict[key] = 0;
      }
      graph[i].rank = key;
    }

    this._finalizeRanks(dict, graph);

    return this._buildClasses(graph);
  }

  _fixClasses(classes) {
    for (let i = 1; i <= classes.length; i++) {
      classes[i][0].rank = i;
    }
  }

  _tieBreaking(classes) {
    function findCommonNode(nodes) {
      const adjacents = [];
      nodes.forEach((element) => { adjacents.push(element._adj); });
      const result = _.intersectionWith(...adjacents, (a, b) => a.node.indx === b.node.indx);
      return result.length === 0 ? null : result[0].node;
    }

    let offset = 1;
    const newclasses = {};
    for (let i = 1; i <= classes.length; i++) {
      if (classes[i].length > 1) {
        const cn = findCommonNode(classes[i]);
        if (cn) {
          const sorted = _.sortBy(classes[i], (element) => {
            const common = element._adj.find(adj => adj.node.indx === cn.indx);
            return -common.bondType;
          });
          classes[i] = sorted;
        }
        for (let j = 0; j < classes[i].length; j++) {
          newclasses[offset++] = [classes[i][j]];
        }
      } else {
        newclasses[offset++] = classes[i];
      }
    }
    newclasses.length = Object.keys(newclasses).length;

    this._fixClasses(newclasses);
    return newclasses;
  }

  _createCanonicalRanking(graph) {
    let oldClassesLen = 0;
    let classes = this._createInitialPartition(graph);
    while (classes.length < graph.length && classes.length > oldClassesLen) {
      oldClassesLen = classes.length;
      classes = this._refinePartition(graph);
    }

    if (classes.length < graph.length) {
      classes = this._tieBreaking(classes);
    }
    if (classes.length !== graph.length) {
      alert('ty loh');
    }
    return classes;
  }

  _refinePartition(graph) {
    function primesFun(args) {
      let res = 1;
      for (let i = 0; i < args.length; i++) {
        res *= primes[args[i]];
      }
      return res;
    }

    function getAdjRanks(node) {
      const adjacent = node._adj;
      const ranks = [];
      for (let i = 0; i < adjacent.length; i++) {
        ranks.push(adjacent[i].node.rank);
      }

      ranks.push(node.rank);
      return ranks;
    }

    const dict = {};

    const newRanks = new Array(graph.length).fill(0);

    for (let i = 0; i < graph.length; i++) {
      const ranks = getAdjRanks(graph[i]);
      const key = primesFun(ranks);
      if (!dict[key]) {
        dict[key] = 0;
      }
      newRanks[i] = key;
    }

    for (let i = 0; i < graph.length; i++) {
      graph[i].rank = newRanks[i];
    }

    this._finalizeRanks(dict, graph);

    return this._buildClasses(graph);
  }

  generateSMILES(graph) {
    function compRule(a, b) {
      if (a.node.rank > b.node.rank) return 1;
      return -1;
    }

    function dfs(node, visited, prevNode = null) { // node is {_atom: a, adj: [], rank: int, indx: int, cycleIndx: int}
      const bondSymbols = ['', '=', '#', '$'];
      visited[node.indx] = true;
      const adjacent = node._adj;
      adjacent.sort(compRule);
      const strings = [];
      let indxString = '';
      let numb = 0;
      for (let i = 0; i < adjacent.length; i++) {
        const nextNode = adjacent[i].node; // adjacent is {node: _node, bontType: int}
        const bond = bondSymbols[adjacent[i].bondType - 1];
        if (!visited[nextNode.indx]) {
          strings.push(bond + dfs.call(this, nextNode, visited, node));
        } else if (nextNode !== prevNode && prevNode !== null) {
          const intersec = _.intersection(node.cycleIndx, nextNode.cycleIndx);
          if (!_.isEmpty(intersec)) {
            indxString += intersec.join('');
            node.cycleIndx = _.difference(node.cycleIndx, intersec);
            nextNode.cycleIndx = _.difference(nextNode.cycleIndx, intersec);
          } else {
            this.cycleIndx++;
            nextNode.cycleIndx.push(this.cycleIndx);
            node.cycleIndx.push(this.cycleIndx);
            indxString += _.intersection(node.cycleIndx, nextNode.cycleIndx).join('');
          }
        }
        /*else if (nextNode !== prevNode && (nextNode.cycleIndx !== node.cycleIndx || nextNode.cycleIndx === '')
        && prevNode !== null) {
          this.cycleIndx++;
          nextNode.cycleIndx += this.cycleIndx.toString();
          node.cycleIndx += this.cycleIndx.toString();
        }*/
      }

      if (indxString !== '') {
        numb = indxString;
      }

      let atomName = node._atom.element.name === 'H' ? '' : node._atom.element.name;
      atomName = numb ? atomName + numb : atomName;
      const last = strings.pop() || '';
      strings.forEach((element, index, array) => {
        if (element !== '') {
          array[index] = `(${element})`;
        }
      });
      const result = atomName + strings.join('') + last;

      return result;
    }

    function findMinRank(arr) {
      let min = arr[0];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].rank < min.rank) {
          min = arr[i];
        }
      }

      return min;
    }

    const visited = new Array(graph.length).fill(false);
    this.cycleIndx = 0;
    const minRank = findMinRank(graph);
    return dfs.call(this, minRank, visited);
  }

  generateCanonicalSMILES(graph) {
    const classes = this._createCanonicalRanking(graph);
    return this.generateSMILES(graph);
  }
}
