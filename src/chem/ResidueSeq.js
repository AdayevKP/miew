import GraphUtils from '../utils/GraphUtils';
import FSMachine from '../utils/FSMachine';
import chem from '../chem';

const {
  Complex,
  Element,
  Bond,
  Molecule,
  Atom,
} = chem;

class residue {

}

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


    this._nameResidues(residues);
    this._addResidues(residues);
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

    if (path.length !== bbone.length) {
      return false;
    }

    return true;
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

    function getLongest(array) {
      let longest = '';
      for (let i = 0; i < array.length; i++) {
        if (array[i].replace(/[{()}]/g, '').length > longest.replace(/[{()}]/g, '').length) {
          longest = array[i];
        }
      }
      array.splice(array.indexOf(longest), 1);
      return longest;
    }

    function dfs(atom, visited, atoms, prevAtom = null) {
      const bondSymbols = ['', '=', '#', '$'];
      atoms.push(atom);
      visited[atom._index] = true;
      const bonds = atom._bonds;
      const strings = [];
      let numb = 0;
      for (let i = 0; i < atom._bonds.length; i++) {
        const nextAtom = (bonds[i]._left._index === atom._index) ? bonds[i]._right : bonds[i]._left;
        const bond = bondSymbols[bonds[i]._order - 1];
        if (!visited[nextAtom._index]) {
          strings.push(bond + dfs.call(this, nextAtom, visited, atoms, atom));
        } else if (nextAtom !== prevAtom && atoms.includes(nextAtom) && !this._cycleBonds.includes(bonds[i])) {
          this._cycle = true;
          this._cAtoms.push(nextAtom);
          this._cycleBonds.push(bonds[i]);
          this._cycles[nextAtom._index] = ++this._cycleIndx;
          numb = 10 * numb + this._cycleIndx;
        }
      }

      if (this._cAtoms.includes(atom)) {
        numb = 10 * numb + this._cycles[atom._index];
        this._cAtoms.splice(this._cAtoms.indexOf(atom), 1);
        this._cycle = !(this._cAtoms.length === 0);
      }

      let atomName = atom.element.name === 'H' ? '' : atom.element.name;
      atomName = numb ? atomName + numb : atomName;
      const longest = getLongest(strings);
      strings.forEach((element, index, array) => {
        if (element !== '') {
          array[index] = `(${element})`;
        }
      });
      const result = atomName + strings.join('') + longest;
      return result;
    }

    function callDfs(start, verts, set) {
      this._cycleIndx = 0;
      this._cycle = false;
      this._cAtoms = [];
      this._cycles = {};
      this._cycleBonds = [];
      verts[start._index] = false;
      const smarts = dfs.call(this, start, verts, set);
      verts[start._index] = true;
      return smarts;
    }

    const result = [];

    for (let j = 0; j < backbone.length; j += 3) {
      const alphaC = backbone[j + 1];
      const atomsSet = [];
      bbverts[backbone[j]._index] = false;
      bbverts[backbone[j + 2]._index] = false;
      const smarts = callDfs.call(this, alphaC, bbverts, atomsSet);
      bbverts[backbone[j]._index] = true;
      bbverts[backbone[j + 2]._index] = true;
      result.push({atoms: atomsSet, SMARTS: smarts});
    }

    return result;
  }

  _setOccupancy(occ, res) {
    for (let i = 0; i < res.atoms.length; i++) {
      res.atoms[i]._occupancy = occ;
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
      this._setOccupancy(occ, residues[i]);
      occ = !occ;
    }
  }

  _addResidues() {
  }
}
