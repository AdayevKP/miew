

import * as THREE from 'three';

/**
 * This class adds raycasting interface to indexed
 * THREE.BufferGeometry.
 * @constructor
 */

class RaycastableBufferGeometry extends THREE.BufferGeometry {
  constructor() {
    super();
  }

  // This method was copied from three.js

  static vA = new THREE.Vector3();

  static vB = new THREE.Vector3();

  static vC = new THREE.Vector3();


  static uvA = new THREE.Vector2();

  static uvB = new THREE.Vector2();

  static uvC = new THREE.Vector2();


  static barycoord = new THREE.Vector3();


  static intersectionPoint = new THREE.Vector3();

  uvIntersection(point, p1, p2, p3, uv1, uv2, uv3) {
    THREE.Triangle.barycoordFromPoint(point, p1, p2, p3, RaycastableBufferGeometry.barycoord);

    uv1.multiplyScalar(RaycastableBufferGeometry.barycoord.x);
    uv2.multiplyScalar(RaycastableBufferGeometry.barycoord.y);
    uv3.multiplyScalar(RaycastableBufferGeometry.barycoord.z);

    uv1.add(uv2).add(uv3);
    return uv1.clone();
  }

  checkIntersection(object, raycaster, ray, pA, pB, pC, point) {
    //let intersect;
    const intersect = ray.intersectTriangle(pA, pB, pC, false, point);

    if (intersect === null) {
      return null;
    }

    return {
      point: point.clone()
    };
  }

  checkBufferGeometryIntersection(object, raycaster, ray, position, uv, a, b, c) {
    RaycastableBufferGeometry.vA.fromBufferAttribute(position, a);
    RaycastableBufferGeometry.vB.fromBufferAttribute(position, b);
    RaycastableBufferGeometry.vC.fromBufferAttribute(position, c);

    const intersection = this.checkIntersection(
      object, raycaster, ray,
      RaycastableBufferGeometry.vA,
      RaycastableBufferGeometry.vB,
      RaycastableBufferGeometry.vC,
      RaycastableBufferGeometry.intersectionPoint
    );
    if (intersection) {
      if (uv) {
        RaycastableBufferGeometry.uvA.fromBufferAttribute(uv, a);
        RaycastableBufferGeometry.uvB.fromBufferAttribute(uv, b);
        RaycastableBufferGeometry.uvC.fromBufferAttribute(uv, c);
        intersection.uv = this.uvIntersection(
          RaycastableBufferGeometry.intersectionPoint,
          RaycastableBufferGeometry.vA,
          RaycastableBufferGeometry.vB,
          RaycastableBufferGeometry.vC,
          RaycastableBufferGeometry.uvA,
          RaycastableBufferGeometry.uvB,
          RaycastableBufferGeometry.uvC
        );
      }
      const normal = new THREE.Vector3();
      THREE.Triangle.getNormal(
        RaycastableBufferGeometry.vA,
        RaycastableBufferGeometry.vB,
        RaycastableBufferGeometry.vC,
        normal
      );
      intersection.face = new THREE.Face3(a, b, c, normal);
      intersection.faceIndex = a;
    }

    return intersection;
  }

  raycast(raycaster, intersects) {
    const ray = raycaster.ray;
    if (this.boundingSphere === null) {
      this.computeBoundingSphere();
    }

    if (raycaster.ray.intersectsSphere(this.boundingSphere) === false) {
      return;
    }

    if (this.boundingBox !== null) {
      if (ray.intersectsBox(this.boundingBox) === false) {
        return;
      }
    }

    let a, b, c;
    const index = this.index;
    const position = this.attributes.position;
    const uv = this.attributes.uv;
    let i, l;

    if (index === null) {
      return;
    }
    // indexed buffer geometry
    for (i = 0, l = index.count; i < l; i += 3) {
      a = index.getX(i);
      b = index.getX(i + 1);
      c = index.getX(i + 2);

      const intersection = this.checkBufferGeometryIntersection(this, raycaster, ray, position, uv, a, b, c);

      if (intersection) {
        intersection.faceIndex = Math.floor(i / 3); // triangle number in indices buffer semantics
        intersects.push(intersection);
      }
    }
  }
}

export default RaycastableBufferGeometry;

