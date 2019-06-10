import _ from 'lodash';

const primes = [1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
  101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199];

export default class SMILESGenerator {
  constructor() {
    this.cycleIndx = 0;
  }

  _finalizeRanks(dict, graph, startRank = 0) {
    const keys = Object.keys(dict);
    let rank = 1;
    let highRank = 0;
    for (let i = 0; i < keys.length; i++) {
      if (dict[keys[i]] === 1) {
        dict[keys[i]] = startRank + rank++;
      } else {
        dict[keys[i]] = startRank + keys.length - highRank;
        highRank++;
      }
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
      const { number } = graph[i]._atom.element;
      const bondsNumb = graph[i]._adj.length;
      const key = number * 100 + bondsNumb;
      if (!dict[key]) {
        dict[key] = 1;
      } else {
        dict[key]++;
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
      const adjacent = [];
      nodes.forEach((element) => { adjacent.push(element._adj); });
      const result = _.intersectionWith(...adjacent, (a, b) => a.node.indx === b.node.indx);
      return result.length === 0 ? null : result[0].node;
    }

    let offset = 1;
    const newClasses = {};
    for (let i = 1; i <= classes.length; i++) {
      if (classes[i].length > 1) {
        const cn = findCommonNode(classes[i]);
        if (cn) {
          classes[i] = _.sortBy(classes[i], (element) => {
            const common = element._adj.find(adj => adj.node.indx === cn.indx);
            return -common.bondType;
          });
        }
        for (let j = 0; j < classes[i].length; j++) {
          newClasses[offset++] = [classes[i][j]];
        }
      } else {
        newClasses[offset++] = classes[i];
      }
    }
    newClasses.length = Object.keys(newClasses).length;

    this._fixClasses(newClasses);
    return newClasses;
  }

  _createCanonicalRanking(graph) {
    let oldClassesLen = 0;
    let classes = this._createInitialPartition(graph);
    while (classes.length < graph.length && classes.length > oldClassesLen) {
      oldClassesLen = classes.length;
      classes = this._refinePartition(classes);
    }

    if (classes.length < graph.length) {
      classes = this._tieBreaking(classes);
    }
    return classes;
  }

  _refinePartition(classes) {
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

    function reEvaluate(atoms, startRank) {
      const dict = {};

      const newRanks = new Array(atoms.length).fill(0);

      for (let i = 0; i < atoms.length; i++) {
        const ranks = getAdjRanks(atoms[i]);
        const key = primesFun(ranks);
        if (!dict[key]) {
          dict[key] = 1;
        } else {
          dict[key]++;
        }
        newRanks[i] = key;
      }

      for (let i = 0; i < atoms.length; i++) {
        atoms[i].rank = newRanks[i];
      }

      this._finalizeRanks(dict, atoms, startRank);
    }

    let startRank = 0;
    const result = [];
    const oldClasses = [];

    for (let i = 1; i <= classes.length; i++) {
      if (classes[i].length > 1) {
        startRank = startRank || i - 1;
        reEvaluate.call(this, classes[i], startRank);
        oldClasses.push(...classes[i]);
      } else {
        oldClasses.push(...classes[i]);
      }
    }

    const newClasses = this._buildClasses(oldClasses);

    return newClasses;
  }

  generateSMILES(graph) {
    function compRule(a, b) {
      if (a.node.rank > b.node.rank) return 1;
      return -1;
    }

    function dfs(node, visited, prevNode = null) { // node is {_atom: a, adj: [], rank: int, indx: int, cycleIndx: int}
      visited[node.indx] = true;
      const adjacent = node._adj;
      adjacent.sort(compRule);
      const strings = [];
      let indxString = '';
      let numb = 0;
      for (let i = 0; i < adjacent.length; i++) {
        const nextNode = adjacent[i].node; // adjacent is {node: _node, bontType: int}
        const bond = '';
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

    const visited = new Array(graph.length).fill(false);
    this.cycleIndx = 0;
    const start = _.find(graph, ['alphaC', true]);
    return dfs.call(this, start, visited);
  }

  generateCanonicalSMILES(graph) {
    this._createCanonicalRanking(graph);
    return this.generateSMILES(graph);
  }
}
