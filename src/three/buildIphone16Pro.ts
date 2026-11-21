import * as THREE from 'three';
import { IPHONE_PARTS, type IphonePartMeta } from '../data/parts';
import {
  createDashedGuideMaterial,
  createEmptyStyleHandle,
  type InkStyleHandle,
} from './blueprintMaterials';
import {
  addCadMesh,
  addInkPolyline,
  addInkSegments,
  circlePointsXY,
  createArcSegmentGeometry,
  createHollowFrameGeometry,
  createPillShape,
  createRoundedPlateGeometry,
  createRoundedPolygonShape,
  createRoundedRectPath,
  createRoundedRectShape,
  roundedRectPointsXY,
} from './geometryHelpers';

export const PHONE_W = 3.575;
export const PHONE_H = 7.48;
export const PHONE_R = 0.56;

export interface ExplodableSubPart {
  object: THREE.Object3D;
  basePosition: THREE.Vector3;
  explodeDelta: THREE.Vector3;
  baseRotation?: THREE.Euler;
  explodeRotationDelta?: THREE.Vector3;
}

export interface BuiltPart {
  id: string;
  meta: IphonePartMeta;
  group: THREE.Group;
  style: InkStyleHandle;
  basePosition: THREE.Vector3;
  explodeVector: THREE.Vector3;
  subParts: ExplodableSubPart[];
  /** Live highlight/dim state smoothed per frame */
  currentHighlight: number;
  currentDim: number;
}

export interface DynamicGuideLine {
  line: THREE.Line;
  material: THREE.LineDashedMaterial;
  fromPartId: string;
  fromLocal: THREE.Vector3;
  toPartId: string;
  toLocal: THREE.Vector3;
}

export interface BuiltIphoneAssembly {
  root: THREE.Group;
  parts: Map<string, BuiltPart>;
  guides: DynamicGuideLine[];
  updateExplode: (t: number) => void;
  getPartProgress: (partId: string) => number;
}

/**
 * Helper to create a clean schematic screw (cylindrical head + shank + cross/star slot)
 */
function buildMicroScrew(
  parent: THREE.Object3D,
  handle: InkStyleHandle,
  partId: string,
  pos: [number, number, number],
  rot: [number, number, number],
  scale = 1.0
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.rotation.set(...rot);

  const headGeo = new THREE.CylinderGeometry(0.068 * scale, 0.068 * scale, 0.036 * scale, 14);
  headGeo.rotateX(Math.PI / 2);
  addCadMesh(g, headGeo, handle, {
    partId,
    position: [0, 0, 0.06 * scale],
    edgeThreshold: 28,
    edgeOpacity: 0.92,
    shadeTint: 0.15,
  });

  const shankGeo = new THREE.CylinderGeometry(0.034 * scale, 0.03 * scale, 0.14 * scale, 10);
  shankGeo.rotateX(Math.PI / 2);
  addCadMesh(g, shankGeo, handle, {
    partId,
    position: [0, 0, -0.02 * scale],
    edgeThreshold: 30,
    edgeOpacity: 0.85,
  });

  // Thread rings along shank
  const threadPts: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const z = (-0.07 + i * 0.028) * scale;
    const r = 0.036 * scale;
    threadPts.push(
      new THREE.Vector3(-r, 0, z),
      new THREE.Vector3(r, 0, z)
    );
  }
  // Star / cross drive slot on head face
  const hz = 0.08 * scale;
  const sr = 0.038 * scale;
  threadPts.push(
    new THREE.Vector3(-sr, 0, hz),
    new THREE.Vector3(sr, 0, hz),
    new THREE.Vector3(0, -sr, hz),
    new THREE.Vector3(0, sr, hz)
  );
  addInkSegments(g, threadPts, handle, partId, 0.85);

  parent.add(g);
  return g;
}

/**
 * Builds the complete 11-layer anatomically accurate iPhone 16 Pro CAD blueprint assembly.
 */
