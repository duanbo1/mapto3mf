export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface BasicConfig {
  // 基础渲染配置
  renderHeight: number;           // 3D渲染高度缩放
  baseColor: string;             // 基础颜色
  showLabels: boolean;           // 是否显示地图标签
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
    projection: 'mercator' | 'geographic';
    centerPoint: [number, number];
    scale: number;
  };
}

export interface ModelConfig {
  roads: {
    enabled: boolean;
    height: number;
    width: number;
    color: string;
    types: {
      motorway: { width: number; color: string; height: number; };
      trunk: { width: number; color: string; height: number; };
      primary: { width: number; color: string; height: number; };
      secondary: { width: number; color: string; height: number; };
      residential: { width: number; color: string; height: number; };
      footway: { width: number; color: string; height: number; };
    };
  };
  bridges: {
    enabled: boolean;
    height: number;
    width: number;
    color: string;
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
    color: string;
    roofConfig: {
      enabled: boolean;
      type: 'flat' | 'pitched' | 'dome';
      color: string;
    };
    windowConfig: {
      enabled: boolean;
      color: string;
      spacing: number;
    };
  };
  terrain: {
    enabled: boolean;
    baseHeight: number;
    elevationScale: number;
    color: string;
    textureConfig: {
      enabled: boolean;
      type: 'grass' | 'concrete' | 'dirt';
      scale: number;
    };
  };
  vegetation: {
    enabled: boolean;
    height: number;
    density: number;
    color: string;
    treeConfig: {
      enabled: boolean;
      types: string[];
      randomness: number;
    };
  };
  water: {
    enabled: boolean;
    height: number;
    color: string;
    waveConfig: {
      enabled: boolean;
      amplitude: number;
      frequency: number;
    };
  };
}

export interface OSMElement {
  type: 'node' | 'way' | 'relation';
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