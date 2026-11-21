import * as THREE from 'three';

/**
 * Pure monochrome drafting paper & black ink color constants.
 * Zero extra colors — strictly warm beige/light-brown paper + charcoal black ink.
 */
export const PAPER_HEX = 0xe9e0cf;
export const PAPER_CSS = '#E9E0CF';
export const INK_HEX = 0x161412;
export const INK_SOFT_HEX = 0x4b453d;

export interface InkStyleHandle {
  occluders: THREE.ShaderMaterial[];
  lines: THREE.LineBasicMaterial[];
  silhouettes: THREE.ShaderMaterial[];
  dashedLines: THREE.LineDashedMaterial[];
}

export function createEmptyStyleHandle(): InkStyleHandle {
  return {
    occluders: [],
    lines: [],
    silhouettes: [],
    dashedLines: [],
  };
}

/**
 * Custom GLSL Paper Occluder Material:
 * - Writes depth cleanly for authentic Hidden-Line Removal (HLR)
 * - Renders warm beige paper tone matching the page canvas
 * - Adds ultra-fine architectural pen cross-hatching on shaded planes
 *   so 3D depth reads effortlessly like an authentic mechanical patent plate.
 */
export function createPaperOccluderMaterial(
  options: {
    shadeTint?: number;
    hatchScale?: number;
    hatchEnabled?: number;
    doubleSide?: boolean;
  } = {}
): THREE.ShaderMaterial {
  const {
    shadeTint = 0.0,
    hatchScale = 1.0,
    hatchEnabled = 1.0,
    doubleSide = false,
  } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uPaperColor: { value: new THREE.Color(PAPER_HEX) },
      uInkColor: { value: new THREE.Color(INK_HEX) },
      uLightDir: { value: new THREE.Vector3(0.58, 0.72, 0.62).normalize() },
      uShadeTint: { value: shadeTint },
      uHatchScale: { value: hatchScale },
      uHatchEnabled: { value: hatchEnabled },
      uHighlight: { value: 0.0 },
      uDim: { value: 0.0 },
      uScanZ: { value: 99.0 },
      uScanStrength: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPaperColor;
      uniform vec3 uInkColor;
      uniform vec3 uLightDir;
      uniform float uShadeTint;
      uniform float uHatchScale;
      uniform float uHatchEnabled;
      uniform float uHighlight;
      uniform float uDim;
      uniform float uScanZ;
      uniform float uScanStrength;

      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;

      void main() {
        vec3 N = normalize(vNormalWorld);
        if (!gl_FrontFacing) N = -N;

        float ndl = dot(N, normalize(uLightDir));
        float diffuse = ndl * 0.5 + 0.5;

        // Subtle warm tonal lift/drop while staying strictly monochrome beige paper
        vec3 base = uPaperColor;
        // Slightly warmer recessed tone for internal parts (shadeTint)
        base = mix(base, base * 0.935, uShadeTint);
        // Very gentle directional shading
        base = mix(base * 0.955, base * 1.022, smoothstep(0.15, 0.92, diffuse));

        // Subtle architectural pen hatching in shadowed areas (screen-space crisp lines)
        if (uHatchEnabled > 0.01) {
          vec2 sc = gl_FragCoord.xy * (0.58 * uHatchScale);
          float diag1 = abs(fract((sc.x + sc.y) * 0.145) - 0.5);
          float diag2 = abs(fract((sc.x - sc.y) * 0.145) - 0.5);

          float line1 = 1.0 - smoothstep(0.035, 0.095, diag1);
          float line2 = 1.0 - smoothstep(0.035, 0.095, diag2);

          float shadow1 = smoothstep(0.56, 0.24, diffuse);
          float shadow2 = smoothstep(0.32, 0.08, diffuse);

          float hatchAmount = max(line1 * shadow1 * 0.17, line2 * shadow2 * 0.14);
          hatchAmount *= uHatchEnabled * (1.0 - uDim * 0.65);

          base = mix(base, uInkColor, hatchAmount);
        }

        // Monochrome drafting scanline pulse (strictly pure ink-on-paper sweep!)
        if (uScanStrength > 0.01) {
          float dz = abs(vWorldPos.z - uScanZ);
          float coreLine = 1.0 - smoothstep(0.0, 0.045, dz);
          float halo = (1.0 - smoothstep(0.0, 0.55, dz)) * 0.22;
          // Fine drafting hatch ripple inside scan band
          vec2 sc2 = gl_FragCoord.xy * 0.72;
          float scanHatch = 1.0 - smoothstep(0.04, 0.12, abs(fract((sc2.x + sc2.y) * 0.22) - 0.5));
          float bandInk = max(coreLine * 0.82, halo * (0.4 + scanHatch * 0.9)) * uScanStrength;
          base = mix(base, uInkColor, bandInk * (1.0 - uDim * 0.5));
        }

        // Highlight slightly brightens paper like a drafting spotlight
        base = mix(base, vec3(0.955, 0.928, 0.872), uHighlight * 0.62);
        // Dim blends gently back toward the exact background paper
        base = mix(base, uPaperColor, uDim * 0.72);

        gl_FragColor = vec4(base, 1.0);
      }
    `,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: 1.6,
    polygonOffsetUnits: 2.0,
  });
}

/**
 * Constant screen-space thickness inverted-hull silhouette shader.
 * Gives smooth rounded forms (titanium rails, camera barrels, glass corners)
 * razor-sharp continuous black ink contours from any angle.
 */
export function createSilhouetteMaterial(
  thicknessPx = 1.35
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInkColor: { value: new THREE.Color(INK_HEX) },
      uPaperColor: { value: new THREE.Color(PAPER_HEX) },
      uThickness: { value: thicknessPx },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uHighlight: { value: 0.0 },
      uDim: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      uniform float uThickness;
      uniform vec2 uResolution;
      uniform float uHighlight;

      void main() {
        vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 viewNormal = normalize(normalMatrix * normal);
        vec2 clipNormal = normalize((projectionMatrix * vec4(viewNormal, 0.0)).xy + vec2(1e-5));

        float px = uThickness * (1.0 + uHighlight * 0.45);
        vec2 offset = clipNormal * (px * 2.0 / uResolution) * clipPos.w;
        clipPos.xy += offset;
        gl_Position = clipPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInkColor;
      uniform vec3 uPaperColor;
      uniform float uDim;

      void main() {
        vec3 col = mix(uInkColor, uPaperColor, uDim * 0.74);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: true,
  });
}

/**
 * Crisp ink line material for EdgesGeometry and schematic CAD strokes.
 */
export function createInkLineMaterial(
  opacity = 0.92,
  soft = false
): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: soft ? INK_SOFT_HEX : INK_HEX,
    transparent: opacity < 0.99,
    opacity,
    depthWrite: false,
  });
}

/**
 * Dashed blueprint alignment axis line material.
 */
export function createDashedGuideMaterial(
  opacity = 0.34
): THREE.LineDashedMaterial {
  return new THREE.LineDashedMaterial({
    color: INK_HEX,
    dashSize: 0.11,
    gapSize: 0.09,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

/**
 * Apply highlight / dim visual state to a part's materials smoothly.
 */
export function applyPartVisualState(
  handle: InkStyleHandle,
  highlight: number,
  dim: number,
  hatchEnabled: number,
  resolution: THREE.Vector2,
  scanZ = 99.0,
  scanStrength = 0.0
): void {
  for (const mat of handle.occluders) {
    mat.uniforms.uHighlight.value = highlight;
    mat.uniforms.uDim.value = dim;
    mat.uniforms.uHatchEnabled.value = hatchEnabled;
    mat.uniforms.uScanZ.value = scanZ;
    mat.uniforms.uScanStrength.value = scanStrength;
  }

  for (const mat of handle.silhouettes) {
    mat.uniforms.uHighlight.value = highlight;
    mat.uniforms.uDim.value = dim;
    mat.uniforms.uResolution.value.copy(resolution);
  }

  for (const mat of handle.lines) {
    const baseOp = (mat.userData.baseOpacity as number | undefined) ?? 0.92;
    const targetOp = THREE.MathUtils.clamp(
      baseOp * (1 - dim * 0.74) + highlight * 0.14,
      0.08,
      1.0
    );
    mat.opacity = targetOp;
    mat.transparent = targetOp < 0.99;
  }

  for (const mat of handle.dashedLines) {
    const baseOp = (mat.userData.baseOpacity as number | undefined) ?? 0.45;
    mat.opacity = baseOp * (1 - dim * 0.75);
  }
}
