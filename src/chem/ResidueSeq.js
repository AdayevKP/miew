import _ from 'lodash';
import GraphUtils from '../utils/GraphUtils';
import FSMachine from '../utils/FSMachine';
import SMILESGenerator from '../utils/SMILESGenerator';
import { buildChainID } from '../io/parsers/SDFParser';
import chem from '../chem';
import AutoBond from './AutoBond';

const {
  Element,
} = chem;


class Node {
  constructor(atom = null, alphaC = false, rank = 0) {
    this._atom = atom;
    this._adj = [];
    this.rank = rank;
    this.cycleIndx = [];
    this.alphaC = alphaC;
  }
}

const atomNames = ['A', 'B', 'G', 'D', 'E', 'Z', 'H'];

const residuesDict = {
  'CCCCNC(N)N': 'ARG',
  'CCC(N)O': 'ASN',
  'CCC(O)O': 'ASP',
  CCS: 'CYS',
  'CCCC(O)O': 'GLU',
  'CCCC(N)O': 'GLN',
  C: 'GLY',
  CCC1CNCN1: 'HIS',
  'CC(CC)C': 'ILE',
  'CCC(C)C': 'LEU',
  CCCCCN: 'LYS',
  CCCSC: 'MET',
  CCC1CCCCC1: 'PHE',
  CCCC: 'PRO',
  CCSE: 'SEC',
  CCO: 'SER',
  'CC(O)C': 'THR',
  CCC2CNC1CCCCC12: 'TRP',
  'CCC1CCC(O)CC1': 'TYR',
  'CC(C)C': 'VAL',
  CC: 'ALA',
};

export default class ResiudeSeq {
  constructor() {
    this._complex = null;
    this._graph = null;
    this._compoundIndx = 0;
    this._curChainID = undefined;
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

    //const maxIndx = distances.indexOf(Math.max(...distances));

    let maxIndx = -1;
    let max = 0;
    for (let i = 0; i < distances.length; i++) {
      if (distances[i] > max) {
        max = distances[i];
        maxIndx = i;
      }
    }
    for (let i = 0; i < vertices.length; i++) {
      if (vertices._index === maxIndx) {
        return vertices[i];
      }
    }
    return null;
  }

  _findConnectedComponents() {
    const atoms = this._complex._atoms;
    const visited = Array(atoms.length).fill(false);
    let startAtom = atoms[0];
    const result = [];
    while (startAtom) {
      result.push(startAtom);
      this._bfs(startAtom, visited);

      let indx = -1;
      for (let i = 0; i < visited.length; i++) {
        if (visited[i] === false) {
          indx = i;
        }
      }

      if (indx === -1) {
        startAtom = false;
      } else {
        startAtom = atoms[indx];
      }
    }

    return result;
  }

  _fixNewAtomsName1(atoms) {
    for (let i = 0; i < atoms.length; i++) {
      atoms[i]._atom._name._name = atoms[i]._atom.element.name;
    }
  }


  _renameResidueAtoms(residues) {
    function bfs(start, visited, distances) {
      distances[start.indx] = 0;
      const vertsQueue = [];
      vertsQueue.push(start);
      while (!_.isEmpty(vertsQueue)) {
        const node = vertsQueue.shift();
        const adjacent = node._adj;
        visited[node.indx] = true;
        for (let i = 0; i < adjacent.length; i++) {
          const nextNode = adjacent[i].node; // adjacent is {node: _node, bontType: int}
          if (!visited[nextNode.indx]) {
            distances[nextNode.indx] = distances[node.indx] + 1;
            vertsQueue.push(nextNode);
          }
        }
      }
    }

    function rename(residue) {
      const start = _.find(residue.atomsSet, ['alphaC', true]);
      const visited = Array(residue.atomsSet.length).fill(false);
      const distances = Array(residue.atomsSet.length).fill(-1);
      bfs(start, visited, distances);

      const atoms = residue.atomsSet;
      for (let i = 0; i < atoms.length; i++) {
        if (distances[atoms[i].indx] !== -1) {
          atoms[i]._atom._name._name += atomNames[distances[atoms[i].indx]];
        }
      }

      for (let i = 0; i < atoms.length; i++) {
        atoms[i]._atom._role = Element.Role[atoms[i]._atom._name._name];
      }
    }

    for (let i = 0; i < residues.length; i++) {
      this._fixNewAtomsName1(residues[i].atomsSet);
      rename(residues[i]);
    }
  }

