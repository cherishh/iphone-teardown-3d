import * as THREE from 'three';
import {
  createInkLineMaterial,
  createPaperOccluderMaterial,
  createSilhouetteMaterial,
  type InkStyleHandle,
} from './blueprintMaterials';

/**
 * Create a centered rounded-rectangle THREE.Shape.
 */
export function createRoundedRectShape(
  width: number,
  height: number,
  radius: number
): THREE.Shape {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w - 0.001, h - 0.001);
  const shape = new THREE.Shape();

  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(w, h - r);
  shape.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-w + r, h);
  shape.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w, -h + r);
  shape.absarc(-w + r, -h + r, r, Math.PI, (Math.PI * 3) / 2, false);

  return shape;
}

/**
 * Create a centered rounded-rectangle Path (for cutting holes in shapes).
 */
export function createRoundedRectPath(
  width: number,
  height: number,
  radius: number,
  offsetX = 0,
  offsetY = 0
): THREE.Path {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w - 0.001, h - 0.001);
  const path = new THREE.Path();

  path.moveTo(offsetX - w + r, offsetY - h);
  path.lineTo(offsetX + w - r, offsetY - h);
  path.absarc(offsetX + w - r, offsetY - h + r, r, -Math.PI / 2, 0, false);
  path.lineTo(offsetX + w, offsetY + h - r);
  path.absarc(offsetX + w - r, offsetY + h - r, r, 0, Math.PI / 2, false);
  path.lineTo(offsetX - w + r, offsetY + h);
  path.absarc(offsetX - w + r, offsetY + h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(offsetX - w, offsetY - h + r);
  path.absarc(
    offsetX - w + r,
    offsetY - h + r,
    r,
    Math.PI,
    (Math.PI * 3) / 2,
    false
  );

  return path;
}

/**
 * Create a pill-shaped THREE.Shape (Dynamic Island, side buttons, USB-C).
 */
export function createPillShape(width: number, height: number): THREE.Shape {
  return createRoundedRectShape(width, height, Math.min(width, height) / 2);
}

/**
 * Create a centered extruded rounded plate along Z.
 */
export function createRoundedPlateGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
  bevel = 0,
  curveSegments = 20
): THREE.ExtrudeGeometry {
  const shape = createRoundedRectShape(width, height, radius);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: bevel > 0 ? 2 : 1,
    curveSegments,
  });
  geo.center();
  return geo;
}

/**
 * Create a hollowed rounded-rectangle frame (for the CNC titanium rail).
 */
export function createHollowFrameGeometry(
  outerW: number,
  outerH: number,
  wallThickness: number,
  depth: number,
  outerR: number,
  bevel = 0.025
): THREE.ExtrudeGeometry {
  const outer = createRoundedRectShape(outerW, outerH, outerR);
  const innerW = outerW - wallThickness * 2;
  const innerH = outerH - wallThickness * 2;
  const innerR = Math.max(0.05, outerR - wallThickness);
  outer.holes.push(createRoundedRectPath(innerW, innerH, innerR));

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: Math.max(0.01, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 22,
  });
  geo.center();
  return geo;
}

/**
 * Create a polygon shape with rounded corners from 2D vertices (for L-shaped battery & logic board).
 */
export function createRoundedPolygonShape(
  pts: [number, number][],
  cornerRadius = 0.08
): THREE.Shape {
  const shape = new THREE.Shape();
  const n = pts.length;

  for (let i = 0; i < n; i++) {
    const prev = new THREE.Vector2(...pts[(i - 1 + n) % n]);
    const curr = new THREE.Vector2(...pts[i]);
    const next = new THREE.Vector2(...pts[(i + 1) % n]);

    const v1 = prev.clone().sub(curr);
    const v2 = next.clone().sub(curr);
    const r = Math.min(cornerRadius, v1.length() * 0.42, v2.length() * 0.42);

    const p1 = curr.clone().add(v1.normalize().multiplyScalar(r));
    const p2 = curr.clone().add(v2.normalize().multiplyScalar(r));

    if (i === 0) {
      shape.moveTo(p1.x, p1.y);
    } else {
      shape.lineTo(p1.x, p1.y);
    }
    shape.quadraticCurveTo(curr.x, curr.y, p2.x, p2.y);
  }
  shape.closePath();
  return shape;
}

