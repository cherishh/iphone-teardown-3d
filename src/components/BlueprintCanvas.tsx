import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { IPHONE_PARTS, MICRO_CALLOUTS } from '../data/parts';
import { applyPartVisualState, PAPER_HEX } from '../three/blueprintMaterials';
import {
  buildIphone16Pro,
  PHONE_H,
  PHONE_W,
  type BuiltIphoneAssembly,
} from '../three/buildIphone16Pro';
import { soundEngine } from '../utils/sound';

export type CameraPreset = 'iso' | 'front' | 'side' | 'back' | 'top';
export type InteractionMode = 'wheel' | 'cursor';
export type LabelDensity = 'rich' | 'clean' | 'off';

export interface BlueprintCanvasProps {
  targetExplode: number;
  onTargetExplodeChange: (val: number) => void;
  selectedPartId: string | null;
  hoveredPartId: string | null;
  onSelectPart: (id: string | null) => void;
  onHoverPart: (id: string | null) => void;
  interactionMode: InteractionMode;
  labelDensity: LabelDensity;
  hatchEnabled: boolean;
  autoShowcase: boolean;
  onCancelAutoShowcase: () => void;
  scanRequestSeq: number;
  cameraPresetRequest: { preset: CameraPreset; seq: number } | null;
  onHudTelemetry?: (azimuthDeg: number, elevationDeg: number) => void;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  iso: { pos: [9.4, 3.3, 10.2], target: [0, -0.1, 0] },
  front: { pos: [0.0, 0.0, 13.4], target: [0, 0, 0] },
  side: { pos: [13.2, 0.7, 2.4], target: [0, 0, 0] },
  back: { pos: [-9.2, 3.1, -10.2], target: [0, -0.1, 0] },
  top: { pos: [0.0, 13.5, 2.6], target: [0, 0, 0] },
};

interface ProjectedCalloutItem {
  key: string;
  isMicro: boolean;
  partId: string;
  ax: number;
  ay: number;
  side: 'left' | 'right';
  targetY: number;
  isActive: boolean;
  isDimmed: boolean;
  priority: number;
}

/**
 * Iterative vertical de-collision solver so dense patent callouts
 * NEVER overlap and always look like a curated museum poster.
 */
