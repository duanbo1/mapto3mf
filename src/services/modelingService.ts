import * as THREE from "three";
import {
  OSMData,
  OSMElement,
  ModelConfig,
  BasicConfig,
  BoundingBox,
  Model3D,
} from "../types";

/**
 * 3D建模服务类
 * 负责根据OSM数据生成3D模型，确保模型完整闭合、贴地、不悬空
 */
export class ModelingService {
  private scene: THREE.Scene;
  private models: Model3D[] = [];
  private centerPoint: [number, number] = [0, 0];
  private scale: number = 1;
  private selectedBBox: BoundingBox | null = null;
  private selectedArea?: any; // 选择区域信息
  private terrainHeight: number = 0;
  private modelStats = {
    buildings: 0,
    roads: 0,
    bridges: 0,
    water: 0,
    vegetation: 0,
    totalVertices: 0,
    totalTriangles: 0,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * 应用全局配置缩放
   */
  private applyGlobalScale(value: number, config: ModelConfig): number {
    const globalScale = config.global?.scale || 1;
    return value * globalScale;
  }

  /**
   * 检查建筑是否应该被忽略
   */
  private shouldIgnoreBuilding(
    element: OSMElement,
    config: ModelConfig
  ): boolean {
    if (!element.geometry || element.geometry.length < 3) return true;

    // 计算建筑面积
    const area = this.calculatePolygonArea(element.geometry);
    const minArea = config.buildings.ignoreSmaller || 10;

    return area < minArea;
  }

  /**
   * 计算多边形面积（平方米）
   */
  private calculatePolygonArea(
    points: Array<{ lat: number; lon: number }>
  ): number {
    if (points.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].lat * points[j].lon;
      area -= points[j].lat * points[i].lon;
    }
    return (Math.abs(area) / 2) * 111000 * 111000; // 转换为平方米（近似）
  }

  /**
   * 获取模型统计信息
   */
  getModelStats() {
    return { ...this.modelStats };
  }

  async generateModels(
    osmData: OSMData,
    basicConfig: BasicConfig,
    modelConfig: ModelConfig,
    bbox: BoundingBox,
    selectedArea?: any
  ): Promise<Model3D[]> {
    this.clearModels();

    // 设置坐标系统和选择区域
    this.centerPoint = basicConfig.coordinateSystem.centerPoint;
    this.scale = basicConfig.coordinateSystem.scale * basicConfig.renderHeight;
    this.selectedBBox = bbox;
    this.selectedArea = selectedArea; // 保存选择区域信息
    this.terrainHeight =
      this.applyGlobalScale(modelConfig.terrain.baseHeight, modelConfig) *
      this.scale;

    // 首先生成底盘平台
    this.generateBasePlatform(bbox, basicConfig, modelConfig);

    // 处理OSM元素，只渲染在选择区域内的元素
    osmData.elements.forEach((element) => {
      if (this.isElementInBounds(element, bbox)) {
        this.processElement(element, basicConfig, modelConfig, bbox);
      }
    });

    return this.models;
  }

  /**
   * 改进的边界检测算法
   * 支持点、线段和多边形的精确相交检测
   */
  private isElementInBounds(element: OSMElement, bbox: BoundingBox): boolean {
    if (!element.geometry || element.geometry.length === 0) return false;

    const geometry = element.geometry;

    // 快速边界框检测
    const elementBounds = this.getElementBounds(geometry);
    if (!this.boundsIntersect(elementBounds, bbox)) {
      return false;
    }

    // 检查是否有点在区域内
    for (const point of geometry) {
      if (this.isPointInBounds(point, bbox)) {
        return true;
      }
    }

    // 对于线段和多边形，检查边是否与边界相交
    if (geometry.length > 1) {
      for (let i = 0; i < geometry.length - 1; i++) {
        if (this.lineIntersectsBounds(geometry[i], geometry[i + 1], bbox)) {
          return true;
        }
      }

      // 对于闭合多边形，检查最后一条边
      if (geometry.length > 2 && element.tags?.area !== "no") {
        if (
          this.lineIntersectsBounds(
            geometry[geometry.length - 1],
            geometry[0],
            bbox
          )
        ) {
          return true;
        }
      }
    }

    // 检查边界框是否完全包含在元素内（对于大型多边形）
    if (geometry.length > 2 && element.tags?.area !== "no") {
      return this.isPolygonContainsBounds(geometry, bbox);
    }

    return false;
  }

  /**
   * 获取元素的边界框
   */
  private getElementBounds(
    geometry: { lat: number; lon: number }[]
  ): BoundingBox {
    let minLat = Infinity,
      maxLat = -Infinity;
    let minLon = Infinity,
      maxLon = -Infinity;

    for (const point of geometry) {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLon = Math.min(minLon, point.lon);
      maxLon = Math.max(maxLon, point.lon);
    }

    return {
      north: maxLat,
      south: minLat,
      east: maxLon,
      west: minLon,
    };
  }

  /**
   * 检查两个边界框是否相交
   */
  private boundsIntersect(bounds1: BoundingBox, bounds2: BoundingBox): boolean {
    return !(
      bounds1.east < bounds2.west ||
      bounds1.west > bounds2.east ||
      bounds1.north < bounds2.south ||
      bounds1.south > bounds2.north
    );
  }

  /**
   * 检查点是否在边界内
   */
  private isPointInBounds(
    point: { lat: number; lon: number },
    bbox: BoundingBox
  ): boolean {
    return (
      point.lat >= bbox.south &&
      point.lat <= bbox.north &&
      point.lon >= bbox.west &&
      point.lon <= bbox.east
    );
  }

