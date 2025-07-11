import { BasicConfig, ModelConfig } from "../types";

export const initialBasicConfig: BasicConfig = {
  renderHeight: 1.0,
  baseColor: "#68d391",
  showLabels: true,
  labelConfig: {
    enabled: true,
    fontSize: 12,
    color: "#ffffff",
    fontFamily: "Arial",
  },
  tileConfig: {
    maxZoom: 18,
    minZoom: 10,
    tileSize: 256,
  },
  coordinateSystem: {
    projection: "mercator",
    centerPoint: [0, 0],
    scale: 1.0,
  },
};

export const initialModelConfig: ModelConfig = {
  global: {
    mapSize: 1000,
    baseLayer: "terrain",
    baseColor: "#68d391",
    scale: 1.0,
    lightingIntensity: 1.0,
  },
  roads: {
    enabled: true,
    height: 0.2,
    width: 4,
    color: "#4a5568",
    scale: 1.0,
    minWidth: 0.5,
    textureType: "asphalt",
    types: {
      motorway: { width: 12, color: "#2d3748", height: 0.3 },
      trunk: { width: 10, color: "#4a5568", height: 0.25 },
      primary: { width: 8, color: "#718096", height: 0.2 },
      secondary: { width: 6, color: "#a0aec0", height: 0.15 },
      residential: { width: 4, color: "#cbd5e0", height: 0.1 },
      footway: { width: 1.5, color: "#e2e8f0", height: 0.05 },
    },
  },
  bridges: {
    enabled: true,
    height: 1.5,
    width: 6,
    color: "#718096",
    scale: 1.0,
    pillarConfig: {
      enabled: true,
      radius: 0.5,
      color: "#8B7355",
      spacing: 20,
    },
  },
  buildings: {
    enabled: true,
    baseHeight: 3,
    maxHeight: 50,
    color: "#cbd5e0",
    minHeight: 2.0,
    scale: 1.0,
    ignoreSmallArea: 10.0,
    detailLevel: "medium",
    materialConfig: {
      roughness: 0.8,
      metalness: 0.1,
      shininess: 30,
    },
    roofConfig: {
      enabled: true,
      type: "flat",
      color: "#a0aec0",
    },
    windowConfig: {
      enabled: true,
      color: "#4299e1",
      spacing: 2,
    },
  },
  terrain: {
    enabled: true,
    baseHeight: 2,
    elevationScale: 1,
    color: "#68d391",
    scale: 1.0,
    textureConfig: {
      enabled: true,
      type: "grass",
      scale: 1,
    },
  },
  vegetation: {
    enabled: true,
    height: 1.5,
    density: 1,
    color: "#48bb78",
    scale: 1.0,
    minArea: 5.0,
    treeDensity: 0.3,
    textureType: "grass",
    treeConfig: {
      enabled: true,
      types: ["oak", "pine", "birch"],
      randomness: 0.5,
    },
  },
  water: {
    enabled: true,
    height: 0.1,
    color: "#4299e1",
    scale: 1.0,
    waveConfig: {
      enabled: true,
      amplitude: 0.1,
      frequency: 1,
    },
  },
};
