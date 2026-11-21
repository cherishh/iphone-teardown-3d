import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BlueprintCanvas,
  type CameraPreset,
  type InteractionMode,
  type LabelDensity,
} from './components/BlueprintCanvas';
import { IPHONE_PARTS, PART_MAP } from './data/parts';
import { soundEngine } from './utils/sound';

const VIEW_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'iso', label: '等轴 ISO' },
  { id: 'front', label: '正面' },
  { id: 'side', label: '侧面' },
  { id: 'back', label: '背面' },
];

const DENSITY_CYCLE: { id: LabelDensity; label: string }[] = [
  { id: 'rich', label: '标注·详尽' },
  { id: 'clean', label: '标注·精简' },
  { id: 'off', label: '标注·关' },
];

export const App: React.FC = () => {
  const [explode, setExplode] = useState<number>(0.0);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('wheel');
  const [labelDensity, setLabelDensity] = useState<LabelDensity>('rich');
  const [hatchEnabled, setHatchEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [autoShowcase, setAutoShowcase] = useState<boolean>(false);
  const [stageOnly, setStageOnly] = useState<boolean>(false);
  const [bomOpen, setBomOpen] = useState<boolean>(true);
  const [scanRequestSeq, setScanRequestSeq] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<CameraPreset>('iso');
  const [cameraPresetRequest, setCameraPresetRequest] = useState<{
    preset: CameraPreset;
    seq: number;
  } | null>(null);
  const [telemetry, setTelemetry] = useState<{ az: number; el: number }>({ az: 43, el: 15 });

  // Choreographed opening reveal: blooms smoothly from assembled -> 74% exploded
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setExplode(0.74);
    }, 320);
    return () => window.clearTimeout(timer);
  }, []);

  // Keyboard shortcuts: ESC reset, Space toggle explode, H toggle pure stage mode, S scan wave
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;
      if (e.key === 'Escape') {
        setSelectedPartId(null);
        setAutoShowcase(false);
        setActivePreset('iso');
        setCameraPresetRequest((prev) => ({ preset: 'iso', seq: (prev?.seq ?? 0) + 1 }));
      } else if (e.key === ' ') {
        e.preventDefault();
        setAutoShowcase(false);
        setExplode((prev) => (prev > 0.5 ? 0 : 1));
      } else if (e.key.toLowerCase() === 'h') {
        setStageOnly((v) => !v);
      } else if (e.key.toLowerCase() === 's') {
        setScanRequestSeq((s) => s + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEngine.setEnabled(next);
      if (next) soundEngine.playSelect();
      return next;
    });
  }, []);

  const handleCycleLabelDensity = useCallback(() => {
    soundEngine.playSelect();
    setLabelDensity((prev) => {
      const idx = DENSITY_CYCLE.findIndex((d) => d.id === prev);
      return DENSITY_CYCLE[(idx + 1) % DENSITY_CYCLE.length].id;
    });
  }, []);

  const handleRequestPreset = useCallback((preset: CameraPreset) => {
    soundEngine.playSelect();
    setAutoShowcase(false);
    setSelectedPartId(null);
    setActivePreset(preset);
    setCameraPresetRequest((prev) => ({ preset, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const handleCancelShowcase = useCallback(() => {
    setAutoShowcase(false);
  }, []);

  const handleTelemetry = useCallback((az: number, el: number) => {
    setTelemetry((prev) => (prev.az === az && prev.el === el ? prev : { az, el }));
  }, []);

  const activePart = useMemo(() => {
    const id = selectedPartId ?? hoveredPartId;
    return id ? PART_MAP.get(id) ?? null : null;
  }, [selectedPartId, hoveredPartId]);

  const currentDensityLabel =
    DENSITY_CYCLE.find((d) => d.id === labelDensity)?.label ?? '标注·详尽';
  const explodePct = Math.round(explode * 100);
  const expansionMm = (explode * 198).toFixed(1).padStart(5, '0');

  return (
    <div className={`blueprint-sheet ${stageOnly ? 'is-stage-only' : ''}`}>
      {/* Tactile monochrome parchment grain overlay */}
      <div className="paper-grain" aria-hidden="true" />

      {/* Architectural Patent Sheet Border Frame & Edge Millimeter Rulers */}
      <div className="drafting-frame" aria-hidden="true">
        <span className="reg-mark reg-tl">+</span>
        <span className="reg-mark reg-tr">+</span>
        <span className="reg-mark reg-bl">+</span>
        <span className="reg-mark reg-br">+</span>
        <div className="ruler-top" />
        <div className="ruler-left" />
      </div>

      {/* Full-Bleed 3D Hidden-Line Blueprint Viewport */}
      <BlueprintCanvas
        targetExplode={explode}
        onTargetExplodeChange={setExplode}
        selectedPartId={selectedPartId}
        hoveredPartId={hoveredPartId}
        onSelectPart={setSelectedPartId}
        onHoverPart={setHoveredPartId}
        interactionMode={interactionMode}
        labelDensity={labelDensity}
        hatchEnabled={hatchEnabled}
        autoShowcase={autoShowcase}
        onCancelAutoShowcase={handleCancelShowcase}
        scanRequestSeq={scanRequestSeq}
        cameraPresetRequest={cameraPresetRequest}
        onHudTelemetry={handleTelemetry}
      />

      {/* TOP ARCHITECTURAL HEADER & SHOWCASE CONTROLS */}
      <header className="sheet-header">
        <div className="title-block">
          <div className="title-meta-row">
            <span>DWG NO. APL-16P-2024</span>
            <span className="sep">//</span>
            <span>FIG. 01–11 · A1–H1</span>
            <span className="sep">//</span>
            <span>SCALE 1:1</span>
          </div>
          <h1 className="sheet-title">
            iPhone 16 Pro <span className="sheet-title-sub">结构拆解蓝图</span>
          </h1>
          <p className="sheet-subtitle">
            EXPLODED PATENT ASSEMBLY · 24 TECHNICAL ANNOTATIONS · GRADE 5 TITANIUM
          </p>
        </div>

        <nav className="toolbar" aria-label="视图与图纸控制">
          {/* Show-Off Cinematic Controls */}
          <div className="tool-group">
            <button
              type="button"
              className={`ink-btn ${autoShowcase ? 'is-active' : ''}`}
              onClick={() => {
                soundEngine.playSelect();
                setSelectedPartId(null);
                setAutoShowcase((v) => !v);
              }}
              title="开启自动电影级巡航运镜与呼吸式波浪拆解"
            >
              {autoShowcase ? '● 巡航演示中' : '▷ 自动巡航'}
            </button>
            <button
              type="button"
              className="ink-btn"
              onClick={() => {
                soundEngine.playSelect();
                setScanRequestSeq((s) => s + 1);
              }}
              title="触发蓝图墨线透视扫描波 (快捷键 S)"
            >
              扫描波
            </button>
            <button
              type="button"
              className={`ink-btn ${stageOnly ? 'is-active' : ''}`}
              onClick={() => {
                soundEngine.playSelect();
                setStageOnly((v) => !v);
              }}
              title="隐藏侧栏，全屏纯净展示工程蓝图与详尽标注 (快捷键 H)"
            >
              {stageOnly ? '恢复面板' : '纯净展台'}
            </button>
          </div>

          {/* Camera View Presets */}
          <div className="tool-group">
            {VIEW_PRESETS.map((vp) => (
              <button
                key={vp.id}
                type="button"
                className={`ink-btn ${activePreset === vp.id && !selectedPartId && !autoShowcase ? 'is-active' : ''}`}
                onClick={() => handleRequestPreset(vp.id)}
              >
                {vp.label}
              </button>
            ))}
          </div>

          {/* Explode Input Mode Switch */}
          <div className="tool-group">
            <button
              type="button"
              className={`ink-btn ${interactionMode === 'wheel' ? 'is-active' : ''}`}
              onClick={() => {
                soundEngine.playSelect();
                setInteractionMode('wheel');
              }}
            >
              滚轮拆解
            </button>
            <button
              type="button"
              className={`ink-btn ${interactionMode === 'cursor' ? 'is-active' : ''}`}
              onClick={() => {
                soundEngine.playSelect();
                setInteractionMode('cursor');
              }}
            >
              光标滑动
            </button>
          </div>

          {/* Blueprint Drafting Toggles */}
          <div className="tool-group">
            <button
              type="button"
              className={`ink-btn ${labelDensity !== 'off' ? 'is-active' : ''}`}
              onClick={handleCycleLabelDensity}
              title="切换标注密度：详尽 (24处标注) / 精简 (11处主标注) / 关闭"
            >
              {currentDensityLabel}
            </button>
            <button
              type="button"
              className={`ink-btn ${hatchEnabled ? 'is-active' : ''}`}
              onClick={() => setHatchEnabled((v) => !v)}
            >
              排线
            </button>
            <button
              type="button"
              className={`ink-btn ${soundEnabled ? 'is-active' : ''}`}
              onClick={handleToggleSound}
            >
              {soundEnabled ? '音效·开' : '音效·关'}
            </button>
          </div>
        </nav>
      </header>

      {/* LEFT RAIL: BILL OF MATERIALS (PARTS INDEX) */}
      {!stageOnly && (
        <aside className={`bom-panel ${bomOpen ? 'is-open' : 'is-collapsed'}`}>
          <div className="panel-head">
            <span className="panel-code">BOM // 零件索引 (11)</span>
            <button
              type="button"
              className="panel-toggle"
              onClick={() => setBomOpen((v) => !v)}
              aria-label={bomOpen ? '收起零件索引' : '展开零件索引'}
            >
              {bomOpen ? '—' : '+'}
            </button>
          </div>

          {bomOpen && (
            <ul className="bom-list">
              {IPHONE_PARTS.map((part) => {
                const isSelected = selectedPartId === part.id;
                const isHovered = hoveredPartId === part.id;
                return (
                  <li key={part.id}>
                    <button
                      type="button"
                      className={`bom-item ${isSelected ? 'is-selected' : ''} ${isHovered ? 'is-hovered' : ''}`}
                      onMouseEnter={() => setHoveredPartId(part.id)}
                      onMouseLeave={() => setHoveredPartId(null)}
                      onClick={() => {
                        soundEngine.playSelect();
                        setAutoShowcase(false);
                        setSelectedPartId((prev) => (prev === part.id ? null : part.id));
                      }}
                    >
                      <span className="bom-num">{part.index}</span>
                      <span className="bom-name">{part.nameZh}</span>
                      <span className="bom-arrow">{isSelected ? '●' : '↗'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      )}

      {/* RIGHT PANEL: TECHNICAL PATENT SPECIFICATION INSPECTOR */}
      {(!stageOnly || selectedPartId !== null) && (
        <aside className="spec-panel">
          {activePart ? (
            <div className="spec-card">
              <div className="spec-card-head">
                <div>
                  <div className="spec-fig">
                    {activePart.fig} · {activePart.category}
                  </div>
                  <h2 className="spec-title">{activePart.nameZh}</h2>
                  <div className="spec-en">{activePart.nameEn}</div>
                </div>
                {selectedPartId && (
                  <button
                    type="button"
                    className="close-btn"
                    onClick={() => handleRequestPreset('iso')}
                    title="返回全景 (ESC)"
                  >
                    ✕
                  </button>
                )}
              </div>

              <p className="spec-summary">{activePart.summary}</p>

              <div className="spec-meta-grid">
                <div className="spec-meta-cell">
                  <span className="meta-k">材质工艺</span>
                  <span className="meta-v">{activePart.material}</span>
                </div>
                <div className="spec-meta-cell">
                  <span className="meta-k">外形尺寸</span>
                  <span className="meta-v mono">{activePart.dimensions}</span>
                </div>
                <div className="spec-meta-cell">
                  <span className="meta-k">组件净重</span>
                  <span className="meta-v mono">{activePart.mass}</span>
                </div>
              </div>

              <div className="spec-section">
                <div className="section-label">TECHNICAL PARAMETERS // 关键参数</div>
                <dl className="spec-dl">
                  {activePart.specs.map((s) => (
                    <div className="spec-dl-row" key={s.label}>
                      <dt>{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="spec-section">
                <div className="section-label">SUB-ASSEMBLIES // 子组件构成</div>
                <ul className="sub-list">
                  {activePart.subcomponents.map((sub, i) => (
                    <li key={sub}>
                      <span className="sub-idx">0{i + 1}</span>
                      <span>{sub}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedPartId && (
                <div className="spec-footer-action">
                  <button
                    type="button"
                    className="ink-btn full-width"
                    onClick={() => handleRequestPreset('iso')}
                  >
                    返回等轴测全景 [ ESC ]
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="spec-idle">
              <div className="section-label">DRAFTING NOTES // 交互与快捷键</div>
              <ul className="hint-list">
                <li>
                  <span className="hint-key">
                    {interactionMode === 'cursor' ? '光标左右滑动' : '鼠标滚轮 / SPACE'}
                  </span>
                  <span className="hint-desc">
                    {interactionMode === 'cursor'
                      ? '光标滑过画布即可实时散开与收拢'
                      : '波浪式逐层拆解 11 组精密组件'}
                  </span>
                </li>
                <li>
                  <span className="hint-key">左键拖拽 / Shift+滚轮</span>
                  <span className="hint-desc">360° 自由旋转与无级缩放细节</span>
                </li>
                <li>
                  <span className="hint-key">▷ 自动巡航 / 快捷键 H · S</span>
                  <span className="hint-desc">一键巡航展示、纯净展台或发射扫描波</span>
                </li>
                <li>
                  <span className="hint-key">点击任意零件或标注</span>
                  <span className="hint-desc">镜头飞向聚焦并展开子组件微标注</span>
                </li>
              </ul>

              <div className="patent-stamp">
                <div>TOTAL MASS: 199.0 G · 24 CALLOUTS</div>
                <div>DIMENSIONS: 149.6 × 71.5 × 8.25 MM</div>
                <div>PROJECTION: 3D HIDDEN-LINE PATENT CAD</div>
              </div>
            </div>
          )}
        </aside>
      )}

      {/* BOTTOM VERNIER CALIPER EXPLODE SCRUBBER & TELEMETRY */}
      <footer className="sheet-footer">
        <div className="telemetry-block">
          <span>AZ {String(telemetry.az).padStart(3, '0')}°</span>
          <span className="sep">/</span>
          <span>
            EL {telemetry.el >= 0 ? '+' : ''}
            {telemetry.el}°
          </span>
        </div>

        <div className="caliper-control">
          <button
            type="button"
            className="ink-btn caliper-toggle"
            onClick={() => {
              soundEngine.playSelect();
              setAutoShowcase(false);
              setExplode((prev) => (prev > 0.5 ? 0 : 1));
            }}
          >
            {explode > 0.5 ? '收拢复原' : '全部拆解'}
          </button>

          <div className="caliper-track-wrap">
            <div className="caliper-scale-labels">
              <span>00% 整机</span>
              <span className="caliper-readout">
                EXPLODE {String(explodePct).padStart(3, '0')}% · ΔZ {expansionMm} MM
              </span>
              <span>100% 爆炸视图</span>
            </div>
            <div className="caliper-ticks" aria-hidden="true">
              {Array.from({ length: 41 }).map((_, idx) => (
                <span
                  key={idx}
                  className={idx % 10 === 0 ? 'tick major' : idx % 5 === 0 ? 'tick mid' : 'tick'}
                />
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.002}
              value={explode}
              onChange={(e) => {
                setAutoShowcase(false);
                setExplode(parseFloat(e.target.value));
              }}
              className="caliper-slider"
              aria-label="拆解进度控制"
            />
          </div>
        </div>

        <div className="telemetry-block right">
          <span>
            {autoShowcase
              ? 'MODE: AUTO SHOWCASE'
              : interactionMode === 'cursor'
                ? 'MODE: CURSOR SCRUB'
                : 'MODE: WHEEL SCRUB'}
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