/**
 * Create a ring-sector trapezoid shape (for individual MagSafe neodymium magnets).
 */
export function createArcSegmentGeometry(
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
  depth: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, startAngle, endAngle, false);
  shape.absarc(0, 0, innerR, endAngle, startAngle, true);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 8,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

export interface AddCadMeshOptions {
  partId: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  edgeThreshold?: number;
  edgeOpacity?: number;
  softInk?: boolean;
  shadeTint?: number;
  hatchScale?: number;
  silhouette?: boolean;
  silhouetteThickness?: number;
  doubleSide?: boolean;
}

/**
 * Adds a genuine Hidden-Line-Removal CAD solid to a group:
 * 1. Paper Occluder Mesh (writes depth, subtle cross-hatching)
 * 2. Crisp Feature Edges (EdgesGeometry with clean angle threshold)
 * 3. Optional constant-width BackSide Silhouette (for smooth curved solids)
 */
export function addCadMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  handle: InkStyleHandle,
  options: AddCadMeshOptions
): THREE.Group {
  const {
    partId,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    edgeThreshold = 22,
    edgeOpacity = 0.94,
    softInk = false,
    shadeTint = 0.0,
    hatchScale = 1.0,
    silhouette = false,
    silhouetteThickness = 1.25,
    doubleSide = false,
  } = options;

  const holder = new THREE.Group();
  holder.position.set(...position);
  holder.rotation.set(...rotation);

  const occluderMat = createPaperOccluderMaterial({
    shadeTint,
    hatchScale,
    doubleSide,
  });
  const solid = new THREE.Mesh(geometry, occluderMat);
  solid.userData.partId = partId;
  holder.add(solid);
  handle.occluders.push(occluderMat);

  if (edgeOpacity > 0) {
    const edgesGeo = new THREE.EdgesGeometry(geometry, edgeThreshold);
    const lineMat = createInkLineMaterial(edgeOpacity, softInk);
    lineMat.userData.baseOpacity = edgeOpacity;
    const lines = new THREE.LineSegments(edgesGeo, lineMat);
    lines.userData.partId = partId;
    holder.add(lines);
    handle.lines.push(lineMat);
  }

  if (silhouette) {
    const silMat = createSilhouetteMaterial(silhouetteThickness);
    const silMesh = new THREE.Mesh(geometry, silMat);
    silMesh.userData.partId = partId;
    holder.add(silMesh);
    handle.silhouettes.push(silMat);
  }

  parent.add(holder);
  return holder;
}

/**
 * Adds pure ink schematic line segments (PCB traces, spirals, crosshairs, screw slots).
 */
export function addInkSegments(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  handle: InkStyleHandle,
  partId: string,
  opacity = 0.78,
  soft = false
): THREE.LineSegments {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = createInkLineMaterial(opacity, soft);
  mat.userData.baseOpacity = opacity;
  const segs = new THREE.LineSegments(geo, mat);
  segs.userData.partId = partId;
  parent.add(segs);
  handle.lines.push(mat);
  return segs;
}

/**
 * Adds a continuous ink polyline curve (coils, rounded outlines, flex traces).
 */
export function addInkPolyline(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  handle: InkStyleHandle,
  partId: string,
  opacity = 0.85,
  soft = false
): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = createInkLineMaterial(opacity, soft);
  mat.userData.baseOpacity = opacity;
  const line = new THREE.Line(geo, mat);
  line.userData.partId = partId;
  parent.add(line);
  handle.lines.push(mat);
  return line;
}

/**
 * Helper to generate points of a 2D circle in XY plane at z.
 */
export function circlePointsXY(
  cx: number,
  cy: number,
  r: number,
  z: number,
  segments = 48
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z));
  }
  return pts;
}

/**
 * Helper to generate points of a rounded rectangle outline in XY plane at z.
 */
export function roundedRectPointsXY(
  width: number,
  height: number,
  radius: number,
  z: number,
  cx = 0,
  cy = 0,
  divisions = 12
): THREE.Vector3[] {
  const shape = createRoundedRectShape(width, height, radius);
  const pts2d = shape.getPoints(divisions);
  return pts2d.map((p) => new THREE.Vector3(p.x + cx, p.y + cy, z));
}
