import fs from 'fs';
import path from 'path';
import chai, { expect } from 'chai';
import dirtyChai from 'dirty-chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import PDBParser from '../../src/io/parsers/PDBParser';
import XYZParser from '../../src/io/parsers/XYZParser';
import PDBExporter from '../../src/io/exporters/PDBExporter';
import SDFParser from "../../src/io/parsers/SDFParser";
import ResiudeSeq from "../../src/chem/ResidueSeq";

chai.use(dirtyChai);
chai.use(sinonChai);
chai.use(chaiAsPromised);

const standartAmino = [
  'ARG',
  'ASN',
  'ASP',
  'CYS',
  'GLY',
  'GLN',
  'GLY',
  'HIS',
  'ILE',
  'LEU',
  'LYS',
  'MET',
  'PHE',
  'PRO',
  'SEC',
  'SER',
  'THR',
  'TRP',
  'TYR',
  'VAL',
  'ALA',
  'UNK',
];

describe('Residues test', () => {
  /*
  for (let i = 0; i < filesForTest.length; i++) {
    it(`for ${filesForTest[i]}`, () => getInitialString(filesForTest[i]).then((data) => {
      expect(filterLines(getExportedString(data))).to.deep.equal(filterLines(data));
    }));
  }
  */
  const pathTF = 'C:/Users/Kirill/Desktop/diplom take2/pitonScript/';
  let filePath = pathTF + '4a2i' + '.pdb'
  let string = fs.readFileSync(filePath, 'ascii');
  const prsr1 = new PDBParser(string);
  const complexPDB = prsr1.parseSync();

  filePath = pathTF + '4a2i' + '.xyz'
  string = fs.readFileSync(filePath, 'ascii');
  const prsr2 = new XYZParser(string, {});
  const complexXYZ = prsr2.parseSync();
  const RS = new ResiudeSeq();
  RS.defineResidues(complexXYZ);

  let counterPBD = 0;
  let residues = complexPDB._residues;
  for (let i = 0; i < residues.length; i++) {
    const res = standartAmino.find(a => a === residues[i]._type._name);
    if (res !== undefined) {
      counterPBD++;
    }
  }

  let counterXYZ = 0;
  residues = complexXYZ._residues;
  for (let i = 0; i < residues.length; i++) {
    const res = standartAmino.find(a => a === residues[i]._type._name);
    if (res !== undefined) {
      counterXYZ++;
    }
  }

  counterPBD = 0;
});