function resolveVerticalCollisions(
  items: ProjectedCalloutItem[],
  minY: number,
  maxY: number
): void {
  if (items.length <= 1) return;
  items.sort((a, b) => a.ay - b.ay);

  for (const item of items) {
    item.targetY = THREE.MathUtils.clamp(item.ay, minY, maxY);
  }

  // Forward & backward relaxation passes
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const curr = items[i];
      const minGap = prev.isMicro && curr.isMicro ? 28 : prev.isMicro || curr.isMicro ? 34 : 42;
      if (curr.targetY - prev.targetY < minGap) {
        const mid = (prev.targetY + curr.targetY) * 0.5;
        prev.targetY = mid - minGap * 0.5;
        curr.targetY = mid + minGap * 0.5;
      }
    }
    // Clamp within safe drafting frame vertical bounds
    if (items[0].targetY < minY) {
      const shift = minY - items[0].targetY;
      items[0].targetY = minY;
      for (let i = 1; i < items.length; i++) {
        const minGap = items[i - 1].isMicro && items[i].isMicro ? 28 : 36;
        items[i].targetY = Math.max(items[i].targetY, items[i - 1].targetY + minGap);
      }
      if (shift < 0) break;
    }
    const lastIdx = items.length - 1;
    if (items[lastIdx].targetY > maxY) {
      items[lastIdx].targetY = maxY;
      for (let i = lastIdx - 1; i >= 0; i--) {
        const minGap = items[i].isMicro && items[i + 1].isMicro ? 28 : 36;
        items[i].targetY = Math.min(items[i].targetY, items[i + 1].targetY - minGap);
      }
    }
  }
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  targetExplode,
  onTargetExplodeChange,
  selectedPartId,
  hoveredPartId,
  onSelectPart,
  onHoverPart,
  interactionMode,
  labelDensity,
  hatchEnabled,
  autoShowcase,
  onCancelAutoShowcase,
  scanRequestSeq,
  cameraPresetRequest,
  onHudTelemetry,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgOverlayRef = useRef<SVGSVGElement | null>(null);
  const cursorReticleRef = useRef<HTMLDivElement | null>(null);

  const targetExplodeRef = useRef(targetExplode);
  const selectedPartRef = useRef(selectedPartId);
  const hoveredPartRef = useRef(hoveredPartId);
  const interactionModeRef = useRef(interactionMode);
  const labelDensityRef = useRef(labelDensity);
  const hatchEnabledRef = useRef(hatchEnabled);
  const autoShowcaseRef = useRef(autoShowcase);
  const onExplodeChangeRef = useRef(onTargetExplodeChange);
  const onSelectRef = useRef(onSelectPart);
  const onHoverRef = useRef(onHoverPart);
  const onCancelShowcaseRef = useRef(onCancelAutoShowcase);
  const onTelemetryRef = useRef(onHudTelemetry);

  targetExplodeRef.current = targetExplode;
  selectedPartRef.current = selectedPartId;
  hoveredPartRef.current = hoveredPartId;
  interactionModeRef.current = interactionMode;
  labelDensityRef.current = labelDensity;
  hatchEnabledRef.current = hatchEnabled;
  autoShowcaseRef.current = autoShowcase;
  onExplodeChangeRef.current = onTargetExplodeChange;
  onSelectRef.current = onSelectPart;
  onHoverRef.current = onHoverPart;
  onCancelShowcaseRef.current = onCancelAutoShowcase;
  onTelemetryRef.current = onHudTelemetry;

  // Imperative camera transition state
  const camAnimRef = useRef<{
    active: boolean;
    desiredPos: THREE.Vector3;
    desiredTarget: THREE.Vector3;
  }>({
    active: false,
    desiredPos: new THREE.Vector3(...CAMERA_PRESETS.iso.pos),
    desiredTarget: new THREE.Vector3(...CAMERA_PRESETS.iso.target),
  });

  // Scan sweep animation state (-6.5 -> +6.5 along Z)
  const scanAnimRef = useRef<{ active: boolean; progress: number }>({
    active: true, // Play a subtle signature blueprint ink scan sweep on initial load!
    progress: -0.15,
  });

  const assemblyRef = useRef<BuiltIphoneAssembly | null>(null);

  useEffect(() => {
    if (scanRequestSeq > 0) {
      scanAnimRef.current.active = true;
      scanAnimRef.current.progress = 0;
    }
  }, [scanRequestSeq]);

  useEffect(() => {
    if (!cameraPresetRequest) return;
    const preset = CAMERA_PRESETS[cameraPresetRequest.preset];
    camAnimRef.current.desiredPos.set(...preset.pos);
    camAnimRef.current.desiredTarget.set(...preset.target);
    camAnimRef.current.active = true;
  }, [cameraPresetRequest]);

  useEffect(() => {
    const assembly = assemblyRef.current;
    if (!assembly || !selectedPartId) return;

    const part = assembly.parts.get(selectedPartId);
    if (!part) return;

    const targetT = Math.max(targetExplodeRef.current, 0.78);
    if (targetT > targetExplodeRef.current + 0.02) {
      onExplodeChangeRef.current(targetT);
    }

    const [s0, s1] = part.meta.stagger;
    const local = THREE.MathUtils.clamp((targetT - s0) / Math.max(0.001, s1 - s0), 0, 1);
    const eased = local < 0.5 ? 4 * local * local * local : 1 - Math.pow(-2 * local + 2, 3) / 2;

    const focusCenter = new THREE.Vector3(
      part.meta.anchorLocal[0] * 0.48 + part.explodeVector.x * eased,
      part.meta.anchorLocal[1] * 0.48 + part.explodeVector.y * eased,
      part.meta.anchorLocal[2] * 0.48 + part.explodeVector.z * eased
    );
    const offset = new THREE.Vector3(...part.meta.focusCameraOffset);

    camAnimRef.current.desiredTarget.copy(focusCenter);
    camAnimRef.current.desiredPos.copy(focusCenter).add(offset);
    camAnimRef.current.active = true;
  }, [selectedPartId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAPER_HEX);

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 140);
    // Start slightly wider & angled, then glide smoothly into the hero ISO pose!
    camera.position.set(12.2, 5.2, 12.8);
    camAnimRef.current.desiredPos.set(...CAMERA_PRESETS.iso.pos);
    camAnimRef.current.desiredTarget.set(...CAMERA_PRESETS.iso.target);
    camAnimRef.current.active = true;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.rotateSpeed = 0.72;
    controls.enablePan = true;
    controls.panSpeed = 0.55;
    controls.minDistance = 4.0;
    controls.maxDistance = 26.0;
    controls.enableZoom = false;

    const stopCamAnim = () => {
      camAnimRef.current.active = false;
      if (autoShowcaseRef.current) {
        onCancelShowcaseRef.current();
      }
    };
    controls.addEventListener('start', stopCamAnim);

    // =========================================================================
    // ARCHITECTURAL REFERENCE COMPASS & DRAFTING FLOOR PLANE
    // =========================================================================
    const floorGridGroup = new THREE.Group();
    floorGridGroup.position.set(0, -4.75, 0);

    // Orthogonal engineering grid
    const gridPts: THREE.Vector3[] = [];
    const gridExtent = 7.6;
    const gridStep = 0.95;
    for (let x = -gridExtent; x <= gridExtent + 0.01; x += gridStep) {
      gridPts.push(new THREE.Vector3(x, 0, -gridExtent), new THREE.Vector3(x, 0, gridExtent));
    }
    for (let z = -gridExtent; z <= gridExtent + 0.01; z += gridStep) {
      gridPts.push(new THREE.Vector3(-gridExtent, 0, z), new THREE.Vector3(gridExtent, 0, z));
    }
    floorGridGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(gridPts),
        new THREE.LineBasicMaterial({
          color: 0x161412,
          transparent: true,
          opacity: 0.068,
          depthWrite: false,
        })
      )
    );

    // Rotating precision azimuth degree dial ring on the drafting floor
    const compassDial = new THREE.Group();
    const dialMat = new THREE.LineBasicMaterial({
      color: 0x161412,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
    });
    for (const r of [4.8, 5.45, 5.7]) {
      const cPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        cPts.push(new THREE.Vector3(Math.cos(a) * r, 0.002, Math.sin(a) * r));
      }
      compassDial.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cPts), dialMat));
    }
    // 72 degree tick marks around the azimuth ring
    const tickPts: THREE.Vector3[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const major = i % 6 === 0;
      const rIn = major ? 5.18 : 5.34;
      const rOut = 5.45;
      tickPts.push(
        new THREE.Vector3(Math.cos(a) * rIn, 0.003, Math.sin(a) * rIn),
        new THREE.Vector3(Math.cos(a) * rOut, 0.003, Math.sin(a) * rOut)
      );
    }
    compassDial.add(
      new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tickPts), dialMat)
    );
    floorGridGroup.add(compassDial);
    scene.add(floorGridGroup);

    // Build 11-layer iPhone 16 Pro CAD assembly
    const assembly = buildIphone16Pro();
    assemblyRef.current = assembly;
    scene.add(assembly.root);

    // Interaction & animation state
    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2(-99, -99);
    const resolutionVec = new THREE.Vector2(
      width * renderer.getPixelRatio(),
      height * renderer.getPixelRatio()
    );
    let currentExplode = targetExplodeRef.current;
    let lastTickBucket = Math.round(currentExplode * 32);
    let isPointerDown = false;
    let pointerDownPos = { x: 0, y: 0 };
    let cursorParallax = { x: 0, y: 0 };
    let smoothedParallax = { x: 0, y: 0 };
    let internalHovered: string | null = null;
    let lastTelemetryTime = 0;
    let showcasePhase = 0;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (autoShowcaseRef.current) onCancelShowcaseRef.current();

      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        const dir = camera.position.clone().sub(controls.target);
        const factor = 1 + Math.sign(e.deltaY) * 0.08;
        const newLen = THREE.MathUtils.clamp(
          dir.length() * factor,
          controls.minDistance,
          controls.maxDistance
        );
        dir.setLength(newLen);
        camera.position.copy(controls.target).add(dir);
        camAnimRef.current.active = false;
        return;
      }

      if (interactionModeRef.current === 'wheel') {
        const delta = e.deltaY * 0.00082;
        const next = THREE.MathUtils.clamp(targetExplodeRef.current + delta, 0, 1);
        targetExplodeRef.current = next;
        onExplodeChangeRef.current(next);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      const nx = (lx / rect.width) * 2 - 1;
      const ny = -(ly / rect.height) * 2 + 1;
      pointerNDC.set(nx, ny);

      cursorParallax.x = nx;
      cursorParallax.y = ny;

      // Update floating CAD drafting crosshair reticle smoothly
      const reticle = cursorReticleRef.current;
      if (reticle) {
        reticle.style.opacity = '1';
        reticle.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
        const coordEl = reticle.querySelector<HTMLSpanElement>('.reticle-coords');
        if (coordEl) {
          coordEl.textContent = `X:${Math.round(lx)} Y:${Math.round(ly)}`;
        }
      }

      // CURSOR SCRUB mode: gliding mouse across canvas smoothly explodes/assembles the phone
      if (interactionModeRef.current === 'cursor' && !isPointerDown) {
        if (autoShowcaseRef.current) onCancelShowcaseRef.current();
        const scrub = THREE.MathUtils.clamp(lx / rect.width, 0, 1);
        const mapped = THREE.MathUtils.clamp((scrub - 0.12) / 0.76, 0, 1);
        targetExplodeRef.current = mapped;
        onExplodeChangeRef.current(mapped);
      }

      if (isPointerDown) return;

      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObjects(assembly.root.children, true);
      let hitPartId: string | null = null;
      for (const hit of hits) {
        if (hit.object instanceof THREE.Mesh && hit.object.userData.partId) {
          hitPartId = hit.object.userData.partId as string;
          break;
        }
      }

      if (hitPartId !== internalHovered) {
        internalHovered = hitPartId;
        renderer.domElement.style.cursor = hitPartId ? 'pointer' : 'grab';
        onHoverRef.current(hitPartId);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      isPointerDown = true;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      renderer.domElement.style.cursor = 'grabbing';
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      isPointerDown = false;
      renderer.domElement.style.cursor = internalHovered ? 'pointer' : 'grab';

      if (dist < 6) {
        const rect = renderer.domElement.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const hits = raycaster.intersectObjects(assembly.root.children, true);
        let hitPartId: string | null = null;
        for (const hit of hits) {
          if (hit.object instanceof THREE.Mesh && hit.object.userData.partId) {
            hitPartId = hit.object.userData.partId as string;
            break;
          }
        }
        if (hitPartId) {
          if (autoShowcaseRef.current) onCancelShowcaseRef.current();
          soundEngine.playSelect();
          onSelectRef.current(hitPartId === selectedPartRef.current ? null : hitPartId);
        } else if (selectedPartRef.current) {
          onSelectRef.current(null);
        }
      }
    };

    const handlePointerLeave = () => {
      if (cursorReticleRef.current) {
        cursorReticleRef.current.style.opacity = '0';
      }
      if (internalHovered) {
        internalHovered = null;
        onHoverRef.current(null);
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('wheel', handleWheel, { passive: false });
    domEl.addEventListener('pointermove', handlePointerMove);
    domEl.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    domEl.addEventListener('pointerleave', handlePointerLeave);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      resolutionVec.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    };
    window.addEventListener('resize', handleResize);

    // Pre-allocated vectors for 3D -> 2D SVG projection
    const projVec = new THREE.Vector3();
    const clock = new THREE.Clock();
    let rafId = 0;

    const projectWorldToScreen = (
      vec: THREE.Vector3,
      w: number,
      h: number
    ): { x: number; y: number; behind: boolean } => {
      vec.applyMatrix4(assembly.root.matrixWorld);
      vec.project(camera);
      return {
        x: (vec.x * 0.5 + 0.5) * w,
        y: (-vec.y * 0.5 + 0.5) * h,
        behind: vec.z > 1,
      };
    };

    const updateSvgCallouts = (explodeAmt: number, w: number, h: number) => {
      const svg = svgOverlayRef.current;
      if (!svg) return;

      const density = labelDensityRef.current;
      const activeFocus = hoveredPartRef.current || selectedPartRef.current;

      // Always update the 3 architectural dimension badges (149.6 mm, 71.5 mm, live ΔZ)
      const dimAlpha = density === 'off' ? 0 : 0.78;
      const dimGroup = svg.querySelector<SVGGElement>('[data-dim-group="true"]');
      if (dimGroup) {
        dimGroup.style.opacity = dimAlpha.toFixed(2);
        if (dimAlpha > 0.01) {
          // Height 149.6 mm badge (left side of titanium chassis)
          projVec.set(-PHONE_W / 2 - 0.72, 0, 0);
          const pH = projectWorldToScreen(projVec, w, h);
          const hEl = dimGroup.querySelector<SVGTextElement>('[data-dim="height"]');
          if (hEl && !pH.behind) {
            hEl.setAttribute('x', pH.x.toFixed(1));
            hEl.setAttribute('y', pH.y.toFixed(1));
          }

          // Width 71.5 mm badge (above chassis)
          projVec.set(0, PHONE_H / 2 + 0.68, 0);
          const pW = projectWorldToScreen(projVec, w, h);
          const wEl = dimGroup.querySelector<SVGTextElement>('[data-dim="width"]');
          if (wEl && !pW.behind) {
            wEl.setAttribute('x', pW.x.toFixed(1));
            wEl.setAttribute('y', pW.y.toFixed(1));
          }

          // Live stretching ΔZ exploded depth badge (below phone along Z rail)
          const frontZ = (assembly.parts.get('ceramic-display')?.group.position.z ?? 0) + 0.21;
          const rearZ = (assembly.parts.get('rear-glass')?.group.position.z ?? 0) - 0.21;
          projVec.set(0, -4.52, (frontZ + rearZ) * 0.5);
          const pZ = projectWorldToScreen(projVec, w, h);
          const zEl = dimGroup.querySelector<SVGTextElement>('[data-dim="depth"]');
          if (zEl) {
            const zVis = explodeAmt > 0.1 && !pZ.behind;
            zEl.style.opacity = zVis ? '1' : '0';
            if (zVis) {
              const spanMm = (8.25 + explodeAmt * 198).toFixed(1);
              zEl.setAttribute('x', pZ.x.toFixed(1));
              zEl.setAttribute('y', pZ.y.toFixed(1));
              zEl.textContent = `◄  ΔZ ${spanMm} MM  ►`;
            }
          }
        }
      }

      const showPrimary = density !== 'off' && (explodeAmt > 0.18 || activeFocus !== null);
      const primaryAlpha = showPrimary
        ? activeFocus
          ? 1
          : THREE.MathUtils.smoothstep(explodeAmt, 0.18, 0.48)
        : 0;

      const leftItems: ProjectedCalloutItem[] = [];
      const rightItems: ProjectedCalloutItem[] = [];
      const hiddenKeys = new Set<string>();
      const isCompact = w < 960;

      // 1. Collect all 11 primary component callouts
      for (const meta of IPHONE_PARTS) {
        const part = assembly.parts.get(meta.id);
        if (!part || primaryAlpha <= 0.01) {
          hiddenKeys.add(`p:${meta.id}`);
          continue;
        }
        projVec.set(...meta.anchorLocal).add(part.group.position);
        const pt = projectWorldToScreen(projVec, w, h);
        if (pt.behind) {
          hiddenKeys.add(`p:${meta.id}`);
          continue;
        }

        const isActive = activeFocus === meta.id;
        const isDimmed = activeFocus !== null && !isActive;
        const side: 'left' | 'right' =
          pt.x < w * 0.48 ? 'left' : pt.x > w * 0.52 ? 'right' : meta.calloutSide;

        const item: ProjectedCalloutItem = {
          key: `p:${meta.id}`,
          isMicro: false,
          partId: meta.id,
          ax: pt.x,
          ay: pt.y,
          side,
          targetY: pt.y,
          isActive,
          isDimmed,
          priority: isActive ? 10 : 5,
        };
        if (side === 'left') leftItems.push(item);
        else rightItems.push(item);
      }

      // 2. Collect secondary hyper-detailed micro-callouts (A1..H1)
      const showRichMicro =
        density === 'rich' &&
        !isCompact &&
        (explodeAmt > 0.46 || selectedPartRef.current !== null);

      for (const mc of MICRO_CALLOUTS) {
        const part = assembly.parts.get(mc.parentPartId);
        const belongsToFocus = activeFocus === mc.parentPartId;
        const shouldShow =
          part &&
          density !== 'off' &&
          (belongsToFocus || (showRichMicro && activeFocus === null));

        if (!shouldShow || !part) {
          hiddenKeys.add(`m:${mc.id}`);
          continue;
        }

        const partP = assembly.getPartProgress(mc.parentPartId);
        projVec.set(...mc.localPos).add(part.group.position);
        if (mc.subExplodeDelta) {
          projVec.x += mc.subExplodeDelta[0] * partP;
          projVec.y += mc.subExplodeDelta[1] * partP;
          projVec.z += mc.subExplodeDelta[2] * partP;
        }

        const pt = projectWorldToScreen(projVec, w, h);
        if (pt.behind) {
          hiddenKeys.add(`m:${mc.id}`);
          continue;
        }

        const side: 'left' | 'right' =
          pt.x < w * 0.46 ? 'left' : pt.x > w * 0.54 ? 'right' : mc.side;

        const item: ProjectedCalloutItem = {
          key: `m:${mc.id}`,
          isMicro: true,
          partId: mc.parentPartId,
          ax: pt.x,
          ay: pt.y,
          side,
          targetY: pt.y,
          isActive: belongsToFocus,
          isDimmed: activeFocus !== null && !belongsToFocus,
          priority: belongsToFocus ? 9 : 2,
        };
        if (side === 'left') leftItems.push(item);
        else rightItems.push(item);
      }

      // Hide inactive nodes cleanly
      for (const k of hiddenKeys) {
        const el = svg.querySelector<SVGGElement>(`[data-callout="${k}"]`);
        if (el) el.style.opacity = '0';
      }

      // 3. Run anti-collision relaxation separately on left & right columns
      const safeTop = 132;
      const safeBottom = h - 122;
      resolveVerticalCollisions(leftItems, safeTop, safeBottom);
      resolveVerticalCollisions(rightItems, safeTop, safeBottom);

      // Compute clean architectural column rails (respecting side panels when visible)
      const leftRailX = Math.max(w * 0.23, isCompact ? 115 : 298);
      const rightRailX = Math.min(w * 0.77, isCompact ? w - 115 : w - 332);

      const renderColumn = (items: ProjectedCalloutItem[], isLeft: boolean) => {
        const dir = isLeft ? -1 : 1;
        const microFade = THREE.MathUtils.smoothstep(explodeAmt, 0.46, 0.72);

        for (const it of items) {
          const groupEl = svg.querySelector<SVGGElement>(`[data-callout="${it.key}"]`);
          if (!groupEl) continue;

          let alpha = it.isMicro
            ? it.isActive
              ? 0.96
              : microFade * 0.72
            : primaryAlpha * (it.isActive ? 1.0 : 0.88);
          if (it.isDimmed) alpha *= 0.16;

          groupEl.style.opacity = alpha.toFixed(3);
          groupEl.style.pointerEvents = alpha > 0.25 ? 'auto' : 'none';

          // Clean 45° elbow from 3D anchor -> horizontal shelf aligned to architectural column
          const railX = isLeft
            ? Math.min(it.ax - (it.isMicro ? 26 : 42), leftRailX)
            : Math.max(it.ax + (it.isMicro ? 26 : 42), rightRailX);

          const dy = it.targetY - it.ay;
          const elbowDx = Math.min(Math.abs(railX - it.ax) * 0.65, Math.abs(dy) + 18) * dir;
          const ex = it.ax + elbowDx;
          const ey = it.targetY;
          const tx = railX;
          const ty = it.targetY;

          const outerDot = groupEl.querySelector<SVGCircleElement>('.reticle-ring');
          const innerDot = groupEl.querySelector<SVGCircleElement>('.reticle-core');
          const poly = groupEl.querySelector<SVGPolylineElement>('.leader-line');
          const titleEl = groupEl.querySelector<SVGTextElement>('.callout-title');
          const subEl = groupEl.querySelector<SVGTextElement>('.callout-sub');

          if (outerDot) {
            outerDot.setAttribute('cx', it.ax.toFixed(1));
            outerDot.setAttribute('cy', it.ay.toFixed(1));
            outerDot.setAttribute('r', it.isActive ? '5.5' : it.isMicro ? '3.4' : '4.2');
          }
          if (innerDot) {
            innerDot.setAttribute('cx', it.ax.toFixed(1));
            innerDot.setAttribute('cy', it.ay.toFixed(1));
            innerDot.setAttribute('r', it.isActive ? '2.2' : '1.5');
          }
          if (poly) {
            poly.setAttribute(
              'points',
              `${it.ax.toFixed(1)},${it.ay.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`
            );
            poly.setAttribute(
              'stroke-width',
              it.isActive ? '1.35' : it.isMicro ? '0.7' : '0.9'
            );
          }

          const textX = tx + dir * 8;
          const anchor = isLeft ? 'end' : 'start';

          if (titleEl) {
            titleEl.setAttribute('x', textX.toFixed(1));
            titleEl.setAttribute('y', (ty - 2).toFixed(1));
            titleEl.setAttribute('text-anchor', anchor);
            titleEl.setAttribute('font-weight', it.isActive ? '700' : '600');
          }
          if (subEl) {
            subEl.setAttribute('x', textX.toFixed(1));
            subEl.setAttribute('y', (ty + 10.5).toFixed(1));
            subEl.setAttribute('text-anchor', anchor);
          }
        }
      };

      renderColumn(leftItems, true);
      renderColumn(rightItems, false);
    };

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      // 0. Autonomous Show-Off Showcase Mode (smooth cinematic orbit + wave explode + periodic ink scan!)
      if (autoShowcaseRef.current) {
        showcasePhase += dt;
        // Rhythmic smooth breathing explode cycle between 18% and 100%
        const wave = 0.59 + Math.sin(showcasePhase * 0.55 - 0.5) * 0.41;
        targetExplodeRef.current = wave;
        onExplodeChangeRef.current(wave);

        // Smooth architectural cinematic orbit around the floating blueprint
        const orbitAngle = showcasePhase * 0.24 + 0.72;
        const radius = 13.4 + Math.sin(showcasePhase * 0.32) * 1.4;
        const camY = 2.4 + Math.sin(showcasePhase * 0.4) * 2.1;
        camera.position.lerp(
          new THREE.Vector3(Math.sin(orbitAngle) * radius, camY, Math.cos(orbitAngle) * radius),
          1 - Math.exp(-2.8 * dt)
        );
        controls.target.lerp(new THREE.Vector3(0, -0.1, 0), 1 - Math.exp(-3.0 * dt));

        // Periodically fire a monochrome ink scan sweep every 7 seconds
        if (Math.floor(showcasePhase / 7) > Math.floor((showcasePhase - dt) / 7)) {
          scanAnimRef.current.active = true;
          scanAnimRef.current.progress = 0;
        }
      }

      // 1. Smooth damped explode interpolation
      const prevExplode = currentExplode;
      currentExplode = THREE.MathUtils.lerp(
        currentExplode,
        targetExplodeRef.current,
        1 - Math.exp(-8.5 * dt)
      );
      if (Math.abs(currentExplode - targetExplodeRef.current) < 0.0005) {
        currentExplode = targetExplodeRef.current;
      }

      const bucket = Math.round(currentExplode * 32);
      if (bucket !== lastTickBucket && Math.abs(currentExplode - prevExplode) > 0.002) {
        lastTickBucket = bucket;
        soundEngine.playTick(0.85 + currentExplode * 0.4);
      }

      assembly.updateExplode(currentExplode);

      // 2. Advance monochrome blueprint ink scan sweep
      let scanZ = 99.0;
      let scanStrength = 0.0;
      if (scanAnimRef.current.active) {
        scanAnimRef.current.progress += dt * 0.48;
        const sp = scanAnimRef.current.progress;
        if (sp >= 1.0) {
          scanAnimRef.current.active = false;
        } else if (sp >= 0) {
          scanZ = THREE.MathUtils.lerp(6.4, -6.4, sp);
          scanStrength = Math.sin(sp * Math.PI);
        }
      }

      // 3. Subtle floating motion, cursor parallax & slowly rotating drafting floor dial
      smoothedParallax.x = THREE.MathUtils.lerp(
        smoothedParallax.x,
        cursorParallax.x,
        1 - Math.exp(-4.5 * dt)
      );
      smoothedParallax.y = THREE.MathUtils.lerp(
        smoothedParallax.y,
        cursorParallax.y,
        1 - Math.exp(-4.5 * dt)
      );

      assembly.root.position.y = Math.sin(elapsed * 0.85) * 0.048;
      if (!autoShowcaseRef.current) {
        assembly.root.rotation.y = smoothedParallax.x * 0.055;
        assembly.root.rotation.x = -smoothedParallax.y * 0.035;
      } else {
        assembly.root.rotation.y = THREE.MathUtils.lerp(assembly.root.rotation.y, 0, 3 * dt);
        assembly.root.rotation.x = THREE.MathUtils.lerp(assembly.root.rotation.x, 0, 3 * dt);
      }
      compassDial.rotation.y = elapsed * 0.045;

      // 4. Smooth camera preset / part-focus fly-to
      if (camAnimRef.current.active && !autoShowcaseRef.current) {
        const lerpAlpha = 1 - Math.exp(-5.4 * dt);
        camera.position.lerp(camAnimRef.current.desiredPos, lerpAlpha);
        controls.target.lerp(camAnimRef.current.desiredTarget, lerpAlpha);
        if (
          camera.position.distanceTo(camAnimRef.current.desiredPos) < 0.03 &&
          controls.target.distanceTo(camAnimRef.current.desiredTarget) < 0.03
        ) {
          camAnimRef.current.active = false;
        }
      }

      controls.update();

      // 5. Update ink shaders (highlight / dim / hatching / scan sweep)
      const focusId = hoveredPartRef.current || selectedPartRef.current;
      const hatchVal = hatchEnabledRef.current ? 1.0 : 0.0;
      const stateLerp = 1 - Math.exp(-11 * dt);

      for (const part of assembly.parts.values()) {
        const targetHi = focusId === part.id ? 1.0 : 0.0;
        const targetDim = focusId !== null && focusId !== part.id ? 1.0 : 0.0;

        part.currentHighlight = THREE.MathUtils.lerp(part.currentHighlight, targetHi, stateLerp);
        part.currentDim = THREE.MathUtils.lerp(part.currentDim, targetDim, stateLerp);

        applyPartVisualState(
          part.style,
          part.currentHighlight,
          part.currentDim,
          hatchVal,
          resolutionVec,
          scanZ,
          scanStrength
        );
      }

      assembly.root.updateMatrixWorld(true);
      renderer.render(scene, camera);

      // 6. Update anti-colliding 3D-tracked SVG engineering callouts & live dimension labels
      const curW = container.clientWidth || window.innerWidth;
      const curH = container.clientHeight || window.innerHeight;
      updateSvgCallouts(currentExplode, curW, curH);

      // 7. Throttled azimuth/elevation telemetry
      if (onTelemetryRef.current && elapsed - lastTelemetryTime > 0.12) {
        lastTelemetryTime = elapsed;
        const rel = camera.position.clone().sub(controls.target);
        const az = Math.round(((Math.atan2(rel.x, rel.z) * 180) / Math.PI + 360) % 360);
        const el = Math.round(
          (Math.asin(THREE.MathUtils.clamp(rel.y / (rel.length() || 1), -1, 1)) * 180) / Math.PI
        );
        onTelemetryRef.current(az, el);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      controls.removeEventListener('start', stopCamAnim);
      controls.dispose();
      domEl.removeEventListener('wheel', handleWheel);
      domEl.removeEventListener('pointermove', handlePointerMove);
      domEl.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      domEl.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (domEl.parentNode === container) {
        container.removeChild(domEl);
      }
    };
  }, []);

  return (
    <div className="canvas-stage" ref={containerRef}>
      {/* Precision floating drafting cursor crosshair & coordinates */}
      <div className="cursor-reticle" ref={cursorReticleRef} aria-hidden="true">
        <span className="reticle-h" />
        <span className="reticle-v" />
        <span className="reticle-coords">X:0 Y:0</span>
      </div>

      {/* Real-time 3D-projected SVG Patent Engineering Callouts & Live Dimension Readouts */}
      <svg ref={svgOverlayRef} className="callout-svg-overlay" aria-hidden="true">
        {/* Live 3D Architectural Dimension Readouts */}
        <g data-dim-group="true" className="dim-labels-group">
          <text
            data-dim="height"
            x="0"
            y="0"
            textAnchor="end"
            fill="#161412"
            fontSize="10"
            fontFamily="var(--font-mono)"
            letterSpacing="0.08em"
          >
            149.6 MM
          </text>
          <text
            data-dim="width"
            x="0"
            y="0"
            textAnchor="middle"
            fill="#161412"
            fontSize="10"
            fontFamily="var(--font-mono)"
            letterSpacing="0.08em"
          >
            ◄ 71.5 MM ►
          </text>
          <text
            data-dim="depth"
            x="0"
            y="0"
            textAnchor="middle"
            fill="#161412"
            fontSize="10.5"
            fontWeight="600"
            fontFamily="var(--font-mono)"
            letterSpacing="0.1em"
          >
            ◄ ΔZ 000.0 MM ►
          </text>
        </g>

        {/* 11 Primary Bilingual Engineering Callouts */}
        {IPHONE_PARTS.map((part) => (
          <g
            key={`p:${part.id}`}
            data-callout={`p:${part.id}`}
            className="callout-group"
            style={{ opacity: 0 }}
            onClick={() => {
              soundEngine.playSelect();
              onSelectPart(selectedPartId === part.id ? null : part.id);
            }}
            onMouseEnter={() => onHoverPart(part.id)}
            onMouseLeave={() => onHoverPart(null)}
          >
            <circle
              className="reticle-ring"
              cx="0"
              cy="0"
              r="4.2"
              fill="#E9E0CF"
              fillOpacity="0.8"
              stroke="#161412"
              strokeWidth="0.9"
            />
            <circle className="reticle-core" cx="0" cy="0" r="1.5" fill="#161412" />
            <polyline
              className="leader-line"
              points="0,0 0,0 0,0"
              fill="none"
              stroke="#161412"
              strokeWidth="0.9"
            />
            <text
              className="callout-title"
              x="0"
              y="0"
              fill="#161412"
              fontSize="11"
              fontFamily="var(--font-sans)"
              letterSpacing="0.03em"
            >
              {part.index} · {part.shortTag}
            </text>
            <text
              className="callout-sub"
              x="0"
              y="0"
              fill="#4B453D"
              fontSize="8.8"
              fontFamily="var(--font-mono)"
              letterSpacing="0.05em"
            >
              {part.calloutSpec}
            </text>
          </g>
        ))}

        {/* 13 Secondary Micro-Detail Patent Pin Callouts (A1..H1) */}
        {MICRO_CALLOUTS.map((mc) => (
          <g
            key={`m:${mc.id}`}
            data-callout={`m:${mc.id}`}
            className="callout-group is-micro"
            style={{ opacity: 0 }}
            onClick={() => {
              soundEngine.playSelect();
              onSelectPart(mc.parentPartId);
            }}
            onMouseEnter={() => onHoverPart(mc.parentPartId)}
            onMouseLeave={() => onHoverPart(null)}
          >
            <circle
              className="reticle-ring"
              cx="0"
              cy="0"
              r="3.2"
              fill="none"
              stroke="#161412"
              strokeWidth="0.75"
              strokeDasharray="2 1.5"
            />
            <circle className="reticle-core" cx="0" cy="0" r="1.2" fill="#161412" />
            <polyline
              className="leader-line"
              points="0,0 0,0 0,0"
              fill="none"
              stroke="#161412"
              strokeWidth="0.7"
              strokeDasharray="2.5 2"
            />
            <text
              className="callout-title"
              x="0"
              y="0"
              fill="#161412"
              fontSize="9.8"
              fontFamily="var(--font-sans)"
              letterSpacing="0.02em"
            >
              [{mc.code}] {mc.titleZh}
            </text>
            <text
              className="callout-sub"
              x="0"
              y="0"
              fill="#5A5349"
              fontSize="8.2"
              fontFamily="var(--font-mono)"
              letterSpacing="0.05em"
            >
              {mc.detail}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
