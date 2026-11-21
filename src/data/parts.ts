export interface PartSpec {
  label: string;
  value: string;
}

export interface IphonePartMeta {
  id: string;
  index: string;
  fig: string;
  nameZh: string;
  nameEn: string;
  shortTag: string;
  calloutSpec: string;
  category: string;
  material: string;
  dimensions: string;
  mass: string;
  summary: string;
  specs: PartSpec[];
  subcomponents: string[];
  /** Displacement vector at 100% exploded state */
  explodeOffset: [number, number, number];
  /** Staggered [start, end] window within 0..1 for choreographed wave explosion */
  stagger: [number, number];
  /** Local anchor point on the part for SVG engineering leader line */
  anchorLocal: [number, number, number];
  /** Preferred side for label placement */
  calloutSide: 'left' | 'right';
  /** Ideal camera offset relative to part world center when focused */
  focusCameraOffset: [number, number, number];
}

export interface MicroCalloutMeta {
  id: string;
  parentPartId: string;
  code: string;
  titleZh: string;
  titleEn: string;
  detail: string;
  /** Local point relative to parentPart group (or offset with explode progress) */
  localPos: [number, number, number];
  /** Extra delta applied proportional to part explode progress (e.g., for sub-exploded lenses/screws) */
  subExplodeDelta?: [number, number, number];
  side: 'left' | 'right';
}