  defineResidues(complex) {
    this._complex = complex;
    this._graph = new GraphUtils(this._complex._atoms);

    const CC = this._findConnectedComponents();

    if (CC.length === 0) {
      return false;
    }


    const allResidues = [];
    complex._residues = [];
    complex._components = [];
    complex._chains = [];
    complex._molecules = [];
    for (let i = 0; i < CC.length; i++) {
      this._curChainID = CC[i]._residue._chain._name === this._curChainID ? undefined : CC[i]._residue._chain._name;
      this._compoundIndx++;
      const bbone = this._findBackbone(CC[i]);
      if (bbone) {
        const residues = this._getResidues(bbone);
        this._nameResidues(residues);
        this._renameResidueAtoms(residues);
        this._addResidues(residues);
      } else {
        return false;
      }
    }

    this._complex = null;
    this._graph = null;

    return true;
  }

  _tryToFindBackbone(startNode, graph) {
    const newGraph = new GraphUtils(graph._vertices);

    //const bboneStarts = newGraph.DFS4BBone(startNode);

    //if (bboneStarts === null) {
    //  return [];
    //}

    //const allBB = [];

    //for (let i = 0; i < bboneStarts.length; i++) {
    const FSM = new FSMachine();
    const first = graph.DFS(startNode);
    const second = graph.DFS(first);
    const path = graph.getPath(second);
    FSM.eatPath(path);
    return FSM.getResult();
    //allBB.push(..._.difference(path, allBB));
    //}

    //return allBB;
  }

  _isBackbone(path) {
    let FSM = new FSMachine();
    FSM.eatPath(path);
    path = FSM.getResult();
    if (path.length % 3 !== 0 || path.length === 0) {
      return null;
    }

    FSM = new FSMachine();
    FSM.eatPath(path);
    const bbone = FSM.getResult();

    return path.length === bbone.length;
  }

  _backbondIterativeSearch2(startAtom, graph) {
    let newStartAtom = startAtom;
    const visitedVerts = [];
    const allPath = [];
    let path = graph.getAutomatPath();
    while (!visitedVerts.includes(newStartAtom)) {
      if (this._isBackbone(path)) {
        allPath.push(..._.difference(path, allPath));
      }
      visitedVerts.push(newStartAtom);
      newStartAtom = this._bfs(newStartAtom);
      this._tryToFindBackbone(newStartAtom, graph);
      path = graph.getAutomatPath();
    }

    return allPath;
  }

  _backbondIterativeSearch1(startAtom, graph) {
    let newStartAtom = startAtom;
    const visitedVerts = [];
    let path = [];
    while (!visitedVerts.includes(newStartAtom)) {
      visitedVerts.push(newStartAtom);
      newStartAtom = this._bfs(newStartAtom);
    }

    const result = [];
    for (let i = 0; i < visitedVerts.length; i++) {
      const newGraph = new GraphUtils(this._complex._atoms);
      path = this._tryToFindBackbone(visitedVerts[i], newGraph);
      if (this._isBackbone(path)) {
        result.push(...path);
      }
    }
    path = result;

    if (!this._isBackbone(path)) {
      path = this._backbondIterativeSearch2(startAtom, graph);
    }

    return path;
  }

