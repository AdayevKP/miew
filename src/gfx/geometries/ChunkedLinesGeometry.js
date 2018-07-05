import LinesGeometry from './LinesGeometry';
import CylinderCollisionGeo from './CylinderCollisionGeo';

const COLLISION_RAD = 0.1;

/**
 * This class represents geometry which consists of separate chunks.
 * Each chunk has same index and similar geometry with equal points and faces count.
 * Each chunk has by default only one color.
 * @constructor
 *
 * @param {number}  chunksCount     Total chunks count.
 * @param {number}  segmentsCount   Number of segments per chunk.
 * @param {boolean} enableCollision Enable or disable collision where each segment is
 *                                  a collidable cylinder.
 * collision geometry.
 */
function ChunkedLinesGeometry(chunksCount, segmentsCount, enableCollision) {
  LinesGeometry.call(this, chunksCount * segmentsCount);
  this._init(segmentsCount);
  this._collisionGeo = enableCollision ? new CylinderCollisionGeo(chunksCount * segmentsCount, 3) : null;
}

ChunkedLinesGeometry.prototype = Object.create(LinesGeometry.prototype);
ChunkedLinesGeometry.prototype.constructor = ChunkedLinesGeometry;
ChunkedLinesGeometry.prototype.parent = LinesGeometry.prototype;

ChunkedLinesGeometry.prototype.startUpdate = function() {
  return true;
};

ChunkedLinesGeometry.prototype.computeBoundingSphere = function() {
  const collisionGeo = this._collisionGeo;
  if (collisionGeo)  {
    collisionGeo.computeBoundingSphere();
    this.boundingSphere = collisionGeo.boundingSphere;
    return;
  }
  this.parent.computeBoundingSphere.call(this);
};

ChunkedLinesGeometry.prototype.computeBoundingBox = function() {
  const collisionGeo = this._collisionGeo;
  if (collisionGeo)  {
    collisionGeo.computeBoundingBox();
    this.boundingBox = collisionGeo.boundingBox;
    return;
  }
  this.parent.computeBoundingBox.call(this);
};

ChunkedLinesGeometry.prototype.raycast = function(raycaster, intersects) {
  const collisionGeo = this._collisionGeo;
  if (!collisionGeo)  {
    return;
  }
  const segCount = this._chunkSize;
  this._collisionGeo.raycast(raycaster, intersects);
  for (let i = 0, n = intersects.length; i < n; ++i) {
    let chunkIdx = intersects[i].chunkIdx;
    if (chunkIdx === undefined) {
      continue;
    }
    chunkIdx = (chunkIdx / segCount) | 0;
    intersects[i].chunkIdx = chunkIdx;
  }
};

ChunkedLinesGeometry.prototype.setColor = function(chunkIdx, colorVal) {
  const chunkSize = this._chunkSize;
  for (let i = chunkIdx * chunkSize, end = i + chunkSize; i < end; ++i) {
    this.parent.setColor.call(this, i, colorVal);
  }
};

ChunkedLinesGeometry.prototype.setSegment = function(chunkIdx, segIdx, pos1, pos2) {
  const chunkSize = this._chunkSize;
  const idx = chunkIdx * chunkSize + segIdx;
  this.parent.setSegment.call(this, idx, pos1, pos2);
  if (this._collisionGeo) {
    this._collisionGeo.setItem(chunkIdx * chunkSize + segIdx, pos1, pos2, COLLISION_RAD);
  }
};

ChunkedLinesGeometry.prototype.finalize = function() {
  this.finishUpdate();
  // TODO compute bounding box?
  this.computeBoundingSphere();
};

ChunkedLinesGeometry.prototype.setOpacity = function(chunkIndices, value) {
  const chunkSize = this._chunkSize;
  for (let i = 0, n = chunkIndices.length; i < n; ++i) {
    const left = chunkIndices[i] * chunkSize;
    this.parent.setOpacity.call(this, left, left + chunkSize - 1, value);
  }
};

ChunkedLinesGeometry.prototype.getSubset = function(chunkIndices) {
  const instanceCount = chunkIndices.length;
  const chunkSize = this._chunkSize;
  const subset = new ChunkedLinesGeometry(instanceCount, chunkSize, false);
  for (let i = 0, n = chunkIndices.length; i < n; ++i) {
    const dstPtOffset = i * chunkSize;
    const startSegIdx = chunkIndices[i] * chunkSize;
    subset.setSegments(dstPtOffset, this.getSubsetSegments(startSegIdx, chunkSize));
    subset.setColors(dstPtOffset, this.getSubsetColors(startSegIdx, chunkSize));
  }

  subset.boundingSphere = this.boundingSphere;
  subset.boundingBox = this.boundingBox;
  return [subset];
};

ChunkedLinesGeometry.prototype._init = function(chunkSize) {
  this._chunkSize = chunkSize;
};

export default ChunkedLinesGeometry;