export const IPHONE_PARTS: IphonePartMeta[] = [
  {
    id: 'ceramic-display',
    index: '01',
    fig: 'FIG. 01',
    nameZh: '超瓷晶面板与 OLED 显示总成',
    nameEn: 'CERAMIC SHIELD & SUPER RETINA XDR',
    shortTag: '超瓷晶面板 · OLED',
    calloutSpec: '6.3" LTPO · 120Hz · 1.15mm BRS',
    category: 'OPTICAL / DISPLAY',
    material: '双离子交换微晶玻璃 / LTPO OLED',
    dimensions: '149.6 × 71.5 × 1.15 mm',
    mass: '36.4 g',
    summary:
      '超窄边框 6.3 英寸 LTPO 有源矩阵 OLED 面板，顶部集成灵动岛传感器开孔与微缝听筒导音槽，表面覆盖纳米级微晶陶瓷强化玻璃。',
    specs: [
      { label: '分辨率', value: '2622 × 1206 px (460 ppi)' },
      { label: '刷新率', value: '1–120 Hz ProMotion 自适应' },
      { label: '边框宽度', value: '1.15 mm BRS 极窄封装' },
      { label: '峰值亮度', value: '2000 nits (户外)' },
    ],
    subcomponents: [
      'Ceramic Shield 玻璃盖板',
      '电容式触控感应层',
      'LTPO OLED 发光基板',
      '显示驱动芯片柔性排线 (COF)',
    ],
    explodeOffset: [0, 0.1, 5.1],
    stagger: [0.0, 0.78],
    anchorLocal: [1.62, 1.95, 0.22],
    calloutSide: 'right',
    focusCameraOffset: [3.2, 1.5, 5.2],
  },
  {
    id: 'truedepth',
    index: '02',
    fig: 'FIG. 02',
    nameZh: 'TrueDepth 原深感传感器阵列',
    nameEn: 'TRUEDEPTH & DYNAMIC ISLAND',
    shortTag: 'TrueDepth 原深感',
    calloutSpec: '30,000+ IR DOTS · 12MP ƒ/1.9',
    category: 'BIOMETRIC OPTICS',
    material: '精密光学模组 / 镀金屏蔽罩',
    dimensions: '24.8 × 7.4 × 4.2 mm',
    mass: '3.2 g',
    summary:
      '隐蔽于灵动岛下方的微型三维结构光模组，集成了点阵投影器、泛光感应元件、红外镜头与 12MP 前置自动对焦镜头。',
    specs: [
      { label: '红外投射点', value: '> 30,000 不可见结构光点' },
      { label: '前置光圈', value: 'ƒ/1.9 六镜式自动对焦' },
      { label: '集成模块', value: 'VCSEL + IR + RGB 三合一' },
    ],
    subcomponents: [
      '点阵投影器 (Dot Projector)',
      '泛光感应元件 (Flood Illuminator)',
      '12MP 前置摄像头',
      '近距离环境光微传感器',
    ],
    explodeOffset: [0, 0.78, 3.5],
    stagger: [0.08, 0.86],
    anchorLocal: [0.58, 3.12, 0.14],
    calloutSide: 'right',
    focusCameraOffset: [2.4, 1.4, 3.6],
  },
  {
    id: 'titanium-frame',
    index: '03',
    fig: 'FIG. 03',
    nameZh: '5 级钛金属中框与散热子结构',
    nameEn: 'GRADE 5 TITANIUM CHASSIS',
    shortTag: '5 级钛金属中框',
    calloutSpec: 'Ti-6Al-4V · IP68 · GRAPHITE CORE',
    category: 'STRUCTURAL ENCLOSURE',
    material: 'Ti-6Al-4V 5 级钛合金 + 再生铝内框',
    dimensions: '149.6 × 71.5 × 8.25 mm',
    mass: '44.8 g',
    summary:
      '固态扩散焊接工艺将 CNC 精加工 5 级钛金属外框与高导热再生铝内部骨架融为一体，侧边集成操作按钮与蓝宝石电容式相机控制按键。',
    specs: [
      { label: '外框材质', value: '航空级 Ti-6Al-4V 钛合金' },
      { label: '散热优化', value: '石墨覆层铝制热传导子框架' },
      { label: '新增交互', value: '压力 + 电容触控相机控制键' },
      { label: '防护等级', value: 'IP68 (6m 水深 / 30min)' },
    ],
    subcomponents: [
      'CNC 钛金属外环与天线断点',
      '铝制内部蜂窝加强肋',
      '操作按钮与音量键组',
      '蓝宝石相机控制感应模组',
    ],
    explodeOffset: [0, 0, 0],
    stagger: [0.0, 1.0],
    anchorLocal: [-1.78, 1.38, 0],
    calloutSide: 'left',
    focusCameraOffset: [-4.5, 2.0, 5.5],
  },
  {
    id: 'logic-board',
    index: '04',
    fig: 'FIG. 04',
    nameZh: 'A18 Pro 双层堆叠核心主板',
    nameEn: 'A18 PRO DUAL-STACK LOGIC BOARD',
    shortTag: 'A18 Pro 堆叠主板',
    calloutSpec: 'TSMC 3NM N3E · 16-CORE NE · 35 TOPS',
    category: 'COMPUTE / SILICON',
    material: '高密度 HDI 十二层 PCB / 3nm FinFET',
    dimensions: '54.2 × 28.6 × 2.8 mm',
    mass: '14.6 g',
    summary:
      '超高集成度“三明治”双层堆叠逻辑板，搭载第二代 3nm 工艺 A18 Pro 芯片、16 核神经网络引擎、LPDDR5X 统一内存与 5G 基带射频系统。',
    specs: [
      { label: '核心芯片', value: 'A18 Pro (6核CPU + 6核GPU)' },
      { label: '制程工艺', value: 'TSMC N3E 第二代 3nm' },
      { label: '神经引擎', value: '16-Core Neural Engine (35 TOPS)' },
      { label: '主板结构', value: '双层夹层焊接 + EMI 屏蔽罩' },
    ],
    subcomponents: [
      'A18 Pro SoC 封装芯片',
      'NVMe 高速闪存颗粒',
      '多路电源管理 IC (PMIC)',
      '5G 毫米波/Sub-6 射频前端',
    ],
    explodeOffset: [0.58, 0.08, 1.92],
    stagger: [0.14, 0.92],
    anchorLocal: [1.12, 0.24, 0.14],
    calloutSide: 'right',
    focusCameraOffset: [3.2, 1.1, 3.4],
  },
  {
    id: 'camera-system',
    index: '05',
    fig: 'FIG. 05',
    nameZh: 'Pro 三摄与四重反射棱镜模组',
    nameEn: 'PRO TRIPLE-CAMERA OPTICAL ARRAY',
    shortTag: 'Pro 三摄光学模组',
    calloutSpec: '48MP ƒ/1.78 · 5× TETRAPRISM · LiDAR',
    category: 'IMAGING / TELEPHOTO',
    material: '蓝宝石镜片 / 精密防抖万向架 / 光学棱镜',
    dimensions: '35.2 × 34.8 × 9.6 mm',
    mass: '22.8 g',
    summary:
      '由 48MP 融合主摄、48MP 超广角及 12MP 5 倍四重反射棱镜长焦构成，搭配 LiDAR 激光雷达扫描仪。拆解状态下主摄多层镜片组将同步微距展开。',
    specs: [
      { label: '融合主摄', value: '48MP 24mm ƒ/1.78 二代传感器位移 OIS' },
      { label: '超广角', value: '48MP 13mm ƒ/2.2 微距自动对焦' },
      { label: '长焦结构', value: '12MP 120mm 四重反射玻璃棱镜 (5×)' },
      { label: '空间测距', value: 'dToF LiDAR 激光雷达扫描仪' },
    ],
    subcomponents: [
      '48MP 融合主摄多片光学镜组',
      '48MP 超广角微距镜头',
      '5× 四重反射棱镜潜望长焦腔体',
      'LiDAR 扫描仪 & 原彩闪光灯',
    ],
    explodeOffset: [0.64, 0.36, -1.82],
    stagger: [0.12, 0.9],
    anchorLocal: [1.22, 2.7, -0.22],
    calloutSide: 'right',
    focusCameraOffset: [3.4, 2.2, -3.8],
  },
  {
    id: 'battery',
    index: '06',
    fig: 'FIG. 06',
    nameZh: '激光焊接钢壳 L 型高密度电池',
    nameEn: 'STEEL-CASED L-SHAPED BATTERY',
    shortTag: '钢壳 L 型电池',
    calloutSpec: '3582 mAh · 13.94 Wh · LASER WELDED',
    category: 'ENERGY STORAGE',
    material: '激光焊接不锈钢壳体 / 高压锂离子电芯',
    dimensions: '79.4 × 46.8 × 4.9 mm',
    mass: '49.2 g',
    summary:
      '首次采用精密激光焊接不锈钢金属外壳封装，提升电芯能量密度、机械抗穿刺能力与向钛铝中框的热扩散效率，并配备电释胶易拆结构。',
    specs: [
      { label: '额定容量', value: '3582 mAh / 13.94 Wh' },
      { label: '封装工艺', value: '激光封焊不锈钢硬壳' },
      { label: '拆解设计', value: '低压直流电释粘合剂技术' },
      { label: '形态拓扑', value: '非对称 L 型空间填充' },
    ],
    subcomponents: [
      '不锈钢金属封装电芯',
      'BMS 智能电池管理保护板',
      '双通道电流采样排线',
      '电释胶固定贴片',
    ],
    explodeOffset: [-0.52, -0.1, 1.62],
    stagger: [0.16, 0.94],
    anchorLocal: [-1.1, 0.65, 0.14],
    calloutSide: 'left',
    focusCameraOffset: [-3.6, 0.4, 3.8],
  },
  {
    id: 'taptic-engine',
    index: '07',
    fig: 'FIG. 07',
    nameZh: 'Taptic Engine 线性触感引擎',
    nameEn: 'TAPTIC ENGINE LINEAR ACTUATOR',
    shortTag: 'Taptic 触感引擎',
    calloutSpec: 'LRA <10ms · TUNGSTEN MASS · COIL',
    category: 'HAPTICS / ELECTROMECHANICAL',
    material: 'CNC 金属腔体 / 钨钢配重块 / 铜漆包线圈',
    dimensions: '26.4 × 9.8 × 3.8 mm',
    mass: '7.4 g',
    summary:
      '高精度横向线性谐振执行器，通过中心电磁线圈驱动高密度钨钢质量块在双侧弹性簧片间微米级往复运动，可在 10ms 内起停产生清脆触觉反馈。',
    specs: [
      { label: '响应时间', value: '< 10 ms 瞬态启停' },
      { label: '驱动方式', value: '横向电磁线性谐振 (LRA)' },
      { label: '配重材料', value: '高比重烧结钨合金' },
    ],
    subcomponents: [
      '钨钢振荡质量块',
      '多层扁平铜电磁线圈',
      '双侧微米级不锈钢簧片',
      '钕铁硼永磁定子阵列',
    ],
    explodeOffset: [0.54, -0.68, 2.02],
    stagger: [0.22, 0.98],
    anchorLocal: [1.05, -2.76, 0.14],
    calloutSide: 'right',
    focusCameraOffset: [2.8, -2.0, 3.4],
  },
  {
    id: 'bottom-io',
    index: '08',
    fig: 'FIG. 08',
    nameZh: '底部立体声扬声器与 USB-C 总成',
    nameEn: 'ACOUSTIC SPEAKER & USB-C PORT',
    shortTag: '扬声器与 USB-C',
    calloutSpec: 'USB 3.2 10Gbps · 24-PIN · ACOUSTIC',
    category: 'ACOUSTICS / I/O INTERFACE',
    material: '声学共鸣腔 / 不锈钢 USB-C 屏蔽壳',
    dimensions: '31.5 × 12.2 × 4.1 mm',
    mass: '6.8 g',
    summary:
      '左侧集成精密调谐的低频增强声学共鸣腔扬声器，中央为支持 USB 3 (10Gb/s) 与 DisplayPort 视频输出的 24-pin USB-C 高速接口总成。',
    specs: [
      { label: '传输协议', value: 'USB 3.2 Gen 2 (10 Gbps)' },
      { label: '声学设计', value: '微球填充等效扩腔技术' },
      { label: '接口防护', value: '硅胶 O 型防水密封圈' },
    ],
    subcomponents: [
      '底部微型全频扬声器腔体',
      '24-Pin USB-C 金属母座',
      '气压平衡透声膜',
      '主麦克风降噪采集单元',
    ],
    explodeOffset: [-0.48, -0.68, 2.02],
    stagger: [0.22, 0.98],
    anchorLocal: [-1.06, -2.84, 0.14],
    calloutSide: 'left',
    focusCameraOffset: [-2.8, -2.0, 3.5],
  },
  {
    id: 'magsafe-coil',
    index: '09',
    fig: 'FIG. 09',
    nameZh: 'MagSafe 磁吸环与 Qi2 充电线圈',
    nameEn: 'MAGSAFE ARRAY & QI2 COIL',
    shortTag: 'MagSafe 与 Qi2 线圈',
    calloutSpec: '18× N52 MAGNETS · 11-TURN COIL · 25W',
    category: 'INDUCTIVE POWER / MAGNETICS',
    material: '18 块钕铁硼磁体 / 纳米晶磁屏蔽片 / 纯铜绕组',
    dimensions: 'Ø 54.0 × 0.85 mm',
    mass: '9.6 g',
    summary:
      '18 块精密扇形钕磁铁构成的高精度磁吸定位圆环与底部防旋转定位磁条，中央嵌套支持 25W 高速无线充电的多匝螺旋铜线圈与 NFC 感应天线。',
    specs: [
      { label: '无线功率', value: '最高 25W MagSafe / 15W Qi2' },
      { label: '磁体阵列', value: '18 块径向扇形 N52 钕磁铁 + 1 对齐条' },
      { label: '线圈工艺', value: '多层扁平利兹线同心螺旋绕组' },
      { label: '集成天线', value: 'NFC 近场读写环 + 磁力计屏蔽层' },
    ],
    subcomponents: [
      '18 单元环形钕磁铁阵列',
      '底部垂直防旋对齐磁条',
      'Qi2 / MagSafe 同心螺旋铜线圈',
      '铁氧体导磁屏蔽背衬膜',
    ],
    explodeOffset: [0, -0.05, -3.05],
    stagger: [0.1, 0.88],
    anchorLocal: [-1.28, -0.32, -0.14],
    calloutSide: 'left',
    focusCameraOffset: [-3.2, 0.8, -5.0],
  },
  {
    id: 'rear-glass',
    index: '10',
    fig: 'FIG. 10',
    nameZh: '亚光质感背板玻璃与相机岛台',
    nameEn: 'TEXTURED MATTE REAR GLASS',
    shortTag: '亚光背板与岛台',
    calloutSpec: 'CNC MILLED GLASS · TRIPLE TRIM RING',
    category: 'EXTERIOR ENCLOSURE',
    material: '整块 CNC 铣削双离子交换融色玻璃',
    dimensions: '149.6 × 71.5 × 0.95 mm',
    mass: '26.2 g',
    summary:
      '由整片加厚特种强化玻璃经精密 CNC 轮廓铣削与酸蚀亚光工艺一体成型，左上角无缝隆起阶梯式相机平台，内置三层精密镜圈倒角开孔。',
    specs: [
      { label: '成型工艺', value: '单片玻璃 CNC 立体铣削岛台' },
      { label: '表面处理', value: '微米级哑光喷砂酸蚀纹理' },
      { label: '维修结构', value: '可独立开启式背板架构' },
    ],
    subcomponents: [
      '一体成型强化亚光背板',
      '阶梯式方形镜头岛台',
      '三摄精密不锈钢装饰环',
      '背板防水密封胶框',
    ],
    explodeOffset: [0, -0.08, -5.15],
    stagger: [0.02, 0.8],
    anchorLocal: [-1.52, -2.05, -0.22],
    calloutSide: 'left',
    focusCameraOffset: [-3.4, -0.8, -5.4],
  },
  {
    id: 'fasteners',
    index: '11',
    fig: 'FIG. 11',
    nameZh: '精密微紧固件与密封压板组',
    nameEn: 'MICRO-FASTENERS & IP68 GASKET',
    shortTag: '微螺钉与 IP68 密封',
    calloutSpec: '2× P2 PENTALOBE · Y000 · ELASTOMER',
    category: 'MECHANICAL HARDWARE',
    material: '高强度不锈钢微螺钉 / 激光冲压压板',
    dimensions: 'M1.1 – M1.4 精密公制微螺纹',
    mass: '1.9 g',
    summary:
      '遍布机身内部的防松动微紧固系统，包含底部标志性两枚五叶梅花螺钉（Pentalobe）、主板排线防脱金属压板及四周 IP68 防水弹性密封圈。',
    specs: [
      { label: '底部螺钉', value: '2 × P2 Pentalobe 五星防拆螺钉' },
      { label: '内部紧固', value: 'Y000 三翼微螺钉与十字支架钉' },
      { label: '密封结构', value: '闭环压敏微孔防水密封胶框' },
    ],
    subcomponents: [
      '底部双枚 Pentalobe 钛色螺钉',
      '排线锁紧不锈钢压板',
      '四角微米级定位销与衬套',
      'IP68 周圈弹性密封框',
    ],
    explodeOffset: [0, 0, 0],
    stagger: [0.25, 1.0],
    anchorLocal: [0.55, -4.65, 0.55],
    calloutSide: 'right',
    focusCameraOffset: [3.4, -2.6, 4.4],
  },
];

