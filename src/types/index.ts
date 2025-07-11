export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface BasicConfig {
  // 基础渲染配置
  renderHeight: number; // 3D渲染高度缩放
  baseColor: string; // 基础颜色
  showLabels: boolean; // 是否显示地图标签
  labelConfig: {
    enabled: boolean;
    fontSize: number;
    color: string;
    fontFamily: string;
  };
  // 切片配置
  tileConfig: {
    maxZoom: number;
    minZoom: number;
    tileSize: number;
  };
  // 坐标系统配置
  coordinateSystem: {
    projection: "mercator" | "geographic";
    centerPoint: [number, number];
    scale: number;
  };
}

export interface ModelConfig {
  // 全局配置
  global: {
    mapSize: number; // 地图尺寸缩放
    baseLayer: string; // 基础图层类型
    baseColor: string; // 基础颜色
    scale: number; // 全局缩放比例
    lightingIntensity: number; // 光照强度
  };
  roads: {
    enabled: boolean;
    height: number;
    width: number;
    color: string;
    scale: number; // 道路缩放比例
    minWidth: number; // 最小宽度
    texture: {
      enabled: boolean;
      type: "asphalt" | "concrete" | "gravel";
      scale: number;
    };
    types: {
      motorway: { width: number; color: string; height: number };
      trunk: { width: number; color: string; height: number };
      primary: { width: number; color: string; height: number };
      secondary: { width: number; color: string; height: number };
      residential: { width: number; color: string; height: number };
      footway: { width: number; color: string; height: number };
    };
  };
  bridges: {
    enabled: boolean;
    height: number;
    width: number;
    color: string;
    scale: number;
    pillarConfig: {
      enabled: boolean;
      radius: number;
      color: string;
      spacing: number;
    };
  };
  buildings: {
    enabled: boolean;
    baseHeight: number;
    maxHeight: number;
    minHeight: number; // 最小建筑高度
    color: string;
    scale: number; // 建筑缩放比例
    ignoreSmaller: number; // 忽略小于此面积的建筑
    detailLevel: "low" | "medium" | "high"; // 细节等级
    roofConfig: {
      enabled: boolean;
      type: "flat" | "pitched" | "dome";
      color: string;
    };
    windowConfig: {
      enabled: boolean;
      color: string;
      spacing: number;
    };
    materialConfig: {
      roughness: number;
      metalness: number;
      shininess: number;
    };
  };
  terrain: {
    enabled: boolean;
    baseHeight: number;
    elevationScale: number;
    color: string;
    scale: number;
    textureConfig: {
      enabled: boolean;
      type: "grass" | "concrete" | "dirt";
      scale: number;
    };
  };
  vegetation: {
    enabled: boolean;
    height: number;
    density: number;
    color: string;
    scale: number; // 植被缩放比例
    minArea: number; // 最小植被区域面积
    treeConfig: {
      enabled: boolean;
      types: string[];
      randomness: number;
      density: number;
    };
    textureConfig: {
      enabled: boolean;
      type: "grass" | "forest" | "park";
      scale: number;
    };
  };
  water: {
    enabled: boolean;
    height: number;
    scale: number;
    color: string;
    waveConfig: {
      enabled: boolean;
      amplitude: number;
      frequency: number;
    };
  };
}

export interface OSMElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

export interface OSMData {
  elements: OSMElement[];
}

export interface Model3D {
  id: string;
  type: string;
  geometry: any;
  material: any;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}
