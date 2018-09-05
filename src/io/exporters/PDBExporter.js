import Exporter from './Exporter';
import chem from '../../chem';
import PDBResult from './PDBResult';
import Assembly from "../../chem/Assembly";
import BiologicalUnit from "../../chem/BiologicalUnit";

export default class PDBExporter extends Exporter {
  constructor(source, options) {
    super(source, options);
    this._tags = ['HEADER', 'TITLE ', 'COMPND', 'REMARK', 'ATOM  ', 'HETATM', 'ENDMDL', 'CONECT', 'HELIX ', 'SHEET '];
    this._result = null;
    this._resultArray = [];
    this._tagExtractors = {
      'HEADER': this._extractHEADER,
      'TITLE ': this._extractTITLE,
      'ATOM  ': this._extractATOM,
      'HETATM': this._extractATOM,
      //'ENDMDL': this._extractENDMDL,
      'CONECT': this._extractCONECT,
      'COMPND': this._extractCOMPND,
      'REMARK': this._extractREMARK,
      //'HELIX ': this._extractHELIX,
      //'SHEET ': this._extractSHEET,
    };
  }

  exportSync() {
    const result = new PDBResult();
    if (!this._source) {
      return this._result;
    }

    for (let i = 0; i < this._tags.length; i++) {
      const tag = this._tags[i];
      const func = this._tagExtractors[tag];
      if (_.isFunction(func)) {
        func.call(this, result);
      }
    }

    this._result = result.getResult();

    console.log(this._result);
    return this._result;
  }

  _extractHEADER(result) {
    if (!this._source.metadata) {
      return;
    }
    const metadata = this._source.metadata;
    result.newTag('HEADER');
    result.newString();
    if (metadata.classification) {
      result.writeString(metadata.classification, 11, 50);
    }
    if (metadata.date) {
      result.writeString(metadata.date, 51, 59);
    }
    if (metadata.id) {
      result.writeString(metadata.id, 63, 66);
    }
    //result.writeString('\n', 67, 67);
  }

  _extractTITLE(result) {
    if (!this._source.metadata) {
      return;
    }
    const metadata = this._source.metadata;
    if (!metadata.title) {
      return;
    }
    result.newTag('TITLE', true);
    for (let i = 0; i < metadata.title.length; i++) {
      result.newString();
      result.writeString(metadata.title[i], 11, 80);
    }
  }

  _extractCONECT() {
  }

  _extractATOM() {
  }

  _extractCOMPND(result) {
    if (!this._source._molecules) {
      return;
    }
    const molecules = this._source._molecules;
    result.newTag('COMPND', true);
    for (let i = 0; i < molecules.length; i++) {
      const chains = this._getMoleculeChains(molecules[i]);
      result.newString();
      result.writeString('MOL_ID: ' + molecules[i]._index + ';', 11, 80);
      result.newString();
      result.writeString('MOLECULE: ' + molecules[i]._name + ';', 11, 80);
      result.newString();
      result.writeString('CHAIN: ', 11, 17);
      result.writeString(chains.join(', ') + ';', 18, 80);
    }
  }

  _extractREMARK(result) {
    this._Remark290(result);
    this._Remark350(result);
  }

  _Remark290(result) {
    if (!this._source.symmetry) {
      return;
    }
    const matrices = this._source.symmetry;
    result.newTag('REMARK', 290);
    result.newString();
    result.newString();
    result.writeString('CRYSTALLOGRAPHIC SYMMETRY TRANSFORMATIONS', 11, 80);
    result.newString();
    result.writeString('THE FOLLOWING TRANSFORMATIONS OPERATE ON THE ATOM/HETATM', 11, 80);
    result.newString();
    result.writeString('RECORDS IN THIS ENTRY TO PRODUCE CRYSTALLOGRAPHICALLY', 11, 80);
    result.newString();
    result.writeString('RELATED MOLECULES.', 11, 80);
    for (let i = 0; i < matrices.length; i++) {
      const matrix = matrices[i].transpose();
      result.writeMatrix(matrix, i+1, '  SMTRY');
    }

    result.newString();
    result.newString();
    result.writeString('REMARK: NULL', 11, 80);
  }

  _Remark350(result) {
    if (!this._source.units) {
      return;
    }
    const units = this._source.units;
    let biomolIndx = 0;
    result.newTag('REMARK', 350);
    result.newString();
    result.newString();
    result.writeString('COORDINATES FOR A COMPLETE MULTIMER  REPRESENTING THE KNOWN', 11, 80);
    result.newString();
    result.writeString('BIOLOGICALLY SIGNIFICANT OLIGOMERIZATION STATE  OF THE', 11, 80);
    result.newString();
    result.writeString('MOLECULE CAN BE GENERATED BY APPLYING BIOMT  TRANSFORMATIONS', 11, 80);
    result.newString();
    result.writeString('GIVEN BELOW.  BOTH NON-CRYSTALLOGRAPHIC  AND', 11, 80);
    result.newString();
    result.writeString('CRYSTALLOGRAPHIC OPERATIONS ARE GIVEN.', 11, 80);

    for (let i = 0; i < units.length; i++) {
      if (units[i] instanceof Assembly) {
        result.newString();
        result.newString();
        biomolIndx++;
        result.writeString('BIOMOLECULE: '+biomolIndx, 11, 80);
        if (units[i].chains) {
          const chains = units[i].chains.join(', ');

          let size = 30;
          let chainArrays = [];
          for (let j = 0; j <Math.ceil(chains.length/size); j++) {
            chainArrays[j] = chains.slice((j*size), (j*size) + size);
          }
          result.newString();
          result.writeString("APPLY THE FOLLOWING TO CHAINS: " + chainArrays[0], 11, 80);
          for (let j = 1; j < chainArrays.length; j++) {
            result.newString();
            result.writeString("AND CHAINS: " + chainArrays[j], 31, 80);
          }
        }

        const matrices = units[i].matrices;
        if (matrices) {
          for (let j = 0; j < matrices.length; j++) {
            const matrix = matrices[j].transpose();
            result.writeMatrix(matrix, j + 1, '  BIOMT');
          }
        }
      }
    }
  }

  _getMoleculeChains(molecule) {
    function getChainName(residue) {
      return residue._chain._name;
    }
    const chainNames = molecule._residues.map(getChainName);
    return chainNames.filter(function(item, pos) {
      return chainNames.indexOf(item) === pos;
    });
  }

  _finalize() {
    this._result = this._resultArray.join('');
  }
}

PDBExporter.formats = ['pdb'];