/**
 * Secondary hyper-detailed technical patent micro-callouts (A–L).
 * These bloom out when exploded > 52% or when inspecting their parent module,
 * creating an ultra-rich museum patent drafting density!
 */
export const MICRO_CALLOUTS: MicroCalloutMeta[] = [
  {
    id: 'mc-island',
    parentPartId: 'ceramic-display',
    code: 'A1',
    titleZh: '灵动岛双开孔与微缝听筒',
    titleEn: 'DYNAMIC ISLAND & EARPIECE SLIT',
    detail: 'PILL CUTOUT · 21.4 × 6.2 mm',
    localPos: [-0.42, 3.16, 0.25],
    side: 'left',
  },
  {
    id: 'mc-cof',
    parentPartId: 'ceramic-display',
    code: 'A2',
    titleZh: '显示驱动柔性排线 (COF)',
    titleEn: 'OLED DISPLAY DRIVER FLEX',
    detail: '120Hz LTPO BUS',
    localPos: [-0.95, -2.55, 0.16],
    side: 'left',
  },
  {
    id: 'mc-action',
    parentPartId: 'titanium-frame',
    code: 'B1',
    titleZh: '操作按钮与音量键组',
    titleEn: 'ACTION & VOLUME SWITCHES',
    detail: 'CNC TI-6AL-4V CAPS',
    localPos: [-1.84, 2.12, 0.0],
    side: 'left',
  },
  {
    id: 'mc-camctrl',
    parentPartId: 'titanium-frame',
    code: 'B2',
    titleZh: '蓝宝石电容式相机控制键',
    titleEn: 'SAPPHIRE CAMERA CONTROL',
    detail: 'FORCE + CAPACITIVE SLIDE',
    localPos: [1.82, -1.28, 0.0],
    side: 'right',
  },
  {
    id: 'mc-a18',
    parentPartId: 'logic-board',
    code: 'C1',
    titleZh: 'A18 Pro 芯片封装核心',
    titleEn: 'A18 PRO SILICON DIE',
    detail: '6C CPU · 6C GPU · N3E 3NM',
    localPos: [0.84, 0.24, 0.17],
    side: 'right',
  },
  {
    id: 'mc-nand',
    parentPartId: 'logic-board',
    code: 'C2',
    titleZh: 'NVMe 闪存与 5G 射频屏蔽罩',
    titleEn: 'NAND FLASH & RF EMI SHIELD',
    detail: 'DUAL-STACK HDI PCB',
    localPos: [0.88, 0.98, 0.16],
    side: 'right',
  },
  {
    id: 'mc-lens-stack',
    parentPartId: 'camera-system',
    code: 'D1',
    titleZh: '48MP 主摄展开镜片组',
    titleEn: 'MULTI-ELEMENT OPTICAL STACK',
    detail: '7P ASPHERIC · 2ND-GEN OIS',
    localPos: [1.12, 2.7, -0.22],
    subExplodeDelta: [0, 0, -1.05],
    side: 'right',
  },
  {
    id: 'mc-tetraprism',
    parentPartId: 'camera-system',
    code: 'D2',
    titleZh: '5× 四重反射折叠棱镜腔',
    titleEn: '5× TETRAPRISM FOLDED OPTICS',
    detail: '120MM EQUIV · 4× BOUNCE',
    localPos: [0.44, 2.1, 0.05],
    side: 'left',
  },
  {
    id: 'mc-lidar',
    parentPartId: 'camera-system',
    code: 'D3',
    titleZh: 'LiDAR 激光雷达与原彩闪光灯',
    titleEn: 'dToF LiDAR & FRESNEL FLASH',
    detail: 'SPATIAL DEPTH MAP',
    localPos: [0.44, 1.82, -0.18],
    side: 'right',
  },
  {
    id: 'mc-bms',
    parentPartId: 'battery',
    code: 'E1',
    titleZh: '激光封焊不锈钢壳与 BMS 板',
    titleEn: 'LASER-WELDED CELL & BMS',
    detail: 'ELECTRIC-RELEASE ADHESIVE',
    localPos: [0.05, -0.65, 0.14],
    side: 'left',
  },
  {
    id: 'mc-usbc',
    parentPartId: 'bottom-io',
    code: 'F1',
    titleZh: '24-Pin USB-C 金属母座',
    titleEn: 'USB-C 3.2 RECEPTACLE',
    detail: '10Gbps + DISPLAYPORT',
    localPos: [0, -3.42, 0.04],
    side: 'left',
  },
  {
    id: 'mc-qi2',
    parentPartId: 'magsafe-coil',
    code: 'G1',
    titleZh: '11 匝 Qi2 螺旋铜线圈与对齐磁条',
    titleEn: 'QI2 LITZ COIL & ALIGN BAR',
    detail: 'Ø 54.0 mm · 25W INDUCTIVE',
    localPos: [0.0, -2.04, -0.14],
    side: 'right',
  },
  {
    id: 'mc-gasket',
    parentPartId: 'fasteners',
    code: 'H1',
    titleZh: 'IP68 周圈防水弹性密封框',
    titleEn: 'PERIMETER IP68 SEAL GASKET',
    detail: 'PRESSURE-SENSITIVE SEAL',
    localPos: [-1.62, -1.65, 0.18],
    subExplodeDelta: [0, 0.04, 3.85],
    side: 'left',
  },
];

export const PART_MAP = new Map<string, IphonePartMeta>(
  IPHONE_PARTS.map((p) => [p.id, p])
);