  /**
   * 检查多边形是否包含边界框
   */
  private isPolygonContainsBounds(
    polygon: { lat: number; lon: number }[],
    bbox: BoundingBox
  ): boolean {
    // 检查边界框的四个角点是否都在多边形内
    const corners = [
      { lat: bbox.north, lon: bbox.west },
      { lat: bbox.north, lon: bbox.east },
      { lat: bbox.south, lon: bbox.east },
      { lat: bbox.south, lon: bbox.west },
    ];

    return corners.every((corner) => this.isPointInPolygon(corner, polygon));
  }

  /**
   * 使用射线投射算法检查点是否在多边形内
   */
  private isPointInPolygon(
    point: { lat: number; lon: number },
    polygon: { lat: number; lon: number }[]
  ): boolean {
    let inside = false;
    const x = point.lon,
      y = point.lat;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lon,
        yi = polygon[i].lat;
      const xj = polygon[j].lon,
        yj = polygon[j].lat;

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }

    return inside;
  }

  private lineIntersectsBounds(
    p1: { lat: number; lon: number },
    p2: { lat: number; lon: number },
    bbox: BoundingBox
  ): boolean {
    // 简化的线段与矩形相交检测
    const minLat = Math.min(p1.lat, p2.lat);
    const maxLat = Math.max(p1.lat, p2.lat);
    const minLon = Math.min(p1.lon, p2.lon);
    const maxLon = Math.max(p1.lon, p2.lon);

    return !(
      maxLat < bbox.south ||
      minLat > bbox.north ||
      maxLon < bbox.west ||
      minLon > bbox.east
    );
  }

  private generateBasePlatform(
    bbox: BoundingBox,
    basicConfig: BasicConfig,
    modelConfig: ModelConfig
  ): void {
    if (!modelConfig.terrain.enabled) return;

    // 计算实际地理距离并转换为模型尺寸
    const width = this.calculateDistance(
      bbox.west,
      bbox.south,
      bbox.east,
      bbox.south
    );
    const depth = this.calculateDistance(
      bbox.west,
      bbox.south,
      bbox.west,
      bbox.north
    );
    const platformHeight = modelConfig.terrain.baseHeight;

    console.log("底盘尺寸:", {
      width: width.toFixed(2),
      depth: depth.toFixed(2),
      height: platformHeight,
    });

    // 创建地形基础
    let geometry: THREE.BufferGeometry;

    const aspectRatio = width / depth;
    if (Math.abs(aspectRatio - 1) < 0.1) {
      // 接近正方形，创建圆角矩形
      geometry = this.createRoundedBoxGeometry(
        width,
        platformHeight,
        depth,
        Math.min(width, depth) * 0.05
      );
    } else {
      // 普通矩形
      geometry = new THREE.BoxGeometry(width, platformHeight, depth);
    }

    // 底盘使用独立的颜色配置
    const material = new THREE.MeshPhongMaterial({
      color: modelConfig.terrain.color || basicConfig.baseColor,
      shininess: 20,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });

    // 添加边缘高光
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.3,
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);

    const platform = new THREE.Mesh(geometry, material);
    // 底盘底部在y=0，顶部在y=platformHeight
    platform.position.set(0, platformHeight / 2, 0);
    platform.receiveShadow = true;
    platform.add(wireframe);

    this.scene.add(platform);

    // 更新地形高度基准 - 底盘顶部的y坐标
    this.terrainHeight = platformHeight;

    this.models.push({
      id: "base-platform",
      type: "terrain",
      geometry: this.createExportableGeometry(geometry, platform.position),
      material,
      position: [0, platformHeight / 2, 0],
    });

    console.log("底盘生成完成，地形高度基准(底盘顶部):", this.terrainHeight);
  }

  private createRoundedBoxGeometry(
    width: number,
    height: number,
    depth: number,
    radius: number
  ): THREE.BufferGeometry {
    // 创建圆角矩形几何体的简化版本
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -depth / 2;
    const w = width;
    const h = depth;
    const r = Math.min(radius, Math.min(w, h) / 2);

    shape.moveTo(x, y + r);
    shape.lineTo(x, y + h - r);
    shape.quadraticCurveTo(x, y + h, x + r, y + h);
    shape.lineTo(x + w - r, y + h);
    shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    shape.lineTo(x + w, y + r);
    shape.quadraticCurveTo(x + w, y, x + w - r, y);
    shape.lineTo(x + r, y);
    shape.quadraticCurveTo(x, y, x, y + r);

    const extrudeSettings = {
      depth: height,
      bevelEnabled: false,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }

  /**
   * 处理OSM元素，根据标签创建相应的3D模型
   * 确保模型完整闭合、贴地、不悬空
   */
  private processElement(
    element: OSMElement,
    basicConfig: BasicConfig,
    modelConfig: ModelConfig,
    bbox: BoundingBox
  ): void {
    if (!element.tags || !element.geometry) return;

    // 严格检查元素是否在选择区域内
    if (!this.isElementInBounds(element, bbox)) return;

    const tags = element.tags;
    let processed = false;

    try {
      // 处理建筑 - 确保建筑贴地且闭合
      if (tags.building && modelConfig.buildings.enabled) {
        if (!this.shouldIgnoreBuilding(element, modelConfig)) {
          this.createBuilding(element, basicConfig, modelConfig, bbox);
          this.modelStats.buildings++;
          processed = true;
        }
      }
      // 处理道路 - 确保道路贴地连续
      else if (tags.highway && modelConfig.roads.enabled) {
        this.createRoad(element, basicConfig, modelConfig, bbox);
        this.modelStats.roads++;
        processed = true;
      }
      // 处理桥梁 - 确保桥梁支撑结构完整
      else if (tags.bridge === "yes" && modelConfig.bridges.enabled) {
        this.createBridge(element, basicConfig, modelConfig, bbox);
        this.modelStats.bridges++;
        processed = true;
      }
      // 处理水体 - 确保水面平整贴地
      else if (
        (tags.waterway || tags.natural === "water") &&
        modelConfig.water.enabled
      ) {
        this.createWater(element, basicConfig, modelConfig, bbox);
        this.modelStats.water++;
        processed = true;
      }
      // 处理植被 - 确保植被贴地分布
      else if (
        (tags.landuse === "grass" ||
          tags.landuse === "forest" ||
          tags.natural === "wood" ||
          tags.leisure === "park") &&
        modelConfig.vegetation.enabled
      ) {
        this.createVegetation(element, basicConfig, modelConfig, bbox);
        this.modelStats.vegetation++;
        processed = true;
      }

      if (processed) {
        console.log(`已处理元素 ${element.id}:`, {
          type: this.getElementType(tags),
          tags: Object.keys(tags).join(", "),
          geometryPoints: element.geometry.length,
        });
      }
    } catch (error) {
      console.error(`处理元素 ${element.id} 时出错:`, error);
    }
  }

  /**
   * 获取元素类型用于日志记录
   */
  private getElementType(tags: any): string {
    if (tags.building) return "building";
    if (tags.highway) return "road";
    if (tags.bridge === "yes") return "bridge";
    if (tags.waterway || tags.natural === "water") return "water";
    if (
      tags.landuse === "grass" ||
      tags.landuse === "forest" ||
      tags.natural === "wood" ||
      tags.leisure === "park"
    )
      return "vegetation";
    return "unknown";
  }

  private clipGeometryToBounds(
    points: { x: number; z: number }[],
    bbox: BoundingBox
  ): { x: number; z: number }[] {
    // 这个方法不再需要，因为我们在处理元素时就已经过滤了
    return points;
  }

  private createBuilding(
    element: OSMElement,
    basicConfig: BasicConfig,
    modelConfig: ModelConfig,
    bbox: BoundingBox
  ): void {
    if (!element.geometry || element.geometry.length < 3) return;

    // 只处理在边界内的点
    let points = element.geometry
      .filter(
        (point) =>
          point.lat >= bbox.south &&
          point.lat <= bbox.north &&
          point.lon >= bbox.west &&
          point.lon <= bbox.east
      )
      .map((point) => this.latLonToLocal(point.lat, point.lon, bbox));

    if (points.length < 3) return;

    // 创建建筑轮廓
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].z);

    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].z);
    }

    // 确定建筑高度
    const levels = parseInt(element.tags?.levels || "3");
    const buildingHeight = element.tags?.height
      ? parseFloat(element.tags.height)
      : null;
    const baseHeight = this.applyGlobalScale(
      modelConfig.buildings.baseHeight,
      modelConfig
    );
    const minHeight = this.applyGlobalScale(
      modelConfig.buildings.minHeight || 3,
      modelConfig
    );
    const height =
      (buildingHeight ||
        Math.max(baseHeight, Math.max(minHeight, levels * 3))) * this.scale;

    // 改进的挤出设置，减少斜角以获得更清晰的边缘
    const extrudeSettings = {
      depth: height,
      bevelEnabled: true,
      bevelThickness: 0.05 * this.scale,
      bevelSize: 0.05 * this.scale,
      bevelOffset: 0,
      bevelSegments: 1,
    };

    try {
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

      // 计算UV坐标以支持纹理
      this.computeBuildingUVs(geometry, height);

      // 根据建筑类型选择材质
      const buildingType = this.getBuildingType(element.tags);
      const material = this.createBuildingMaterial(
        buildingType,
        modelConfig.buildings.color
      );

      const building = new THREE.Mesh(geometry, material);
      building.rotation.x = -Math.PI / 2;
      // 建筑底部直接贴在底盘顶部，确保一体化
      building.position.y = this.terrainHeight;
      building.castShadow = true;
      building.receiveShadow = true;

      // 添加细节边缘线条
      this.addBuildingEdges(building, geometry);

      // 添加屋顶
      if (modelConfig.buildings.roofConfig.enabled) {
        this.addRoof(building, shape, height, modelConfig.buildings.roofConfig);
      }

      // 添加窗户
      if (modelConfig.buildings.windowConfig.enabled) {
        this.addWindows(
          building,
          geometry,
          modelConfig.buildings.windowConfig,
          height
        );
      }

      // 添加建筑细节
      this.addBuildingDetails(building, shape, height, buildingType);

      this.scene.add(building);
      this.modelStats.buildings++;
      this.modelStats.totalVertices += geometry.attributes.position.count;
      this.modelStats.totalTriangles += geometry.index
        ? geometry.index.count / 3
        : geometry.attributes.position.count / 3;

      this.models.push({
        id: `building-${element.id}`,
        type: "building",
        geometry: this.createExportableGeometry(geometry, building.position),
        material,
        position: [
          building.position.x,
          building.position.y,
          building.position.z,
        ],
      });

      console.log(`建筑 ${element.id} 位置:`, {
        x: building.position.x,
        y: building.position.y,
        z: building.position.z,
        terrainHeight: this.terrainHeight,
        buildingHeight: height,
      });
    } catch (error) {
      console.warn("创建建筑时出错:", error);
    }
  }

  private createRoad(
    element: OSMElement,
    basicConfig: BasicConfig,
    modelConfig: ModelConfig,
    bbox: BoundingBox
  ): void {
    if (!element.geometry || element.geometry.length < 2) return;

    // 只处理在边界内的点
    let points = element.geometry
      .filter(
        (point) =>
          point.lat >= bbox.south &&
          point.lat <= bbox.north &&
          point.lon >= bbox.west &&
          point.lon <= bbox.east
      )
      .map((point) => this.latLonToLocal(point.lat, point.lon, bbox));

    if (points.length < 2) return;

    // 根据道路类型调整参数
    const roadType = element.tags
      ?.highway as keyof typeof modelConfig.roads.types;
    const roadConfig = modelConfig.roads.types[roadType] || {
      width: this.applyGlobalScale(modelConfig.roads.width, modelConfig),
      color: modelConfig.roads.color,
      height: this.applyGlobalScale(modelConfig.roads.height, modelConfig),
    };

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];

      const distance = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2)
      );

      if (distance < 0.1) continue;

      // 创建道路段
      const geometry = new THREE.BoxGeometry(
        distance,
        roadConfig.height * this.scale,
        roadConfig.width * this.scale
      );

      // 改进的道路材质，更好的光照效果
      const material = new THREE.MeshPhongMaterial({
        color: roadConfig.color,
        transparent: true,
        opacity: 0.9,
        shininess: 10,
        specular: 0x222222,
        flatShading: false,
      });

      const road = new THREE.Mesh(geometry, material);

      // 道路直接贴在底盘顶部，确保一体化
      road.position.set(
        (start.x + end.x) / 2,
        this.terrainHeight,
        (start.z + end.z) / 2
      );

      const angle = Math.atan2(end.z - start.z, end.x - start.x);
      road.rotation.y = angle;
      road.receiveShadow = true;

      this.scene.add(road);

      this.models.push({
        id: `road-${element.id}-${i}`,
        type: "road",
        geometry: this.createExportableGeometry(geometry, road.position),
        material,
        position: [road.position.x, road.position.y, road.position.z],
        rotation: [0, angle, 0],
      });

      console.log(`道路段 ${element.id}-${i} 位置:`, {
        x: road.position.x,
        y: road.position.y,
        z: road.position.z,
        terrainHeight: this.terrainHeight,
        roadHeight: roadConfig.height * this.scale,
      });
    }
  }

  private createBridge(
    element: OSMElement,
    basicConfig: BasicConfig,
    modelConfig: ModelConfig,
    bbox: BoundingBox
  ): void {
    if (!element.geometry || element.geometry.length < 2) return;

    // 只处理在边界内的点
    const points = element.geometry
      .filter(
        (point) =>
          point.lat >= bbox.south &&
          point.lat <= bbox.north &&
          point.lon >= bbox.west &&
          point.lon <= bbox.east
      )
      .map((point) => this.latLonToLocal(point.lat, point.lon, bbox));

    if (points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];

      const distance = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2)
      );

      if (distance < 0.1) continue;

      // 桥梁主体
      const bridgeHeight = this.applyGlobalScale(
        modelConfig.bridges.height,
        modelConfig
      );
      const bridgeWidth = this.applyGlobalScale(
        modelConfig.bridges.width,
        modelConfig
      );
      const bridgeGeometry = new THREE.BoxGeometry(
        distance,
        bridgeHeight * this.scale,
        bridgeWidth * this.scale
      );
      const bridgeMaterial = new THREE.MeshPhongMaterial({
        color: modelConfig.bridges.color,
        shininess: 50,
      });

      const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);

      // 桥梁高于底盘，桥梁中心在底盘顶部 + 桥梁高度/2 + 额外高度
      bridge.position.set(
        (start.x + end.x) / 2,
        this.terrainHeight + (bridgeHeight * this.scale) / 2 + 2 * this.scale,
        (start.z + end.z) / 2
      );

      const angle = Math.atan2(end.z - start.z, end.x - start.x);
      bridge.rotation.y = angle;
      bridge.castShadow = true;
      bridge.receiveShadow = true;

      // 添加桥梁支柱
      if (modelConfig.bridges.pillarConfig.enabled) {
        this.addBridgePillars(
          bridge,
          start,
          end,
          modelConfig.bridges.pillarConfig,
          distance
        );
      }

      this.scene.add(bridge);

      this.models.push({
        id: `bridge-${element.id}-${i}`,
        type: "bridge",
        geometry: this.createExportableGeometry(
          bridgeGeometry,
          bridge.position
        ),
        material: bridgeMaterial,
        position: [bridge.position.x, bridge.position.y, bridge.position.z],
        rotation: [0, angle, 0],
      });

      console.log(`桥梁 ${element.id}-${i} 位置:`, {
        x: bridge.position.x,
        y: bridge.position.y,
        z: bridge.position.z,
        terrainHeight: this.terrainHeight,
      });
    }
  }

  private createWater(
    element: OSMElement,
    basicConfig: BasicConfig,
    modelConfig: ModelConfig,
    bbox: BoundingBox
  ): void {
    if (!element.geometry || element.geometry.length < 3) return;

    // 只处理在边界内的点
    let points = element.geometry
      .filter(
        (point) =>
          point.lat >= bbox.south &&
          point.lat <= bbox.north &&
          point.lon >= bbox.west &&
          point.lon <= bbox.east
      )
      .map((point) => this.latLonToLocal(point.lat, point.lon, bbox));

    if (points.length < 3) return;

    try {
      const shape = new THREE.Shape();
      shape.moveTo(points[0].x, points[0].z);

      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].z);
      }

      const geometry = new THREE.ShapeGeometry(shape);

      // 创建稳定的水面效果，减少闪烁
      const material = new THREE.MeshPhongMaterial({
        color: 0x2e86ab, // 更深的蓝色，与背景更协调
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
        shininess: 80,
        specular: 0x87ceeb,
        reflectivity: 0.3,
      });

      const water = new THREE.Mesh(geometry, material);
      water.rotation.x = -Math.PI / 2;
      // 水面直接贴在底盘顶部，确保一体化
      water.position.y = this.terrainHeight;

      // 添加水面波纹效果
      if (modelConfig.water.waveConfig.enabled) {
        this.addWaterWaves(water, points, modelConfig.water.waveConfig);
      }

      this.scene.add(water);

      this.models.push({
        id: `water-${element.id}`,
        type: "water",
        geometry: this.createExportableGeometry(geometry, water.position),
        material,
        position: [water.position.x, water.position.y, water.position.z],
      });

      console.log(`水体 ${element.id} 位置:`, {
        x: water.position.x,
        y: water.position.y,
        z: water.position.z,
        terrainHeight: this.terrainHeight,
      });
    } catch (error) {
      console.warn("创建水体时出错:", error);
    }
  }

  private createVegetation(
    element: OSMElement,
    basicConfig: BasicConfig,
    modelConfig: ModelConfig,
    bbox: BoundingBox
  ): void {
    if (!element.geometry || element.geometry.length < 3) return;

    // 只处理在边界内的点
    let points = element.geometry
      .filter(
        (point) =>
          point.lat >= bbox.south &&
          point.lat <= bbox.north &&
          point.lon >= bbox.west &&
          point.lon <= bbox.east
      )
      .map((point) => this.latLonToLocal(point.lat, point.lon, bbox));

    if (points.length < 3) return;

    try {
      const shape = new THREE.Shape();
      shape.moveTo(points[0].x, points[0].z);

      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].z);
      }

      // 植被基础
      const geometry = new THREE.ShapeGeometry(shape);
      const material = new THREE.MeshPhongMaterial({
        color: modelConfig.vegetation.color,
        transparent: true,
        opacity: 0.85,
        shininess: 5,
        specular: 0x1a4d1a,
        flatShading: false,
      });

      const vegetation = new THREE.Mesh(geometry, material);
      vegetation.rotation.x = -Math.PI / 2;
      // 植被紧贴底盘顶部
      const vegetationHeight = this.applyGlobalScale(
        modelConfig.vegetation.height,
        modelConfig
      );
      vegetation.position.y =
        this.terrainHeight + (vegetationHeight * this.scale) / 2;
      vegetation.receiveShadow = true;

      // 添加随机树木
      if (modelConfig.vegetation.treeConfig.enabled) {
        this.addTrees(vegetation, points, modelConfig.vegetation);
      }

      this.scene.add(vegetation);

      this.models.push({
        id: `vegetation-${element.id}`,
        type: "vegetation",
        geometry: this.createExportableGeometry(geometry, vegetation.position),
        material,
        position: [
          vegetation.position.x,
          vegetation.position.y,
          vegetation.position.z,
        ],
      });

      console.log(`植被 ${element.id} 位置:`, {
        x: vegetation.position.x,
        y: vegetation.position.y,
        z: vegetation.position.z,
        terrainHeight: this.terrainHeight,
      });
    } catch (error) {
      console.warn("创建植被时出错:", error);
    }
  }

  /**
   * 创建可导出的几何体，支持模型简化和优化
   * @param geometry - Three.js几何体
   * @param position - 模型位置
   * @param simplify - 是否简化模型
   * @returns 优化后的几何体
   */
  private createExportableGeometry(
    geometry: THREE.BufferGeometry,
    position: THREE.Vector3,
    simplify: boolean = false
  ): any {
    try {
      // 验证几何体
      if (!this.validateGeometryForExport(geometry)) {
        console.warn("几何体验证失败");
        return null;
      }

      // 确保几何体计算了必要的属性
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      // 获取原始顶点数据
      const positionArray = geometry.attributes.position.array;
      const vertexCount = geometry.attributes.position.count;

      // 模型简化（如果启用）
      let processedGeometry = geometry;
      if (simplify && vertexCount > 1000) {
        processedGeometry = this.simplifyGeometry(geometry);
      }

      // 应用位置偏移到每个顶点
      const finalPositions = processedGeometry.attributes.position.array;
      const transformedPositions = new Float32Array(finalPositions.length);
      const finalVertexCount = processedGeometry.attributes.position.count;

      for (let i = 0; i < finalVertexCount; i++) {
        const i3 = i * 3;
        transformedPositions[i3] = finalPositions[i3] + position.x;
        transformedPositions[i3 + 1] = finalPositions[i3 + 1] + position.y;
        transformedPositions[i3 + 2] = finalPositions[i3 + 2] + position.z;
      }

      // 创建包含完整几何数据的对象
      const exportGeometry = {
        attributes: {
          position: {
            array: transformedPositions,
            itemSize: 3,
            count: finalVertexCount,
          },
        },
        index: processedGeometry.index
          ? {
              array: new Uint32Array(processedGeometry.index.array),
              count: processedGeometry.index.count,
            }
          : null,
      };

      // 处理法向量
      if (processedGeometry.attributes.normal) {
        exportGeometry.attributes.normal = {
          array: new Float32Array(processedGeometry.attributes.normal.array),
          itemSize: 3,
          count: processedGeometry.attributes.normal.count,
        };
      } else {
        // 计算法向量
        processedGeometry.computeVertexNormals();
        if (processedGeometry.attributes.normal) {
          exportGeometry.attributes.normal = {
            array: new Float32Array(processedGeometry.attributes.normal.array),
            itemSize: 3,
            count: processedGeometry.attributes.normal.count,
          };
        }
      }

      // 优化索引
      if (!exportGeometry.index) {
        this.createOptimizedIndices(exportGeometry, finalVertexCount);
      }

      // 更新统计信息
      this.updateModelStats(exportGeometry);

      console.log("导出几何体数据:", {
        originalVertices: vertexCount,
        finalVertices: finalVertexCount,
        hasIndex: !!exportGeometry.index,
        indexCount: exportGeometry.index?.count || 0,
        hasNormals: !!exportGeometry.attributes.normal,
        simplified: simplify && vertexCount > 1000,
      });

      return exportGeometry;
    } catch (error) {
      console.error("创建导出几何体时出错:", error);
      return null;
    }
  }

  /**
   * 验证几何体是否适合导出
   */
  private validateGeometryForExport(geometry: THREE.BufferGeometry): boolean {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) {
      return false;
    }

    const positions = geometry.attributes.position.array;
    if (!positions || positions.length === 0 || positions.length % 3 !== 0) {
      return false;
    }

    // 检查是否有无效的坐标值
    for (let i = 0; i < positions.length; i++) {
      if (!isFinite(positions[i]) || isNaN(positions[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * 简化几何体以减少顶点数量
   */
  private simplifyGeometry(
    geometry: THREE.BufferGeometry
  ): THREE.BufferGeometry {
    // 简化算法：移除重复顶点和优化三角形
    const positions = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : null;

    // 创建顶点映射以移除重复顶点
    const vertexMap = new Map<string, number>();
    const newPositions: number[] = [];
    const newIndices: number[] = [];

    const tolerance = 0.001; // 1mm tolerance

    for (let i = 0; i < positions.length; i += 3) {
      const x = Math.round(positions[i] / tolerance) * tolerance;
      const y = Math.round(positions[i + 1] / tolerance) * tolerance;
      const z = Math.round(positions[i + 2] / tolerance) * tolerance;

      const key = `${x},${y},${z}`;

      if (!vertexMap.has(key)) {
        const newIndex = newPositions.length / 3;
        vertexMap.set(key, newIndex);
        newPositions.push(x, y, z);
      }
    }

    // 重建索引
    if (indices) {
      for (let i = 0; i < indices.length; i++) {
        const originalIndex = indices[i];
        const x =
          Math.round(positions[originalIndex * 3] / tolerance) * tolerance;
        const y =
          Math.round(positions[originalIndex * 3 + 1] / tolerance) * tolerance;
        const z =
          Math.round(positions[originalIndex * 3 + 2] / tolerance) * tolerance;
        const key = `${x},${y},${z}`;
        newIndices.push(vertexMap.get(key)!);
      }
    } else {
      // 为非索引几何体创建索引
      for (let i = 0; i < positions.length; i += 3) {
        const x = Math.round(positions[i] / tolerance) * tolerance;
        const y = Math.round(positions[i + 1] / tolerance) * tolerance;
        const z = Math.round(positions[i + 2] / tolerance) * tolerance;
        const key = `${x},${y},${z}`;
        newIndices.push(vertexMap.get(key)!);
      }
    }

    const simplifiedGeometry = new THREE.BufferGeometry();
    simplifiedGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(newPositions, 3)
    );
    simplifiedGeometry.setIndex(newIndices);

    return simplifiedGeometry;
  }

  /**
   * 创建优化的索引
   */
  private createOptimizedIndices(
    exportGeometry: any,
    vertexCount: number
  ): void {
    const indices = [];
    for (let i = 0; i < vertexCount; i++) {
      indices.push(i);
    }

    exportGeometry.index = {
      array: new Uint32Array(indices),
      count: indices.length,
    };
  }

  /**
   * 更新模型统计信息
   */
  private updateModelStats(exportGeometry: any): void {
    const vertexCount = exportGeometry.attributes.position.count;
    const triangleCount = exportGeometry.index
      ? exportGeometry.index.count / 3
      : vertexCount / 3;

    this.modelStats.totalVertices += vertexCount;
    this.modelStats.totalTriangles += triangleCount;
  }

  // 辅助方法
  private addRoof(
    building: THREE.Mesh,
    shape: THREE.Shape,
    height: number,
    roofConfig: any
  ): void {
    // 简化的屋顶实现
    if (roofConfig.type === "pitched") {
      // 添加斜屋顶逻辑
    }
  }

  private addWindows(
    building: THREE.Mesh,
    geometry: THREE.ExtrudeGeometry,
    windowConfig: any,
    height: number
  ): void {
    // 改进的窗户实现
    const bounds = geometry.boundingBox;
    if (!bounds) return;

    const width = bounds.max.x - bounds.min.x;
    const depth = bounds.max.z - bounds.min.z;
    const floors = Math.floor(height / (3 * this.scale));

    // 为每层添加窗户
    for (let floor = 1; floor <= floors; floor++) {
      const floorHeight = (floor - 0.5) * (height / floors);

      // 前面窗户
      this.addWindowRow(
        building,
        width,
        floorHeight,
        depth / 2,
        0,
        windowConfig
      );

      // 后面窗户
      this.addWindowRow(
        building,
        width,
        floorHeight,
        -depth / 2,
        Math.PI,
        windowConfig
      );

      // 左侧窗户
      this.addWindowRow(
        building,
        depth,
        floorHeight,
        0,
        Math.PI / 2,
        windowConfig
      );

      // 右侧窗户
      this.addWindowRow(
        building,
        depth,
        floorHeight,
        0,
        -Math.PI / 2,
        windowConfig
      );
    }
  }

  /**
   * 添加一排窗户
   */
  private addWindowRow(
    building: THREE.Mesh,
    wallLength: number,
    height: number,
    zOffset: number,
    rotation: number,
    windowConfig: any
  ): void {
    const windowWidth = 1.5 * this.scale;
    const windowHeight = 1.2 * this.scale;
    const windowSpacing = 2.5 * this.scale;

    const windowCount = Math.floor(wallLength / windowSpacing);
    const startX = (-(windowCount - 1) * windowSpacing) / 2;

    for (let i = 0; i < windowCount; i++) {
      const windowGeometry = new THREE.PlaneGeometry(windowWidth, windowHeight);
      const windowMaterial = new THREE.MeshPhongMaterial({
        color: windowConfig.color || 0x87ceeb,
        transparent: true,
        opacity: 0.7,
        shininess: 100,
      });

      const window = new THREE.Mesh(windowGeometry, windowMaterial);
      window.position.set(
        startX + i * windowSpacing,
        height,
        zOffset + 0.05 * this.scale
      );
      window.rotation.y = rotation;

      building.add(window);
    }
  }

  private addBridgePillars(
    bridge: THREE.Mesh,
    start: any,
    end: any,
    pillarConfig: any,
    distance: number
  ): void {
    const pillarCount = Math.floor(distance / pillarConfig.spacing);
    const pillarHeight = bridge.position.y - this.terrainHeight;

    for (let i = 0; i <= pillarCount; i++) {
      const t = i / Math.max(pillarCount, 1);
      const pillarGeometry = new THREE.CylinderGeometry(
        pillarConfig.radius * this.scale,
        pillarConfig.radius * 1.2 * this.scale,
        pillarHeight,
        8
      );
      const pillarMaterial = new THREE.MeshLambertMaterial({
        color: pillarConfig.color,
      });

      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(
        start.x + (end.x - start.x) * t,
        this.terrainHeight + pillarHeight / 2,
        start.z + (end.z - start.z) * t
      );
      pillar.castShadow = true;

      this.scene.add(pillar);
    }
  }

  private addWaterWaves(
    water: THREE.Mesh,
    points: any[],
    waveConfig: any
  ): void {
    // 简化的波浪效果
    for (let i = 0; i < 3; i++) {
      const rippleGeometry = new THREE.RingGeometry(
        0.5 * this.scale,
        1 * this.scale,
        16
      );
      const rippleMaterial = new THREE.MeshBasicMaterial({
        color:
          water.material instanceof THREE.Material
            ? (water.material as any).color
            : 0x4299e1,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });

      const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
      ripple.position.set(
        points[Math.floor(Math.random() * points.length)].x,
        this.terrainHeight + 0.01 * this.scale,
        points[Math.floor(Math.random() * points.length)].z
      );
      ripple.rotation.x = -Math.PI / 2;
      this.scene.add(ripple);
    }
  }

  // 优化树木生成
  private addTrees(
    vegetation: THREE.Mesh,
    points: any[],
    vegetationConfig: any
  ): void {
    const treeCount = Math.min(
      10,
      Math.floor(points.length * vegetationConfig.density)
    );

    for (let i = 0; i < treeCount; i++) {
      const randomPoint = points[Math.floor(Math.random() * points.length)];

      // 树干
      const treeHeight = this.applyGlobalScale(
        vegetationConfig.height,
        modelConfig
      );
      const trunkGeometry = new THREE.CylinderGeometry(
        0.1 * this.scale,
        0.2 * this.scale,
        treeHeight * 0.6 * this.scale,
        6
      );
      const trunkMaterial = new THREE.MeshLambertMaterial({ color: "#8B4513" });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);

      // 树冠
      const crownGeometry = new THREE.SphereGeometry(
        treeHeight * 0.4 * this.scale,
        8,
        6
      );
      const crownMaterial = new THREE.MeshLambertMaterial({
        color: vegetationConfig.color,
      });
      const crown = new THREE.Mesh(crownGeometry, crownMaterial);

      const randomOffset = vegetationConfig.treeConfig.randomness * this.scale;
      // 树木紧贴底盘顶部，树干中心在底盘顶部 + 树干高度/2
      trunk.position.set(
        randomPoint.x + (Math.random() - 0.5) * randomOffset,
        this.terrainHeight + treeHeight * 0.3 * this.scale,
        randomPoint.z + (Math.random() - 0.5) * randomOffset
      );

      crown.position.set(
        trunk.position.x,
        this.terrainHeight + treeHeight * 0.8 * this.scale,
        trunk.position.z
      );

      trunk.castShadow = true;
      crown.castShadow = true;
      crown.receiveShadow = true;

      this.scene.add(trunk);
      this.scene.add(crown);
    }
  }

  private latLonToLocal(
    lat: number,
    lon: number,
    bbox: BoundingBox
  ): { x: number; z: number } {
    // 使用配置的中心点和缩放
    const x =
      (lon - this.centerPoint[0]) *
      111320 *
      Math.cos((this.centerPoint[1] * Math.PI) / 180) *
      this.scale;
    const z = -(lat - this.centerPoint[1]) * 111320 * this.scale; // 负号是因为Three.js的Z轴方向

    return { x, z };
  }

  private calculateDistance(
    lon1: number,
    lat1: number,
    lon2: number,
    lat2: number
  ): number {
    const R = 6371000; // 地球半径（米）
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private clearModels(): void {
    // 从场景中移除所有现有模型
    const objectsToRemove: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.parent === this.scene) {
        objectsToRemove.push(object);
      }
    });

    objectsToRemove.forEach((object) => {
      this.scene.remove(object);
      // 清理几何体和材质
      if (object instanceof THREE.Mesh) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });

    this.models = [];
  }

  /**
   * 计算建筑UV坐标以支持纹理
   */
  private computeBuildingUVs(
    geometry: THREE.ExtrudeGeometry,
    height: number
  ): void {
    const uvAttribute = geometry.attributes.uv;
    if (!uvAttribute) return;

    const uvs = uvAttribute.array as Float32Array;
    const positionAttribute = geometry.attributes.position;
    const positions = positionAttribute.array as Float32Array;

    // 为每个面计算合适的UV坐标
    for (let i = 0; i < uvs.length; i += 2) {
      const vertexIndex = i / 2;
      const x = positions[vertexIndex * 3];
      const y = positions[vertexIndex * 3 + 1];
      const z = positions[vertexIndex * 3 + 2];

      // 根据面的方向计算UV
      if (Math.abs(y) < 0.01) {
        // 底面
        uvs[i] = (x + 50) / 100;
        uvs[i + 1] = (z + 50) / 100;
      } else if (Math.abs(y - height) < 0.01) {
        // 顶面
        uvs[i] = (x + 50) / 100;
        uvs[i + 1] = (z + 50) / 100;
      } else {
        // 侧面
        uvs[i] = Math.sqrt(x * x + z * z) / 20;
        uvs[i + 1] = y / height;
      }
    }

    uvAttribute.needsUpdate = true;
  }

  /**
   * 根据OSM标签确定建筑类型
   */
  private getBuildingType(tags: any): string {
    if (
      tags.building === "residential" ||
      tags.building === "house" ||
      tags.building === "apartments"
    ) {
      return "residential";
    }
    if (
      tags.building === "commercial" ||
      tags.building === "retail" ||
      tags.building === "office"
    ) {
      return "commercial";
    }
    if (tags.building === "industrial" || tags.building === "warehouse") {
      return "industrial";
    }
    if (
      tags.building === "church" ||
      tags.building === "cathedral" ||
      tags.amenity === "place_of_worship"
    ) {
      return "religious";
    }
    if (
      tags.building === "school" ||
      tags.building === "university" ||
      tags.amenity === "school"
    ) {
      return "educational";
    }
    return "generic";
  }

  /**
   * 根据建筑类型创建材质
   */
  private createBuildingMaterial(
    buildingType: string,
    baseColor: number
  ): THREE.Material {
    const materialConfig = {
      residential: {
        color: 0xe8d5b7, // 温暖的米色
        roughness: 0.7,
        metalness: 0.1,
        shininess: 30,
      },
      commercial: {
        color: 0xb0c4de, // 现代蓝灰色
        roughness: 0.4,
        metalness: 0.3,
        shininess: 80,
      },
      industrial: {
        color: 0x708090, // 工业灰色
        roughness: 0.8,
        metalness: 0.2,
        shininess: 10,
      },
      religious: {
        color: 0xf5f5dc, // 温暖的米白色
        roughness: 0.6,
        metalness: 0.1,
        shininess: 40,
      },
      educational: {
        color: 0xffe4b5, // 温暖的桃色
        roughness: 0.7,
        metalness: 0.1,
        shininess: 30,
      },
      generic: {
        color: 0xd2b48c, // 温暖的棕褐色
        roughness: 0.7,
        metalness: 0.2,
        shininess: 30,
      },
    };

    const config =
      materialConfig[buildingType as keyof typeof materialConfig] ||
      materialConfig.generic;

    return new THREE.MeshPhongMaterial({
      color: config.color,
      shininess: config.shininess,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      flatShading: false,
    });
  }

  /**
   * 添加建筑边缘线条
   */
  private addBuildingEdges(
    building: THREE.Mesh,
    geometry: THREE.ExtrudeGeometry
  ): void {
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.4,
      linewidth: 1,
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    building.add(wireframe);
  }

  /**
   * 添加建筑细节
   */
  private addBuildingDetails(
    building: THREE.Mesh,
    shape: THREE.Shape,
    height: number,
    buildingType: string
  ): void {
    // 根据建筑类型添加不同的细节
    switch (buildingType) {
      case "commercial":
        this.addCommercialDetails(building, shape, height);
        break;
      case "residential":
        this.addResidentialDetails(building, shape, height);
        break;
      case "industrial":
        this.addIndustrialDetails(building, shape, height);
        break;
      case "religious":
        this.addReligiousDetails(building, shape, height);
        break;
    }
  }

  /**
   * 添加商业建筑细节
   */
  private addCommercialDetails(
    building: THREE.Mesh,
    shape: THREE.Shape,
    height: number
  ): void {
    // 添加玻璃幕墙效果
    const bounds = shape.getBoundingBox();
    const width = bounds.max.x - bounds.min.x;
    const depth = bounds.max.y - bounds.min.y;

    // 创建玻璃面板
    const panelGeometry = new THREE.PlaneGeometry(width * 0.8, height * 0.8);
    const glassMaterial = new THREE.MeshPhongMaterial({
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.3,
      shininess: 100,
    });

    const glassPanel = new THREE.Mesh(panelGeometry, glassMaterial);
    glassPanel.position.set(0, height / 2, depth / 2 + 0.1 * this.scale);
    building.add(glassPanel);
  }

  /**
   * 添加住宅建筑细节
   */
  private addResidentialDetails(
    building: THREE.Mesh,
    shape: THREE.Shape,
    height: number
  ): void {
    // 添加阳台
    const bounds = shape.getBoundingBox();
    const width = bounds.max.x - bounds.min.x;

    if (height > 10 * this.scale) {
      const balconyGeometry = new THREE.BoxGeometry(
        width * 0.3,
        0.2 * this.scale,
        2 * this.scale
      );
      const balconyMaterial = new THREE.MeshLambertMaterial({
        color: 0xd2b48c,
      });

      const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
      balcony.position.set(0, height * 0.7, bounds.max.y + 1 * this.scale);
      building.add(balcony);
    }
  }

  /**
   * 添加工业建筑细节
   */
  private addIndustrialDetails(
    building: THREE.Mesh,
    shape: THREE.Shape,
    height: number
  ): void {
    // 添加烟囱
    const chimneyGeometry = new THREE.CylinderGeometry(
      0.5 * this.scale,
      0.7 * this.scale,
      height * 0.3,
      8
    );
    const chimneyMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });

    const chimney = new THREE.Mesh(chimneyGeometry, chimneyMaterial);
    chimney.position.set(0, height + height * 0.15, 0);
    building.add(chimney);
  }

  /**
   * 添加宗教建筑细节
   */
  private addReligiousDetails(
    building: THREE.Mesh,
    shape: THREE.Shape,
    height: number
  ): void {
    // 添加十字架或尖塔
    const spireGeometry = new THREE.ConeGeometry(
      1 * this.scale,
      height * 0.4,
      8
    );
    const spireMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });

    const spire = new THREE.Mesh(spireGeometry, spireMaterial);
    spire.position.set(0, height + height * 0.2, 0);
    building.add(spire);
  }
}
