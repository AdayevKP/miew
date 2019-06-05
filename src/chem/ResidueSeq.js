import _ from 'lodash';
import GraphUtils from '../utils/GraphUtils';
import FSMachine from '../utils/FSMachine';
import SMILESGenerator from '../utils/SMILESGenerator';
import { buildChainID } from '../io/parsers/SDFParser';

/*const residuesDict = {
  'CCCCN=C(N)N': 'ARG',
  'CCC(N)=O': 'ASN',
  'CCC(=O)O': 'ASP',
  CCS: 'CYS',
  'CCCC(=O)O': 'GLY',
  'CCCC(N)=O': 'GLN',
  C: 'GLY',
  'CCC1=CN=CN1': 'HIS',
  'CC(C)CC': 'ILE',
  'CCC(C)C': 'LEU',
  CCCCCN: 'LYS',
  CCCSC: 'MET',
  'CCC1=CC=CC=C1': 'PHE',
  CCCC: 'PRO',
  CCSE: 'SEC',
  CCO: 'SER',
  'CC(C)O': 'THR',
  'CCC1=CNC2=CC=CC=C12': 'TRP',
  'CCC1=CC=C(O)C=C1': 'TYR',
  'CC(C)C': 'VAL',
  CC: 'ALA',
}; */

const residuesDict = {
  'CCCCNC(N)N': 'ARG',
  'CCC(N)O': 'ASN',
  'CCC(O)O': 'ASP',
  CCS: 'CYS',
  'CCCC(O)O': 'GLY',
  'CCCC(N)O': 'GLN',
  C: 'GLY',
  CCC1CNCN1: 'HIS',
  'CC(C)CC': 'ILE',
  'CCC(C)C': 'LEU',
  CCCCCN: 'LYS',
  CCCSC: 'MET',
  CCC1CCCCC1: 'PHE',
  CCCC: 'PRO',
  CCSE: 'SEC',
  CCO: 'SER',
  'CC(C)O': 'THR',
  CCC1CNC2CCCCC12: 'TRP',
  'CCC1CCC(O)C=C1': 'TYR',
  'CC(C)C': 'VAL',
  CC: 'ALA',
};

export default class ResiudeSeq {
  constructor() {
    this._complex = null;
    this._graph = null;
    this.__compoundIndx = 0;
  }

  _bfs(startNode, visited = null) {
    if (!startNode) {
      return null;
    }
    const vertices = this._complex._atoms;
    if (!visited) {
      visited = Array(vertices.length).fill(false);
    }

    const vertsQueue = [];
    const distances = new Array(vertices.length).fill(-1);
    distances[startNode._index] = 0;
    vertsQueue.push(startNode);
    while (!_.isEmpty(vertsQueue)) {
      const curNode = vertsQueue.shift();
      visited[curNode._index] = true;
      const bonds = curNode._bonds;
      for (let i = 0; i < curNode._bonds.length; i++) {
        const nextNode = (bonds[i]._left._index === curNode._index) ? bonds[i]._right : bonds[i]._left;
        if (!visited[nextNode._index]) {
          vertsQueue.push(nextNode);
          distances[nextNode._index] = distances[curNode._index] + 1;
        }
      }
    }

    const maxIndx = distances.indexOf(Math.max(...distances));
    return vertices.find(V => V._index === maxIndx);
  }

  _findConnectedComponents() {
    const atoms = this._complex._atoms;
    const visited = Array(atoms.length).fill(false);
    let startAtom = atoms[0];
    const result = [];
    while (startAtom) {
      result.push(startAtom);
      this._bfs(startAtom, visited);
      startAtom = atoms[visited.indexOf(false)];
    }

    return result;
  }

  defineResidues(complex) {
    this._complex = complex;
    this._graph = new GraphUtils(this._complex._atoms);

    const CC = this._findConnectedComponents();

    for (let i = 0; i < CC.length; i++) {
      this.__compoundIndx++;
      const bbone = this._findBackbone(CC[i]);
      if (bbone) {
        const residues = this._getResidues(bbone);
        this._nameResidues(residues);
        this._addResidues(residues);
      }
    }

    this._complex = null;
    this._graph = null;

    return true;
  }

  _tryToFindBackbone(startNode, graph) {
    const FSM = new FSMachine();
    const first = graph.DFS(startNode);
    const second = graph.DFS(first);
    const path = graph.getPath(second);
    FSM.eatPath(path);
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

  _backbondIterativeSearch(startAtom, graph) {
    let newStartAtom = startAtom;
    const visitedVerts = [];
    let path = graph.getAutomatPath();
    while (!this._isBackbone(path) && !visitedVerts.includes(newStartAtom)) {
      visitedVerts.push(newStartAtom);
      newStartAtom = this._bfs(newStartAtom);
      this._tryToFindBackbone(newStartAtom, graph);
      path = graph.getAutomatPath();
    }

    return path;
  }

  _findBackbone(startAtom) {
    const graph = this._graph;
    let path = this._tryToFindBackbone(startAtom, graph);

    if (!this._isBackbone(path)) {
      path = this._backbondIterativeSearch(startAtom, graph);
    }
    return this._isBackbone(path) ? path : [];
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
      node.alphaC = false;
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

    function haveOxygen(atom) {
      return null;
    }

    const result = [];

    for (let j = 0; j < backbone.length; j += 3) {
      const alphaC = backbone[j + 1];
      const residueGraph = [];
      callDfs.call(this, alphaC, bbverts, residueGraph);

      const SM = new SMILESGenerator();
      residueGraph[0].alphaC = true;
      const smiles = SM.generateCanonicalSMILES(residueGraph);

      const node1 = {}; // node is {_atom: a, adj: [], rank: int, indx: int, cycleIndx: int}
      node1._atom = backbone[j];
      node1._adj = [];
      node1.rank = 0;
      node1.cycleIndx = [];
      node1.alphaC = false;

      const node2 = {}; // node is {_atom: a, adj: [], rank: int, indx: int, cycleIndx: int}
      node2._atom = backbone[j + 2];
      node2._adj = [];
      node2.rank = 0;
      node2.cycleIndx = [];
      node2.alphaC = false;
      residueGraph.push(node1, node2);
      //callDfs.call(this, backbone[j], bbverts, residueGraph);
      //callDfs.call(this, backbone[j + 2], bbverts, residueGraph);
      result.push({ SMILES: smiles, atomsSet: residueGraph });
    }

    return result;
  }

  _nameResidues(residues) {
    for (let i = 0; i < residues.length; i++) {
      residues[i].name = _.isUndefined(residuesDict[residues[i].SMILES]) ? 'UNK' : residuesDict[residues[i].SMILES];
    }
  }

  _setResiduesForAtoms(nodes, residue) {
    nodes.forEach((node) => {
      const atom = node._atom;
      const oldRes = atom._residue;
      oldRes._atoms.splice(oldRes._atoms.indexOf(atom), 1);
      atom._residue = residue;
    });
  }

  _addResidues(namedResidues) {
    const complex = this._complex;
    const chainID = buildChainID(this.__compoundIndx);
    const chain = complex.getChain(chainID) || complex.addChain(chainID);
    for (let i = 0; i < namedResidues.length; i++) {
      const residue = chain.addResidue(namedResidues[i].name, 1, ' ');
      this._setResiduesForAtoms(namedResidues[i].atomsSet, residue);
      namedResidues[i].atomsSet.forEach(node => residue._atoms.push(node._atom));
    }

    complex.finalize({
      needAutoBonding: false, detectAromaticLoops: false, enableEditing: false,
    });
  }
}