  _findBackbone(startAtom) {
    const graph = this._graph;
    let path = this._tryToFindBackbone(startAtom, graph);

    if (!this._isBackbone(path)) {
      path = this._backbondIterativeSearch1(startAtom, graph);
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

    function Oxygen(atom) {
      const bonds = atom._bonds;
      for (let i = 0; i < bonds.length; i++) {
        const nextAtom = (bonds[i]._left._index === atom._index) ? bonds[i]._right : bonds[i]._left;
        if (nextAtom.element.name === 'O') {
          return new Node(nextAtom);
        }
      }
    }

    const result = [];

    for (let j = 0; j < backbone.length; j += 3) {
      const alphaC = backbone[j + 1];
      const residueGraph = [];
      callDfs.call(this, alphaC, bbverts, residueGraph);

      const SM = new SMILESGenerator();
      residueGraph[0].alphaC = true;
      const smiles = SM.generateCanonicalSMILES(residueGraph);

      const node1 = new Node(backbone[j]);
      const node2 = new Node(backbone[j + 2]);
      const oxygen = Oxygen(backbone[j]) || Oxygen(backbone[j + 2]);
      if (oxygen) {
        residueGraph.push(oxygen);
      }
      residueGraph.push(node1, node2);
      for (let i = 0; i < residueGraph.length; i++) {
        residueGraph[i].indx = i;
      }
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

  _finalize(complex) {
    let i;
    let n;
    const bonds = complex._bonds;

    for (i = bonds.length - 1; i >= 0; i--) {
      const bond = bonds[i];
      if (bond._left === null || bond._right === null) {
        bonds.splice(i, 1);
      }
    }

    const residues = complex._residues;
    for (i = 0; i < residues.length; ++i) {
      residues[i]._finalize();
    }

    complex.forEachChain((a) => {
      a._finalize();
    });

    // WARNING! this MUST be done BEFORE computeBounds is called
    const { units } = complex;
    for (i = 0, n = units.length; i < n; ++i) {
      units[i].finalize();
    }
    // try setting first biomolecule by defaults
    complex.setCurrentUnit(1);

    const residueHash = {};
    for (i = 0, n = residues.length; i < n; ++i) {
      const res = residues[i];
      // This code is extremely dangerous for non-PDB formats
      residueHash[complex.getUnifiedSerial(
        res.getChain().getName().charCodeAt(0),
        res.getSequence(), res.getICode().charCodeAt(0),
      )] = res;
    }

    const { structures } = complex;
    for (i = 0, n = structures.length; i < n; ++i) {
      structures[i]._finalize([], residueHash, complex);
    }

    const helices = complex._helices;
    for (i = 0, n = helices.length; i < n; ++i) {
      helices[i]._finalize([], residueHash, complex);
    }

    const sheets = complex._sheets;
    for (i = 0, n = sheets.length; i < n; ++i) {
      sheets[i]._finalize([], residueHash, complex);
    }

    // Update bounding sphere and box
    complex._computeBounds();

    const atoms = complex._atoms;
    for (i = 0, n = atoms.length; i < n; ++i) {
      const currAtom = atoms[i];
      currAtom._index = i;
    }

    const autoConnector = new AutoBond(complex);
    autoConnector.build();
    autoConnector.destroy();

    const chains = complex._chains;
    for (i = 0, n = chains.length; i < n; ++i) {
      chains[i]._index = i;
    }

    for (i = 0, n = residues.length; i < n; ++i) {
      residues[i]._index = i;
    }

    complex._fillComponents(true);

    complex._finalizeMolecules();
  }

  _addResidues(namedResidues) {
    const complex = this._complex;
    const chainID = buildChainID(this._compoundIndx);
    const chain = complex.getChain(chainID) || complex.addChain(chainID);
    //const chainID = _.isUndefined(this._curChainID) ? buildChainID(this._compoundIndx) : this._curChainID;
    //const chain = complex.getChain(chainID) || complex.addChain(chainID);
    for (let i = 0; i < namedResidues.length; i++) {
      const residue = chain.addResidue(namedResidues[i].name, 1, ' ');
      this._setResiduesForAtoms(namedResidues[i].atomsSet, residue);
      namedResidues[i].atomsSet.forEach(node => residue._atoms.push(node._atom));
      residue._atoms.sort((a, b) => a._index - b._index);
    }

    const residues = complex._residues;
    for (let i = residues.length - 1; i >= 0; i--) {
      if (residues[i] === undefined || residues[i] === null || _.isEmpty(residues[i])) {
        residues.splice(i, 1);
      }
    }
    this._finalize(complex);
  }
}