export function buildIphone16Pro(): BuiltIphoneAssembly {
  const root = new THREE.Group();
  const parts = new Map<string, BuiltPart>();

  function registerPart(id: string): BuiltPart {
    const meta = IPHONE_PARTS.find((p) => p.id === id);
    if (!meta) throw new Error(`Unknown part metadata: ${id}`);
    const group = new THREE.Group();
    group.name = id;
    root.add(group);
    const built: BuiltPart = {
      id,
      meta,
      group,
      style: createEmptyStyleHandle(),
      basePosition: new THREE.Vector3(0, 0, 0),
      explodeVector: new THREE.Vector3(...meta.explodeOffset),
      subParts: [],
      currentHighlight: 0,
      currentDim: 0,
    };
    parts.set(id, built);
    return built;
  }

  // =========================================================================
  // 01. CERAMIC SHIELD FRONT GLASS & SUPER RETINA XDR DISPLAY
  // =========================================================================
  {
    const part = registerPart('ceramic-display');
    const g = part.group;
    const h = part.style;
    const zBase = 0.21;

    // Outer ultra-thin Ceramic Shield plate
    const plateGeo = createRoundedPlateGeometry(
      PHONE_W - 0.06,
      PHONE_H - 0.06,
      0.055,
      PHONE_R - 0.03,
      0.012,
      24
    );
    addCadMesh(g, plateGeo, h, {
      partId: part.id,
      position: [0, 0, zBase],
      edgeThreshold: 22,
      edgeOpacity: 0.96,
      silhouette: true,
      silhouetteThickness: 1.3,
      hatchScale: 0.85,
    });

    // Active OLED display bezel perimeter (ultra-thin 1.15mm BRS bezel)
    const activeW = PHONE_W - 0.24;
    const activeH = PHONE_H - 0.24;
    const activeR = PHONE_R - 0.12;
    addInkPolyline(
      g,
      roundedRectPointsXY(activeW, activeH, activeR, zBase + 0.03, 0, 0, 14),
      h,
      part.id,
      0.88
    );

    // Subtle secondary inner engineering frame
    addInkPolyline(
      g,
      roundedRectPointsXY(activeW - 0.12, activeH - 0.12, activeR - 0.06, zBase + 0.03, 0, 0, 12),
      h,
      part.id,
      0.26,
      true
    );

    // Dynamic Island pill cutout outline + optical sensor sub-circles
    const pillPts = createPillShape(1.06, 0.31)
      .getPoints(14)
      .map((p) => new THREE.Vector3(p.x, p.y + 3.12, zBase + 0.032));
    addInkPolyline(g, pillPts, h, part.id, 0.96);

    // Inner camera & Face ID reticles inside Dynamic Island
    addInkPolyline(g, circlePointsXY(0.32, 3.12, 0.095, zBase + 0.033, 28), h, part.id, 0.88);
    addInkPolyline(g, circlePointsXY(0.32, 3.12, 0.048, zBase + 0.033, 20), h, part.id, 0.65);
    addInkPolyline(g, circlePointsXY(-0.24, 3.12, 0.075, zBase + 0.033, 24), h, part.id, 0.72);
    addInkPolyline(g, circlePointsXY(-0.02, 3.12, 0.055, zBase + 0.033, 20), h, part.id, 0.55);

    // Top earpiece micro-slit
    const slitPts = createPillShape(0.68, 0.042)
      .getPoints(8)
      .map((p) => new THREE.Vector3(p.x, p.y + 3.55, zBase + 0.032));
    addInkPolyline(g, slitPts, h, part.id, 0.85);

    // Subtle patent drafting centerlines & corner registration ticks on screen face
    const zFront = zBase + 0.031;
    const screenDraftPts: THREE.Vector3[] = [
      // Center crosshair
      new THREE.Vector3(-0.22, 0, zFront),
      new THREE.Vector3(0.22, 0, zFront),
      new THREE.Vector3(0, -0.22, zFront),
      new THREE.Vector3(0, 0.22, zFront),
      // Faint diagonal drafting axis
      new THREE.Vector3(-activeW * 0.42, -activeH * 0.44, zFront),
      new THREE.Vector3(activeW * 0.42, activeH * 0.44, zFront),
      // Horizontal proportion ticks
      new THREE.Vector3(-activeW * 0.46, 0, zFront),
      new THREE.Vector3(-activeW * 0.4, 0, zFront),
      new THREE.Vector3(activeW * 0.4, 0, zFront),
      new THREE.Vector3(activeW * 0.46, 0, zFront),
      // Bottom home indicator capsule guide
      new THREE.Vector3(-0.62, -3.38, zFront),
      new THREE.Vector3(0.62, -3.38, zFront),
    ];
    addInkSegments(g, screenDraftPts, h, part.id, 0.22, true);

    // Back-side OLED copper graphite backing plate & flex driver ribbon
    const backShieldGeo = createRoundedPlateGeometry(
      PHONE_W - 0.36,
      PHONE_H - 0.52,
      0.018,
      PHONE_R - 0.2,
      0,
      14
    );
    addCadMesh(g, backShieldGeo, h, {
      partId: part.id,
      position: [0, -0.05, zBase - 0.036],
      edgeThreshold: 25,
      edgeOpacity: 0.52,
      softInk: true,
      shadeTint: 0.2,
    });

    // Display COF Flex ribbon cable protruding slightly on lower-left back
    const flexGeo = new THREE.BoxGeometry(0.42, 0.95, 0.014);
    addCadMesh(g, flexGeo, h, {
      partId: part.id,
      position: [-0.95, -2.55, zBase - 0.05],
      edgeThreshold: 20,
      edgeOpacity: 0.8,
      shadeTint: 0.25,
    });
  }

  // =========================================================================
  // 02. TRUEDEPTH & DYNAMIC ISLAND SENSOR ARRAY
  // =========================================================================
  {
    const part = registerPart('truedepth');
    const g = part.group;
    const h = part.style;
    const zBase = 0.095;
    const yBase = 3.12;

    // Main precision bracket housing
    const bracketGeo = createRoundedPlateGeometry(1.18, 0.38, 0.085, 0.12, 0.01, 14);
    addCadMesh(g, bracketGeo, h, {
      partId: part.id,
      position: [0.02, yBase, zBase],
      edgeThreshold: 22,
      edgeOpacity: 0.94,
      shadeTint: 0.12,
    });

    // 12MP Front Camera barrel (right side of island)
    const camBarrelGeo = new THREE.CylinderGeometry(0.115, 0.125, 0.12, 24);
    camBarrelGeo.rotateX(Math.PI / 2);
    addCadMesh(g, camBarrelGeo, h, {
      partId: part.id,
      position: [0.32, yBase, zBase + 0.03],
      edgeThreshold: 24,
      edgeOpacity: 0.95,
      silhouette: true,
      silhouetteThickness: 1.0,
    });
    addInkPolyline(g, circlePointsXY(0.32, yBase, 0.068, zBase + 0.092, 24), h, part.id, 0.85);

    // Dot Projector micro-optics cube (left side)
    const dotGeo = new THREE.BoxGeometry(0.22, 0.22, 0.11);
    addCadMesh(g, dotGeo, h, {
      partId: part.id,
      position: [-0.34, yBase, zBase + 0.02],
      edgeThreshold: 20,
      edgeOpacity: 0.92,
      shadeTint: 0.18,
    });
    addInkPolyline(g, circlePointsXY(-0.34, yBase, 0.065, zBase + 0.078, 20), h, part.id, 0.8);

    // IR Camera + Flood Illuminator center unit
    const irGeo = new THREE.CylinderGeometry(0.088, 0.095, 0.11, 20);
    irGeo.rotateX(Math.PI / 2);
    addCadMesh(g, irGeo, h, {
      partId: part.id,
      position: [-0.04, yBase, zBase + 0.022],
      edgeThreshold: 24,
      edgeOpacity: 0.92,
    });

    // Ribbon tail leading down to logic board
    const tailShape = createRoundedPolygonShape(
      [
        [0.45, yBase - 0.15],
        [0.65, yBase - 0.15],
        [0.65, yBase - 0.85],
        [0.48, yBase - 0.85],
      ],
      0.04
    );
    const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.016, bevelEnabled: false });
    tailGeo.translate(0, 0, zBase - 0.02);
    addCadMesh(g, tailGeo, h, {
      partId: part.id,
      edgeThreshold: 22,
      edgeOpacity: 0.82,
      shadeTint: 0.25,
    });

    // Schematic ribbon trace lines
    const tracePts: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      const tx = 0.51 + i * 0.036;
      tracePts.push(
        new THREE.Vector3(tx, yBase - 0.18, zBase),
        new THREE.Vector3(tx, yBase - 0.82, zBase)
      );
    }
    addInkSegments(g, tracePts, h, part.id, 0.55, true);
  }

  // =========================================================================
  // 03. GRADE 5 TITANIUM CHASSIS & THERMAL MIDFRAME
  // =========================================================================
  {
    const part = registerPart('titanium-frame');
    const g = part.group;
    const h = part.style;

    // Main CNC-machined hollowed Titanium perimeter rail
    const railGeo = createHollowFrameGeometry(
      PHONE_W,
      PHONE_H,
      0.155,
      0.37,
      PHONE_R,
      0.032
    );
    addCadMesh(g, railGeo, h, {
      partId: part.id,
      edgeThreshold: 20,
      edgeOpacity: 0.96,
      silhouette: true,
      silhouetteThickness: 1.45,
      shadeTint: 0.1,
    });

    // Internal Aluminum thermal substructure midplate (with camera & MagSafe cutouts!)
    const midOuter = createRoundedRectShape(PHONE_W - 0.28, PHONE_H - 0.28, PHONE_R - 0.14);
    // Cutout for triple camera bay (Upper-Right in front coords = Upper-Left from back)
    midOuter.holes.push(createRoundedRectPath(1.52, 1.56, 0.24, 0.8, 2.34));
    // Circular cutout for MagSafe wireless coil flux transfer
    const magHole = new THREE.Path();
    magHole.absarc(0, -0.32, 0.98, 0, Math.PI * 2, true);
    midOuter.holes.push(magHole);

    const midGeo = new THREE.ExtrudeGeometry(midOuter, {
      depth: 0.036,
      bevelEnabled: false,
      curveSegments: 20,
    });
    midGeo.translate(0, 0, -0.025);
    addCadMesh(g, midGeo, h, {
      partId: part.id,
      edgeThreshold: 22,
      edgeOpacity: 0.78,
      shadeTint: 0.22,
      hatchScale: 1.15,
    });

    // Structural CNC milled internal bay divider ribs
    const ribSpecs: [number, number, number, number, number][] = [
      // [x, y, w, h, d]
      [0.08, 0.12, 0.06, 3.85, 0.11], // Vertical divider between battery and logic board
      [-0.74, -2.2, 1.56, 0.06, 0.11], // Divider above speaker
      [0.82, -2.2, 1.42, 0.06, 0.11], // Divider above Taptic Engine
      [-0.75, 2.75, 1.45, 0.05, 0.09], // Upper reinforcement rib
    ];
    for (const [rx, ry, rw, rh, rd] of ribSpecs) {
      const rGeo = new THREE.BoxGeometry(rw, rh, rd);
      addCadMesh(g, rGeo, h, {
        partId: part.id,
        position: [rx, ry, 0.025],
        edgeThreshold: 22,
        edgeOpacity: 0.75,
        shadeTint: 0.28,
      });
    }

    // LEFT EDGE (-X): Action Button, Volume Up, Volume Down
    const leftX = -PHONE_W / 2 - 0.028;
    const leftButtons: [number, number][] = [
      [2.12, 0.34], // Action Button
      [1.36, 0.62], // Volume Up
      [0.56, 0.62], // Volume Down
    ];
    for (const [by, bh] of leftButtons) {
      const bGeo = createRoundedPlateGeometry(0.065, bh, 0.13, 0.025, 0.008, 8);
      addCadMesh(g, bGeo, h, {
        partId: part.id,
        position: [leftX, by, 0],
        edgeThreshold: 24,
        edgeOpacity: 0.94,
      });
    }

    // RIGHT EDGE (+X): Power / Side Button + Recessed Camera Control Button
    const rightX = PHONE_W / 2 + 0.028;
    const powerGeo = createRoundedPlateGeometry(0.065, 0.95, 0.13, 0.025, 0.008, 8);
    addCadMesh(g, powerGeo, h, {
      partId: part.id,
      position: [rightX, 1.12, 0],
      edgeThreshold: 24,
      edgeOpacity: 0.94,
    });

    // Camera Control (flush capacitive sapphire button lower-right)
    const camCtrlGeo = createRoundedPlateGeometry(0.04, 0.76, 0.14, 0.018, 0.006, 8);
    addCadMesh(g, camCtrlGeo, h, {
      partId: part.id,
      position: [PHONE_W / 2 + 0.008, -1.28, 0],
      edgeThreshold: 22,
      edgeOpacity: 0.96,
    });

    // Antenna band seam lines on Titanium rails (6 iconic breaks)
    const antPts: THREE.Vector3[] = [];
    const antY = [2.85, -2.85];
    for (const ay of antY) {
      for (const sx of [-1, 1]) {
        const x0 = sx * (PHONE_W / 2 + 0.004);
        antPts.push(
          new THREE.Vector3(x0, ay - 0.045, -0.17),
          new THREE.Vector3(x0, ay - 0.045, 0.17),
          new THREE.Vector3(x0, ay + 0.045, -0.17),
          new THREE.Vector3(x0, ay + 0.045, 0.17)
        );
      }
    }
    // Bottom edge USB-C port bezel & speaker grille holes
    const botY = -PHONE_H / 2 - 0.004;
    const usbcOutline = createPillShape(0.46, 0.145)
      .getPoints(12)
      .map((p) => new THREE.Vector3(p.x, botY, p.y));
    addInkPolyline(g, usbcOutline, h, part.id, 0.95);

    // Speaker & mic grille circles on bottom edge
    const holeXs = [-1.18, -1.04, -0.9, -0.76, -0.62, 0.68, 0.82, 0.96, 1.1];
    for (const hx of holeXs) {
      const hPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        hPts.push(new THREE.Vector3(hx + Math.cos(a) * 0.036, botY, Math.sin(a) * 0.036));
      }
      addInkPolyline(g, hPts, h, part.id, 0.88);
    }

    addInkSegments(g, antPts, h, part.id, 0.72);
  }

  // =========================================================================
  // 04. A18 PRO DUAL-STACK LOGIC BOARD
  // =========================================================================
  {
    const part = registerPart('logic-board');
    const g = part.group;
    const h = part.style;
    const zBase = 0.078;

    // Compact asymmetrical PCB silhouette (Right-Mid bay below camera)
    const pcbShape = createRoundedPolygonShape(
      [
        [0.18, -1.18],
        [1.46, -1.18],
        [1.46, 1.38],
        [0.42, 1.38],
        [0.42, 0.78],
        [0.18, 0.78],
      ],
      0.08
    );
    const pcbGeo = new THREE.ExtrudeGeometry(pcbShape, {
      depth: 0.072,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 1,
    });
    pcbGeo.translate(0, 0, zBase - 0.036);
    addCadMesh(g, pcbGeo, h, {
      partId: part.id,
      edgeThreshold: 20,
      edgeOpacity: 0.96,
      shadeTint: 0.16,
    });

    // Dual-stack sandwich seam line around perimeter
    const seamPts = pcbShape
      .getPoints(6)
      .map((p) => new THREE.Vector3(p.x, p.y, zBase));
    addInkPolyline(g, seamPts, h, part.id, 0.52, true);

    // A18 Pro SoC Silicon Package (centerpiece chip!)
    const socX = 0.84;
    const socY = 0.24;
    const socGeo = new THREE.BoxGeometry(0.62, 0.62, 0.042);
    addCadMesh(g, socGeo, h, {
      partId: part.id,
      position: [socX, socY, zBase + 0.056],
      edgeThreshold: 20,
      edgeOpacity: 0.98,
      shadeTint: 0.04,
    });

    // Laser-etched die grid & corner pin markers on A18 Pro top face
    const zSocTop = zBase + 0.079;
    const socLines: THREE.Vector3[] = [];
    // Inner die frame
    const rIn = 0.23;
    socLines.push(
      new THREE.Vector3(socX - rIn, socY - rIn, zSocTop),
      new THREE.Vector3(socX + rIn, socY - rIn, zSocTop),
      new THREE.Vector3(socX + rIn, socY - rIn, zSocTop),
      new THREE.Vector3(socX + rIn, socY + rIn, zSocTop),
      new THREE.Vector3(socX + rIn, socY + rIn, zSocTop),
      new THREE.Vector3(socX - rIn, socY + rIn, zSocTop),
      new THREE.Vector3(socX - rIn, socY + rIn, zSocTop),
      new THREE.Vector3(socX - rIn, socY - rIn, zSocTop)
    );
    // Fine internal 6x6 silicon compute core grid
    for (let i = -2; i <= 2; i++) {
      const off = i * 0.085;
      socLines.push(
        new THREE.Vector3(socX - rIn + 0.03, socY + off, zSocTop),
        new THREE.Vector3(socX + rIn - 0.03, socY + off, zSocTop),
        new THREE.Vector3(socX + off, socY - rIn + 0.03, zSocTop),
        new THREE.Vector3(socX + off, socY + rIn - 0.03, zSocTop)
      );
    }
    // Pin-1 alignment triangle & BGA edge ticks
    for (let i = -3; i <= 3; i++) {
      const t = i * 0.072;
      socLines.push(
        new THREE.Vector3(socX + t, socY + 0.31, zSocTop - 0.02),
        new THREE.Vector3(socX + t, socY + 0.355, zSocTop - 0.02),
        new THREE.Vector3(socX + t, socY - 0.31, zSocTop - 0.02),
        new THREE.Vector3(socX + t, socY - 0.355, zSocTop - 0.02),
        new THREE.Vector3(socX + 0.31, socY + t, zSocTop - 0.02),
        new THREE.Vector3(socX + 0.355, socY + t, zSocTop - 0.02),
        new THREE.Vector3(socX - 0.31, socY + t, zSocTop - 0.02),
        new THREE.Vector3(socX - 0.355, socY + t, zSocTop - 0.02)
      );
    }
    addInkSegments(g, socLines, h, part.id, 0.78);

    // Secondary ICs: NAND Flash, PMIC, 5G Modem RF Shield
    const chips: [number, number, number, number, number][] = [
      [0.88, 0.98, 0.68, 0.42, 0.036], // NAND Flash
      [0.82, -0.58, 0.72, 0.46, 0.038], // 5G RF Shield Can
      [0.34, -0.22, 0.22, 0.36, 0.03], // PMIC
      [1.26, -0.22, 0.2, 0.3, 0.028], // Audio / NFC IC
      [0.52, -1.0, 0.36, 0.16, 0.024], // FPC Connector bank 1
      [1.08, -1.0, 0.34, 0.16, 0.024], // FPC Connector bank 2
    ];
    for (const [cx, cy, cw, ch, cd] of chips) {
      const cGeo = new THREE.BoxGeometry(cw, ch, cd);
      addCadMesh(g, cGeo, h, {
        partId: part.id,
        position: [cx, cy, zBase + 0.038 + cd / 2],
        edgeThreshold: 22,
        edgeOpacity: 0.9,
        shadeTint: 0.2,
      });
    }

    // Crisp orthogonal PCB copper trace bus lines
    const zTrace = zBase + 0.044;
    const traces: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      const x = 0.62 + i * 0.075;
      traces.push(
        new THREE.Vector3(x, 0.56, zTrace),
        new THREE.Vector3(x, 0.76, zTrace),
        new THREE.Vector3(x, -0.09, zTrace),
        new THREE.Vector3(x, -0.34, zTrace)
      );
    }
    // Angled 45-degree differential pair traces
    traces.push(
      new THREE.Vector3(0.48, 0.24, zTrace),
      new THREE.Vector3(0.32, 0.24, zTrace),
      new THREE.Vector3(0.32, 0.24, zTrace),
      new THREE.Vector3(0.24, 0.16, zTrace),
      new THREE.Vector3(0.24, 0.16, zTrace),
      new THREE.Vector3(0.24, -0.95, zTrace)
    );
    addInkSegments(g, traces, h, part.id, 0.56, true);
  }

  // =========================================================================
  // 05. PRO TRIPLE-CAMERA & TETRAPRISM TELEPHOTO OPTICAL SYSTEM
  // =========================================================================
  {
    const part = registerPart('camera-system');
    const g = part.group;
    const h = part.style;
    const zBase = -0.06;

    // Unified Stainless-Steel Camera Chassis Carrier (Upper-Right in front coords)
    const housingGeo = createRoundedPlateGeometry(1.48, 1.52, 0.16, 0.22, 0.014, 18);
    addCadMesh(g, housingGeo, h, {
      partId: part.id,
      position: [0.8, 2.34, zBase],
      edgeThreshold: 22,
      edgeOpacity: 0.95,
      shadeTint: 0.14,
    });

    // Authentic iPhone 16 Pro triangular lens coordinates (looking from front, mirrored horizontally vs back):
    // Outer column (+X): Top = 48MP Ultra Wide, Bottom = 48MP Fusion Main
    // Inner center-left: 12MP 5x Tetraprism Telephoto
    const lenses: {
      name: string;
      x: number;
      y: number;
      rOuter: number;
      rGlass: number;
      hasOpticalStack: boolean;
      isTetraprism?: boolean;
    }[] = [
      {
        name: 'main',
        x: 1.12,
        y: 2.7,
        rOuter: 0.34,
        rGlass: 0.24,
        hasOpticalStack: true,
      },
      {
        name: 'ultrawide',
        x: 1.12,
        y: 1.96,
        rOuter: 0.32,
        rGlass: 0.21,
        hasOpticalStack: false,
      },
      {
        name: 'telephoto',
        x: 0.44,
        y: 2.33,
        rOuter: 0.32,
        rGlass: 0.2,
        hasOpticalStack: false,
        isTetraprism: true,
      },
    ];

    for (const lens of lenses) {
      // Main stepped barrel protruding toward -Z (rear glass)
      const barrelGeo = new THREE.CylinderGeometry(lens.rOuter, lens.rOuter * 1.03, 0.22, 32);
      barrelGeo.rotateX(Math.PI / 2);
      addCadMesh(g, barrelGeo, h, {
        partId: part.id,
        position: [lens.x, lens.y, zBase - 0.12],
        edgeThreshold: 24,
        edgeOpacity: 0.96,
        silhouette: true,
        silhouetteThickness: 1.15,
      });

      // Concentric internal aperture / lens element lines on rear aperture face
      const zLensFace = zBase - 0.232;
      addInkPolyline(
        g,
        circlePointsXY(lens.x, lens.y, lens.rGlass, zLensFace, 32),
        h,
        part.id,
        0.92
      );
      addInkPolyline(
        g,
        circlePointsXY(lens.x, lens.y, lens.rGlass * 0.64, zLensFace, 28),
        h,
        part.id,
        0.72
      );
      addInkPolyline(
        g,
        circlePointsXY(lens.x, lens.y, lens.rGlass * 0.3, zLensFace, 20),
        h,
        part.id,
        0.58
      );

      // Precision optical axis reticle crosshair + 6-blade iris aperture hexagon
      const cr = lens.rGlass * 0.85;
      const irisPts: THREE.Vector3[] = [
        new THREE.Vector3(lens.x - cr, lens.y, zLensFace),
        new THREE.Vector3(lens.x + cr, lens.y, zLensFace),
        new THREE.Vector3(lens.x, lens.y - cr, zLensFace),
        new THREE.Vector3(lens.x, lens.y + cr, zLensFace),
      ];
      // 6 iris diaphragm blades tangent to inner aperture
      const irisR = lens.rGlass * 0.56;
      for (let b = 0; b < 6; b++) {
        const a0 = (b / 6) * Math.PI * 2;
        const a1 = ((b + 1) / 6) * Math.PI * 2;
        irisPts.push(
          new THREE.Vector3(lens.x + Math.cos(a0) * irisR, lens.y + Math.sin(a0) * irisR, zLensFace),
          new THREE.Vector3(lens.x + Math.cos(a1) * irisR, lens.y + Math.sin(a1) * irisR, zLensFace)
        );
      }
      addInkSegments(g, irisPts, h, part.id, 0.42, true);

      // SUB-EXPLOSION: 48MP Fusion Main multi-element floating optical lens stack!
      if (lens.hasOpticalStack) {
        const ringRadii = [0.23, 0.19, 0.155, 0.12];
        ringRadii.forEach((rr, idx) => {
          const elemGroup = new THREE.Group();
          elemGroup.position.set(lens.x, lens.y, zBase - 0.15);
          const ringGeo = new THREE.TorusGeometry(rr, 0.016, 10, 32);
          addCadMesh(elemGroup, ringGeo, h, {
            partId: part.id,
            edgeThreshold: 28,
            edgeOpacity: 0.9,
            silhouette: true,
            silhouetteThickness: 0.85,
          });
          // Delicate aperture ticks & lens reflection diagonals
          addInkPolyline(
            elemGroup,
            circlePointsXY(0, 0, rr * 0.72, 0, 24),
            h,
            part.id,
            0.48,
            true
          );
          addInkSegments(
            elemGroup,
            [
              new THREE.Vector3(-rr * 0.5, -rr * 0.5, 0),
              new THREE.Vector3(rr * 0.5, rr * 0.5, 0),
            ],
            h,
            part.id,
            0.35,
            true
          );
          g.add(elemGroup);

          part.subParts.push({
            object: elemGroup,
            basePosition: elemGroup.position.clone(),
            explodeDelta: new THREE.Vector3(0, 0, -0.3 * (idx + 1)),
          });
        });

        // Optical focal-cone schematic lines bridging the telescoping lens stack
        const coneGroup = new THREE.Group();
        coneGroup.position.set(lens.x, lens.y, zBase - 0.15);
        const conePts: THREE.Vector3[] = [];
        for (let k = 0; k < 4; k++) {
          const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
          conePts.push(
            new THREE.Vector3(Math.cos(ang) * 0.22, Math.sin(ang) * 0.22, 0),
            new THREE.Vector3(Math.cos(ang) * 0.11, Math.sin(ang) * 0.11, -1.2)
          );
        }
        addInkSegments(coneGroup, conePts, h, part.id, 0.34, true);
        g.add(coneGroup);
        part.subParts.push({
          object: coneGroup,
          basePosition: coneGroup.position.clone(),
          explodeDelta: new THREE.Vector3(0, 0, 0),
        });

        // Sensor-shift OIS gimbal square frame inside front of main lens
        const oisGeo = createHollowFrameGeometry(0.46, 0.46, 0.055, 0.04, 0.06, 0.005);
        addCadMesh(g, oisGeo, h, {
          partId: part.id,
          position: [lens.x, lens.y, zBase + 0.095],
          edgeThreshold: 22,
          edgeOpacity: 0.85,
        });
      }

      // Signature 5x Tetraprism internal folded-optics prism chamber
      if (lens.isTetraprism) {
        const prismChamberGeo = new THREE.BoxGeometry(0.32, 0.44, 0.14);
        addCadMesh(g, prismChamberGeo, h, {
          partId: part.id,
          position: [lens.x, lens.y - 0.24, zBase + 0.05],
          edgeThreshold: 20,
          edgeOpacity: 0.88,
          shadeTint: 0.18,
        });
        // Zig-zag 4x folded light-ray schematic lines on the prism chamber
        const pz = zBase + 0.123;
        addInkPolyline(
          g,
          [
            new THREE.Vector3(lens.x - 0.09, lens.y - 0.06, pz),
            new THREE.Vector3(lens.x + 0.09, lens.y - 0.16, pz),
            new THREE.Vector3(lens.x - 0.09, lens.y - 0.26, pz),
            new THREE.Vector3(lens.x + 0.09, lens.y - 0.36, pz),
            new THREE.Vector3(lens.x, lens.y - 0.43, pz),
          ],
          h,
          part.id,
          0.75
        );
      }
    }

    // LiDAR Scanner (lower-inner corner) & True Tone Flash (upper-inner corner)
    const lidarGeo = new THREE.CylinderGeometry(0.125, 0.13, 0.16, 24);
    lidarGeo.rotateX(Math.PI / 2);
    addCadMesh(g, lidarGeo, h, {
      partId: part.id,
      position: [0.44, 1.82, zBase - 0.08],
      edgeThreshold: 24,
      edgeOpacity: 0.92,
    });

    const flashGeo = new THREE.CylinderGeometry(0.115, 0.12, 0.14, 24);
    flashGeo.rotateX(Math.PI / 2);
    addCadMesh(g, flashGeo, h, {
      partId: part.id,
      position: [0.44, 2.86, zBase - 0.07],
      edgeThreshold: 24,
      edgeOpacity: 0.92,
    });
    // Fresnel flash ring lines
    addInkPolyline(g, circlePointsXY(0.44, 2.86, 0.075, zBase - 0.142, 20), h, part.id, 0.72);
    addInkPolyline(g, circlePointsXY(0.44, 2.86, 0.038, zBase - 0.142, 16), h, part.id, 0.65);
  }

  // =========================================================================
  // 06. LASER-WELDED STEEL-CASED L-SHAPED BATTERY
  // =========================================================================
  {
    const part = registerPart('battery');
    const g = part.group;
    const h = part.style;
    const zBase = 0.075;

    // Authentic asymmetrical L-shaped steel battery silhouette
    const batPts: [number, number][] = [
      [-1.48, -2.08],
      [1.34, -2.08],
      [1.34, -1.36],
      [-0.02, -1.36],
      [-0.02, 2.52],
      [-1.48, 2.52],
    ];
    const batShape = createRoundedPolygonShape(batPts, 0.1);
    const batGeo = new THREE.ExtrudeGeometry(batShape, {
      depth: 0.11,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    batGeo.translate(0, 0, zBase - 0.055);
    addCadMesh(g, batGeo, h, {
      partId: part.id,
      edgeThreshold: 20,
      edgeOpacity: 0.96,
      silhouette: true,
      silhouetteThickness: 1.2,
      shadeTint: 0.08,
    });

    // Laser-welded perimeter flange seam inset on front & back faces
    const insetPts = createRoundedPolygonShape(
      [
        [-1.38, -1.98],
        [1.24, -1.98],
        [1.24, -1.46],
        [-0.12, -1.46],
        [-0.12, 2.42],
        [-1.38, 2.42],
      ],
      0.07
    ).getPoints(8);
    addInkPolyline(
      g,
      insetPts.map((p) => new THREE.Vector3(p.x, p.y, zBase + 0.072)),
      h,
      part.id,
      0.62,
      true
    );
    addInkPolyline(
      g,
      insetPts.map((p) => new THREE.Vector3(p.x, p.y, zBase - 0.072)),
      h,
      part.id,
      0.55,
      true
    );

    // Technical engineering markings: voltage schematic, cell segmentation, polarity & BMS strip
    const zF = zBase + 0.073;
    const batDetailPts: THREE.Vector3[] = [
      // Cell internal boundary dashed-feel lines
      new THREE.Vector3(-1.32, 0.65, zF),
      new THREE.Vector3(-0.18, 0.65, zF),
      new THREE.Vector3(-1.32, -1.36, zF),
      new THREE.Vector3(-0.18, -1.36, zF),
      // Positive (+) symbol at top cell
      new THREE.Vector3(-0.84, 1.72, zF),
      new THREE.Vector3(-0.66, 1.72, zF),
      new THREE.Vector3(-0.75, 1.63, zF),
      new THREE.Vector3(-0.75, 1.81, zF),
      // Negative (-) symbol at lower cell
      new THREE.Vector3(-0.84, -0.42, zF),
      new THREE.Vector3(-0.66, -0.42, zF),
      // Center battery schematic symbol (two parallel lines: long & short)
      new THREE.Vector3(-0.98, 0.16, zF),
      new THREE.Vector3(-0.52, 0.16, zF),
      new THREE.Vector3(-0.86, 0.04, zF),
      new THREE.Vector3(-0.64, 0.04, zF),
      // Electrically-released adhesive pull tab strips on lower foot
      new THREE.Vector3(0.28, -1.86, zF),
      new THREE.Vector3(1.06, -1.86, zF),
      new THREE.Vector3(0.28, -1.58, zF),
      new THREE.Vector3(1.06, -1.58, zF),
    ];
    addInkSegments(g, batDetailPts, h, part.id, 0.66);

    // BMS Protection Board bar along right inner edge of battery
    const bmsGeo = new THREE.BoxGeometry(0.11, 1.15, 0.055);
    addCadMesh(g, bmsGeo, h, {
      partId: part.id,
      position: [0.04, -0.58, zBase + 0.02],
      edgeThreshold: 22,
      edgeOpacity: 0.88,
      shadeTint: 0.22,
    });
  }

  // =========================================================================
  // 07. TAPTIC ENGINE LINEAR ACTUATOR
  // =========================================================================
  {
    const part = registerPart('taptic-engine');
    const g = part.group;
    const h = part.style;
    const zBase = 0.075;
    const cx = 0.78;
    const cy = -2.76;

    // CNC rectangular linear actuator housing
    const bodyGeo = createRoundedPlateGeometry(1.36, 0.66, 0.105, 0.07, 0.012, 12);
    addCadMesh(g, bodyGeo, h, {
      partId: part.id,
      position: [cx, cy, zBase],
      edgeThreshold: 22,
      edgeOpacity: 0.95,
      shadeTint: 0.14,
    });

    // Schematic cutaway detail on front face: internal copper coil windings & dual leaf springs
    const zF = zBase + 0.066;
    const coilPts: THREE.Vector3[] = [];
    // Central tungsten oscillating mass outline
    const mx = 0.44;
    const my = 0.21;
    coilPts.push(
      new THREE.Vector3(cx - mx, cy - my, zF),
      new THREE.Vector3(cx + mx, cy - my, zF),
      new THREE.Vector3(cx + mx, cy - my, zF),
      new THREE.Vector3(cx + mx, cy + my, zF),
      new THREE.Vector3(cx + mx, cy + my, zF),
      new THREE.Vector3(cx - mx, cy + my, zF),
      new THREE.Vector3(cx - mx, cy + my, zF),
      new THREE.Vector3(cx - mx, cy - my, zF)
    );
    // Vertical copper coil winding lines inside core
    for (let i = -5; i <= 5; i++) {
      const lx = cx + i * 0.052;
      coilPts.push(
        new THREE.Vector3(lx, cy - 0.14, zF),
        new THREE.Vector3(lx, cy + 0.14, zF)
      );
    }
    // Dual leaf spring zig-zags on left & right ends
    for (const side of [-1, 1]) {
      const sx = cx + side * 0.52;
      coilPts.push(
        new THREE.Vector3(sx, cy - 0.22, zF),
        new THREE.Vector3(sx + side * 0.08, cy - 0.1, zF),
        new THREE.Vector3(sx + side * 0.08, cy - 0.1, zF),
        new THREE.Vector3(sx, cy, zF),
        new THREE.Vector3(sx, cy, zF),
        new THREE.Vector3(sx + side * 0.08, cy + 0.1, zF),
        new THREE.Vector3(sx + side * 0.08, cy + 0.1, zF),
        new THREE.Vector3(sx, cy + 0.22, zF)
      );
    }
    addInkSegments(g, coilPts, h, part.id, 0.72);
  }

  // =========================================================================
  // 08. BOTTOM STEREO SPEAKER & USB-C PORT ASSEMBLY
  // =========================================================================
  {
    const part = registerPart('bottom-io');
    const g = part.group;
    const h = part.style;
    const zBase = 0.072;

    // Acoustic speaker resonance chamber (bottom-left)
    const spkShape = createRoundedPolygonShape(
      [
        [-1.46, -3.26],
        [-0.36, -3.26],
        [-0.36, -2.42],
        [-1.46, -2.42],
      ],
      0.09
    );
    const spkGeo = new THREE.ExtrudeGeometry(spkShape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 1,
    });
    spkGeo.translate(0, 0, zBase - 0.05);
    addCadMesh(g, spkGeo, h, {
      partId: part.id,
      edgeThreshold: 22,
      edgeOpacity: 0.94,
      shadeTint: 0.16,
    });

    // Acoustic driver circular diaphragm outline & radial mesh lines
    const spkCx = -0.92;
    const spkCy = -2.84;
    const zF = zBase + 0.062;
    addInkPolyline(g, circlePointsXY(spkCx, spkCy, 0.29, zF, 28), h, part.id, 0.85);
    addInkPolyline(g, circlePointsXY(spkCx, spkCy, 0.14, zF, 20), h, part.id, 0.65);

    // USB-C Receptacle metal shroud (bottom center)
    const usbcGeo = createRoundedPlateGeometry(0.46, 0.42, 0.135, 0.06, 0.008, 12);
    addCadMesh(g, usbcGeo, h, {
      partId: part.id,
      position: [0, -3.38, 0.0],
      edgeThreshold: 22,
      edgeOpacity: 0.96,
      shadeTint: 0.1,
    });

    // Internal 24-pin USB-C contact tongue
    const tongueGeo = new THREE.BoxGeometry(0.32, 0.24, 0.028);
    addCadMesh(g, tongueGeo, h, {
      partId: part.id,
      position: [0, -3.45, 0.0],
      edgeThreshold: 20,
      edgeOpacity: 0.85,
    });

    // USB-C flex bridge connecting upward
    const bridgeGeo = new THREE.BoxGeometry(0.24, 0.72, 0.02);
    addCadMesh(g, bridgeGeo, h, {
      partId: part.id,
      position: [0, -2.84, zBase - 0.01],
      edgeThreshold: 22,
      edgeOpacity: 0.82,
      shadeTint: 0.24,
    });
  }

  // =========================================================================
  // 09. MAGSAFE MAGNETIC ARRAY & QI2 WIRELESS CHARGING COIL
  // =========================================================================
  {
    const part = registerPart('magsafe-coil');
    const g = part.group;
    const h = part.style;
    const zBase = -0.135;
    const cy = -0.32;

    // 18 radial trapezoidal neodymium magnets arranged in a precise ring!
    const numMagnets = 18;
    const innerMagR = 1.06;
    const outerMagR = 1.3;
    const gapAngle = 0.042;
    const stepAngle = (Math.PI * 2) / numMagnets;

    for (let i = 0; i < numMagnets; i++) {
      const a0 = i * stepAngle + gapAngle * 0.5;
      const a1 = (i + 1) * stepAngle - gapAngle * 0.5;
      const segGeo = createArcSegmentGeometry(innerMagR, outerMagR, a0, a1, 0.036);
      addCadMesh(g, segGeo, h, {
        partId: part.id,
        position: [0, cy, zBase],
        edgeThreshold: 22,
        edgeOpacity: 0.94,
        shadeTint: 0.1,
      });
    }

    // Bottom vertical alignment magnet bar (iconic MagSafe anchor!)
    const alignBarGeo = createRoundedPlateGeometry(0.18, 0.58, 0.036, 0.06, 0.004, 10);
    addCadMesh(g, alignBarGeo, h, {
      partId: part.id,
      position: [0, cy - 1.72, zBase],
      edgeThreshold: 22,
      edgeOpacity: 0.95,
      shadeTint: 0.1,
    });

    // Ultra-thin ferrite shielding backing disc behind the charging coil
    const shieldRingOuter = new THREE.Shape();
    shieldRingOuter.absarc(0, 0, 1.01, 0, Math.PI * 2, false);
    const shieldHole = new THREE.Path();
    shieldHole.absarc(0, 0, 0.42, 0, Math.PI * 2, true);
    shieldRingOuter.holes.push(shieldHole);

    const shieldGeo = new THREE.ExtrudeGeometry(shieldRingOuter, {
      depth: 0.016,
      bevelEnabled: false,
      curveSegments: 40,
    });
    shieldGeo.translate(0, cy, zBase - 0.008);
    addCadMesh(g, shieldGeo, h, {
      partId: part.id,
      edgeThreshold: 24,
      edgeOpacity: 0.78,
      shadeTint: 0.22,
    });

    // Signature Qi2 / MagSafe multi-turn concentric spiral copper coil (11 crisp turns!)
    const spiralPts: THREE.Vector3[] = [];
    const turns = 11;
    const samplesPerTurn = 48;
    const totalSamples = turns * samplesPerTurn;
    const rStart = 0.47;
    const rEnd = 0.96;
    for (let i = 0; i <= totalSamples; i++) {
      const frac = i / totalSamples;
      const angle = frac * turns * Math.PI * 2;
      const r = THREE.MathUtils.lerp(rStart, rEnd, frac);
      spiralPts.push(
        new THREE.Vector3(Math.cos(angle) * r, cy + Math.sin(angle) * r, zBase - 0.014)
      );
    }
    addInkPolyline(g, spiralPts, h, part.id, 0.86);

    // Second spiral trace on front face for readability from both sides
    addInkPolyline(
      g,
      spiralPts.map((p) => new THREE.Vector3(p.x, p.y, zBase + 0.016)),
      h,
      part.id,
      0.72
    );

    // NFC outer antenna loop & flex tail leading up to logic board
    addInkPolyline(g, circlePointsXY(0, cy, 1.38, zBase, 64), h, part.id, 0.42, true);
    addInkPolyline(
      g,
      [
        new THREE.Vector3(0.45, cy + 0.88, zBase),
        new THREE.Vector3(0.75, cy + 1.18, zBase),
        new THREE.Vector3(0.75, cy + 1.65, zBase),
      ],
      h,
      part.id,
      0.85
    );
  }

  // =========================================================================
  // 10. TEXTURED MATTE REAR GLASS & SCULPTED CAMERA PLATEAU
  // =========================================================================
  {
    const part = registerPart('rear-glass');
    const g = part.group;
    const h = part.style;
    const zBase = -0.21;

    // Main matte rear glass backplate with rounded corners
    const rearGeo = createRoundedPlateGeometry(
      PHONE_W - 0.06,
      PHONE_H - 0.06,
      0.052,
      PHONE_R - 0.03,
      0.01,
      24
    );
    addCadMesh(g, rearGeo, h, {
      partId: part.id,
      position: [0, 0, zBase],
      edgeThreshold: 22,
      edgeOpacity: 0.96,
      silhouette: true,
      silhouetteThickness: 1.3,
      hatchScale: 0.9,
    });

    // Sculpted raised square camera plateau (Upper-Right in world coords = Top-Left on back!)
    const plateauShape = createRoundedRectShape(1.62, 1.66, 0.34);
    const plateauGeo = new THREE.ExtrudeGeometry(plateauShape, {
      depth: 0.078,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 2,
      curveSegments: 18,
    });
    plateauGeo.center();
    addCadMesh(g, plateauGeo, h, {
      partId: part.id,
      position: [0.8, 2.34, zBase - 0.06],
      edgeThreshold: 22,
      edgeOpacity: 0.96,
      silhouette: true,
      silhouetteThickness: 1.1,
      shadeTint: 0.06,
    });

    // Three stepped metallic camera lens trim rings protruding from plateau
    const trimPositions: [number, number, number][] = [
      [1.12, 2.7, 0.35],
      [1.12, 1.96, 0.33],
      [0.44, 2.33, 0.33],
    ];
    for (const [tx, ty, tr] of trimPositions) {
      const ringOuter = new THREE.Shape();
      ringOuter.absarc(0, 0, tr, 0, Math.PI * 2, false);
      const ringInner = new THREE.Path();
      ringInner.absarc(0, 0, tr - 0.055, 0, Math.PI * 2, true);
      ringOuter.holes.push(ringInner);

      const trimGeo = new THREE.ExtrudeGeometry(ringOuter, {
        depth: 0.072,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 1,
        curveSegments: 32,
      });
      trimGeo.translate(tx, ty, zBase - 0.165);
      addCadMesh(g, trimGeo, h, {
        partId: part.id,
        edgeThreshold: 22,
        edgeOpacity: 0.96,
        silhouette: true,
        silhouetteThickness: 0.95,
      });
    }

    // Flash & LiDAR & Rear Mic cutouts on plateau back face
    const zPlat = zBase - 0.105;
    addInkPolyline(g, circlePointsXY(0.44, 2.86, 0.12, zPlat, 24), h, part.id, 0.9);
    addInkPolyline(g, circlePointsXY(0.44, 1.82, 0.13, zPlat, 24), h, part.id, 0.9);
    addInkPolyline(g, circlePointsXY(0.68, 1.66, 0.036, zPlat, 16), h, part.id, 0.85);

    // Minimalist geometric patent construction circles (Golden Ratio compass geometry!) on rear glass
    const zBackFace = zBase - 0.032;
    addInkPolyline(g, circlePointsXY(0, -0.32, 0.42, zBackFace, 36), h, part.id, 0.44, true);
    addInkPolyline(g, circlePointsXY(0, -0.32, 0.68, zBackFace, 48), h, part.id, 0.24, true);
    addInkPolyline(g, circlePointsXY(0, -0.32, 1.1, zBackFace, 56), h, part.id, 0.16, true);
    addInkSegments(
      g,
      [
        new THREE.Vector3(-1.35, -0.32, zBackFace),
        new THREE.Vector3(1.35, -0.32, zBackFace),
        new THREE.Vector3(0, -1.68, zBackFace),
        new THREE.Vector3(0, 1.04, zBackFace),
        // 45-degree drafting diagonals through center emblem
        new THREE.Vector3(-0.78, -1.1, zBackFace),
        new THREE.Vector3(0.78, 0.46, zBackFace),
        new THREE.Vector3(-0.78, 0.46, zBackFace),
        new THREE.Vector3(0.78, -1.1, zBackFace),
      ],
      h,
      part.id,
      0.26,
      true
    );
  }

  // =========================================================================
  // 11. PRECISION MICRO-FASTENERS, RETENTION BRACKETS & IP68 GASKET
  // =========================================================================
  {
    const part = registerPart('fasteners');
    const g = part.group;
    const h = part.style;

    // 1. Two iconic bottom P2 Pentalobe security screws (explode downward -Y)
    for (const sx of [-0.42, 0.42]) {
      const screw = buildMicroScrew(
        g,
        h,
        part.id,
        [sx, -PHONE_H / 2 - 0.02, 0],
        [Math.PI / 2, 0, 0],
        1.15
      );
      part.subParts.push({
        object: screw,
        basePosition: screw.position.clone(),
        explodeDelta: new THREE.Vector3(sx * 0.25, -1.35, 0.65),
      });
    }

    // 2. Four internal corner Y000 micro-screws (explode forward + slightly radial)
    const cornerScrews: [number, number][] = [
      [-1.42, 3.22],
      [1.42, 3.22],
      [-1.42, -3.22],
      [1.42, -3.22],
    ];
    for (const [cx, cy] of cornerScrews) {
      const screw = buildMicroScrew(g, h, part.id, [cx, cy, 0.14], [0, 0, 0], 0.95);
      part.subParts.push({
        object: screw,
        basePosition: screw.position.clone(),
        explodeDelta: new THREE.Vector3(Math.sign(cx) * 0.58, Math.sign(cy) * 0.38, 2.75),
      });
    }

    // 3. Laser-stamped stainless-steel Logic Board FPC retention bracket
    const bracketGroup = new THREE.Group();
    bracketGroup.position.set(0.84, -0.95, 0.14);
    const brkGeo = createRoundedPlateGeometry(0.92, 0.22, 0.022, 0.05, 0.004, 10);
    addCadMesh(bracketGroup, brkGeo, h, {
      partId: part.id,
      edgeThreshold: 22,
      edgeOpacity: 0.94,
      shadeTint: 0.15,
    });
    g.add(bracketGroup);
    part.subParts.push({
      object: bracketGroup,
      basePosition: bracketGroup.position.clone(),
      explodeDelta: new THREE.Vector3(0.75, -0.3, 2.85),
    });

    // 4. Perimeter IP68 waterproof elastic adhesive gasket frame (floats cleanly between screen & chassis!)
    const gasketGroup = new THREE.Group();
    gasketGroup.position.set(0, 0, 0.17);
    const gasketGeo = createHollowFrameGeometry(
      PHONE_W - 0.14,
      PHONE_H - 0.14,
      0.048,
      0.018,
      PHONE_R - 0.07,
      0
    );
    addCadMesh(gasketGroup, gasketGeo, h, {
      partId: part.id,
      edgeThreshold: 24,
      edgeOpacity: 0.65,
      softInk: true,
      shadeTint: 0.25,
    });
    g.add(gasketGroup);
    part.subParts.push({
      object: gasketGroup,
      basePosition: gasketGroup.position.clone(),
      explodeDelta: new THREE.Vector3(0, 0.04, 3.85),
    });
  }

  // =========================================================================
  // DYNAMIC DASHED EXPLOSION AXIS GUIDES (Patent Assembly Lines)
  // =========================================================================
  const guidePairs: {
    fromPartId: string;
    fromLocal: [number, number, number];
    toPartId: string;
    toLocal: [number, number, number];
  }[] = [
    // Four corner alignment axes from Front Ceramic Display -> Titanium Chassis -> Rear Glass
    {
      fromPartId: 'ceramic-display',
      fromLocal: [-1.42, 3.22, 0.18],
      toPartId: 'rear-glass',
      toLocal: [-1.42, 3.22, -0.18],
    },
    {
      fromPartId: 'ceramic-display',
      fromLocal: [1.42, 3.22, 0.18],
      toPartId: 'rear-glass',
      toLocal: [1.42, 3.22, -0.18],
    },
    {
      fromPartId: 'ceramic-display',
      fromLocal: [-1.42, -3.22, 0.18],
      toPartId: 'rear-glass',
      toLocal: [-1.42, -3.22, -0.18],
    },
    {
      fromPartId: 'ceramic-display',
      fromLocal: [1.42, -3.22, 0.18],
      toPartId: 'rear-glass',
      toLocal: [1.42, -3.22, -0.18],
    },
    // Central MagSafe optical/inductive axis from Chassis -> MagSafe -> Rear Glass
    {
      fromPartId: 'titanium-frame',
      fromLocal: [0, -0.32, 0],
      toPartId: 'rear-glass',
      toLocal: [0, -0.32, -0.2],
    },
    // Optical lens alignment axis from Camera System -> Rear Camera Plateau
    {
      fromPartId: 'camera-system',
      fromLocal: [1.12, 2.7, -0.18],
      toPartId: 'rear-glass',
      toLocal: [1.12, 2.7, -0.26],
    },
    // TrueDepth alignment axis from Display Dynamic Island -> TrueDepth -> Chassis
    {
      fromPartId: 'ceramic-display',
      fromLocal: [0, 3.12, 0.18],
      toPartId: 'titanium-frame',
      toLocal: [0, 3.12, 0],
    },
  ];

  const guides: DynamicGuideLine[] = guidePairs.map((gp) => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const mat = createDashedGuideMaterial(0.0);
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 1;
    root.add(line);
    return {
      line,
      material: mat,
      fromPartId: gp.fromPartId,
      fromLocal: new THREE.Vector3(...gp.fromLocal),
      toPartId: gp.toPartId,
      toLocal: new THREE.Vector3(...gp.toLocal),
    };
  });

  // =========================================================================
  // 3D ARCHITECTURAL DIMENSION BRACKETS (149.6mm H, 71.5mm W, Live ΔZ Span)
  // =========================================================================
  const dimMat = new THREE.LineBasicMaterial({
    color: 0x161412,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });

  // Static chassis Height (149.6 mm) & Width (71.5 mm) engineering dimension lines
  const dimX = -PHONE_W / 2 - 0.56;
  const dimYTop = PHONE_H / 2 + 0.48;
  const staticDimPts: THREE.Vector3[] = [
    // Height bracket left of chassis
    new THREE.Vector3(dimX, -PHONE_H / 2, 0),
    new THREE.Vector3(dimX, PHONE_H / 2, 0),
    new THREE.Vector3(dimX - 0.12, PHONE_H / 2, 0),
    new THREE.Vector3(dimX + 0.34, PHONE_H / 2, 0),
    new THREE.Vector3(dimX - 0.12, -PHONE_H / 2, 0),
    new THREE.Vector3(dimX + 0.34, -PHONE_H / 2, 0),
    // Center tick on height bracket
    new THREE.Vector3(dimX - 0.08, 0, 0),
    new THREE.Vector3(dimX + 0.08, 0, 0),
    // Width bracket above chassis
    new THREE.Vector3(-PHONE_W / 2, dimYTop, 0),
    new THREE.Vector3(PHONE_W / 2, dimYTop, 0),
    new THREE.Vector3(-PHONE_W / 2, dimYTop - 0.28, 0),
    new THREE.Vector3(-PHONE_W / 2, dimYTop + 0.12, 0),
    new THREE.Vector3(PHONE_W / 2, dimYTop - 0.28, 0),
    new THREE.Vector3(PHONE_W / 2, dimYTop + 0.12, 0),
  ];
  const staticDims = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(staticDimPts),
    dimMat
  );
  root.add(staticDims);

  // Live stretching ΔZ exploded depth ruler track below the phone (with layer ticks!)
  const maxDimSegs = 16; // 1 main spine + 2 end caps + up to 11 layer notches + 2 extras
  const liveZPositions = new Float32Array(maxDimSegs * 2 * 3);
  const liveZGeo = new THREE.BufferGeometry();
  liveZGeo.setAttribute('position', new THREE.BufferAttribute(liveZPositions, 3));
  const liveZMat = new THREE.LineBasicMaterial({
    color: 0x161412,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const liveZTrack = new THREE.LineSegments(liveZGeo, liveZMat);
  root.add(liveZTrack);

  // =========================================================================
  // STAGGERED WAVE EXPLODE INTERPOLATION UPDATE (called smoothly per frame)
  // =========================================================================
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const partProgressMap = new Map<string, number>();

  function smoothStagger(globalT: number, start: number, end: number): number {
    const local = THREE.MathUtils.clamp((globalT - start) / Math.max(0.001, end - start), 0, 1);
    // Crisp cubic ease-in-out for luxury watch-like mechanical choreography
    return local < 0.5
      ? 4 * local * local * local
      : 1 - Math.pow(-2 * local + 2, 3) / 2;
  }

  function updateExplode(t: number): void {
    for (const part of parts.values()) {
      const [s0, s1] = part.meta.stagger;
      const p = smoothStagger(t, s0, s1);
      partProgressMap.set(part.id, p);

      part.group.position.set(
        part.basePosition.x + part.explodeVector.x * p,
        part.basePosition.y + part.explodeVector.y * p,
        part.basePosition.z + part.explodeVector.z * p
      );

      for (const sub of part.subParts) {
        sub.object.position.set(
          sub.basePosition.x + sub.explodeDelta.x * p,
          sub.basePosition.y + sub.explodeDelta.y * p,
          sub.basePosition.z + sub.explodeDelta.z * p
        );
      }
    }

    // Update dashed patent guide lines to connect moving endpoints cleanly
    const guideOpacity = THREE.MathUtils.smoothstep(t, 0.04, 0.28) * 0.36;
    for (const gd of guides) {
      const pFrom = parts.get(gd.fromPartId);
      const pTo = parts.get(gd.toPartId);
      if (!pFrom || !pTo) continue;

      tmpA.copy(gd.fromLocal).add(pFrom.group.position);
      tmpB.copy(gd.toLocal).add(pTo.group.position);

      const posAttr = gd.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, tmpA.x, tmpA.y, tmpA.z);
      posAttr.setXYZ(1, tmpB.x, tmpB.y, tmpB.z);
      posAttr.needsUpdate = true;
      gd.line.computeLineDistances();

      gd.material.opacity = guideOpacity;
      gd.line.visible = guideOpacity > 0.01;
    }

    // Update live stretching ΔZ dimension rail along Y = -4.22 below the phone
    const frontZ = (parts.get('ceramic-display')?.group.position.z ?? 0) + 0.21;
    const rearZ = (parts.get('rear-glass')?.group.position.z ?? 0) - 0.21;
    const railY = -4.24;
    const railX = 0;

    const attr = liveZGeo.getAttribute('position') as THREE.BufferAttribute;
    let idx = 0;
    const pushSeg = (
      x1: number,
      y1: number,
      z1: number,
      x2: number,
      y2: number,
      z2: number
    ) => {
      if (idx >= maxDimSegs) return;
      attr.setXYZ(idx * 2, x1, y1, z1);
      attr.setXYZ(idx * 2 + 1, x2, y2, z2);
      idx++;
    };

    // Main Z spine + end extension brackets
    pushSeg(railX, railY, rearZ, railX, railY, frontZ);
    pushSeg(railX - 0.28, railY, frontZ, railX + 0.28, railY, frontZ);
    pushSeg(railX - 0.28, railY, rearZ, railX + 0.28, railY, rearZ);
    // Vertical hairlines connecting front/rear glass bottoms down to Z rail
    pushSeg(railX, -PHONE_H / 2, frontZ, railX, railY, frontZ);
    pushSeg(railX, -PHONE_H / 2, rearZ, railX, railY, rearZ);

    // Tick notch on the Z rail for every layer plane!
    const layerIds = [
      'truedepth',
      'logic-board',
      'battery',
      'titanium-frame',
      'camera-system',
      'magsafe-coil',
    ];
    for (const lid of layerIds) {
      const lp = parts.get(lid);
      if (!lp) continue;
      const lz = lp.group.position.z;
      pushSeg(railX - 0.14, railY, lz, railX + 0.14, railY, lz);
    }

    while (idx < maxDimSegs) {
      pushSeg(0, 0, 0, 0, 0, 0);
    }
    attr.needsUpdate = true;
    liveZMat.opacity = THREE.MathUtils.smoothstep(t, 0.05, 0.3) * 0.44;
    liveZTrack.visible = liveZMat.opacity > 0.01;
  }

  function getPartProgress(partId: string): number {
    return partProgressMap.get(partId) ?? 0;
  }

  updateExplode(0);

  return {
    root,
    parts,
    guides,
    updateExplode,
    getPartProgress,
  };
}
