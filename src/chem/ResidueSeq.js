import GraphUtils from '../utils/GraphUtils';
import FSMachine from '../utils/FSMachine';
import SMILESGenerator from '../utils/SMILESGenerator';
import chem from '../chem';

const {
  Complex,
  Element,
  Bond,
  Molecule,
  Atom,
} = chem;

export default class ResiudeSeq {
  constructor(complex) {
    this._complex = complex;
    this._backbone = [];
    this._graph = new GraphUtils(this._complex._bonds, this._complex._atoms);
    this._residues = null;
  }

  defineResidues() {
    const path = this._findBackbone();
    const bbone = this._finalizeBackbone(path);
    const residues = this._getResidues(bbone);

    const SM = new SMILESGenerator();
    const residuesSMILES = [];
    for (let i = 0; i < residues.length; i++) {
      residuesSMILES.push({ SMILES: SM.generateCanonicalSMILES(residues[i]), atomsSet: residues[i] });
    }

    const namedResidues = this._nameResidues(residuesSMILES);
    this._addResidues(namedResidues);
    return residuesSMILES;
  }

  _tryToFindBackbone(startNode, graph) {
    const FSM = new FSMachine();
    const first = graph.DFS(startNode);
    const second = graph.DFS(first);
    FSM.eatPath(graph.getPath(second));
    return FSM.getResult();
  }

  _isBackbone(path) {
    if (path.length % 3 !== 0 || path.length === 0) {
      return false;
    }

    const FSM = new FSMachine();
    FSM.eatPath(path);
    const bbone = FSM.getResult();

    return path.length === bbone.length;
  }

  _findBackbone() {
    const graph = this._graph;
    const atoms = this._complex._atoms;
    return this._tryToFindBackbone(atoms[0], graph);
  }

  _finalizeBackbone(path) {
    let i = 0;
    const atoms = this._complex._atoms;
    const graph = this._graph;
    while (!this._isBackbone(path) && i < atoms.length) {
      const pathes = graph.getAllPathes();
      const backbones = [];
      for (let j = 0; j < pathes.length; j++) {
        const FSM = new FSMachine();
        FSM.eatPath(pathes[j]);
        backbones.push(FSM.getResult());
      }

      const lengths = backbones.map(a => a.length);
      const indx = lengths.indexOf(Math.max(...lengths));
      path = backbones[indx];
      i++;
      this._tryToFindBackbone(atoms[i], graph);
    }

    const res = this._isBackbone(path);

    return path;
  }

  _getResidues(backbone) {
    const vertices = this._complex._atoms;
    const bbverts = new Array(vertices.length).fill(false);

    for (let i = 0; i < backbone.length; i++) {
      bbverts[backbone[i]._index] = true;
    }

    function dfs(atom, visited, nodes) {
      const node = {}; // node is {_atom: a, adj: [], rank: int, indx: int, cycleIndx: int}
      node._atom = atom;
      node._adj = [];
      node.rank = 0;
      node.cycleIndx = [];
      visited[atom._index] = true;
      nodes.push(node);
      const bonds = atom._bonds;
      for (let i = 0; i < atom._bonds.length; i++) {
        const nextAtom = (bonds[i]._left._index === atom._index) ? bonds[i]._right : bonds[i]._left;
        if (nextAtom.element.name !== 'H') {
          if (!visited[nextAtom._index]) {
            node._adj.push({ node: dfs.call(this, nextAtom, visited, nodes), bondType: bonds[i]._order });
          } else {
            const N = nodes.find(element => element._atom._index === nextAtom._index);
            if (N) {
              node._adj.push({ node: N, bondType: bonds[i]._order });// adjacent is {node: _node, bontType: int}
            }
          }
        }
      }

      return node;
    }

    function callDfs(start, verts, set) {
      verts[start._index] = false;
      dfs.call(this, start, verts, set);
      verts[start._index] = true;
      set.forEach((element, indx) => { element.indx = indx; });
    }

    const result = [];

    for (let j = 0; j < backbone.length; j += 3) {
      const alphaC = backbone[j + 1];
      const residueGraph = [];
      callDfs.call(this, alphaC, bbverts, residueGraph);
      result.push(residueGraph);
    }

    return result;
  }

  _setOccupancy(occ, res) {
    for (let i = 0; i < res.length; i++) {
      res[i]._atom._occupancy = occ;
    }
  }

  _readSamplesFromFile() {
  }

  _nameResidues(residues) {
    let max = 0;
    let resIndx = -1;
    const samples = this._readSamplesFromFile();
    for (let i = 0; i < residues.length; i++) {
      //if (this._compareWithSamples(samples, residues[i]) > max) {
      //  resIndx = i;
      //}
    }
    //find max
    //return name
    let occ = 0;
    for (let i = 0; i < residues.length; i++) {
      this._setOccupancy(occ, residues[i].atomsSet);
      occ = !occ;
    }
  }

  _addResidues() {
  }
}
