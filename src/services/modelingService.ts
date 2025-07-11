import * as THREE from 'three';
import { OSMData, OSMElement, ModelConfig, BasicConfig, BoundingBox, Model3D } from '../types';

export class ModelingService {
  private scene: THREE.Scene;
  private models: Model3D[] = [];
  private centerPoint: [number, number] = [0, 0];
  private scale: number = 1;
  private selectedBBox: BoundingBox | null = null;
  private terrainHeight: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async generateModels(osmData: OSMData, basicConfig: BasicConfig, modelConfig: ModelConfig, bbox: BoundingBox): Promise<Model3D[]> {
    this.clearModels();
    
    // 设置坐标系统和选择区域
    this.centerPoint = basicConfig.coordinateSystem.centerPoint;
    this.scale = basicConfig.coordinateSystem.scale * basicConfig.renderHeight;
    this.selectedBBox = bbox;
    this.terrainHeight = modelConfig.terrain.baseHeight * this.scale;
    
    // 首先生成底盘平台
    this.generateBasePlatform(bbox, basicConfig, modelConfig);
    
    // 处理OSM元素，只渲染在选择区域内的元素
    osmData.elements.forEach(element => {
      if (this.isElementInBounds(element, bbox)) {
        this.processElement(element, basicConfig, modelConfig, bbox);
      }
    });

    return this.models;
  }

  private isElementInBounds(element: OSMElement, bbox: BoundingBox): boolean {
    if (!element.geometry || element.geometry.length === 0) return false;

    // 检查元素的几何体是否与选择区域相交
    for (const point of element.geometry) {
      if (point.lat >= bbox.south && point.lat <= bbox.north &&
          point.lon >= bbox.west && point.lon <= bbox.east) {
        return true;
      }
    }

    // 如果没有点在区域内，检查是否有线段穿过区域
    if (element.geometry.length > 1) {
      for (let i = 0; i < element.geometry.length - 1; i++) {
        const p1 = element.geometry[i];
        const p2 = element.geometry[i + 1];
        
        if (this.lineIntersectsBounds(p1, p2, bbox)) {
          return true;
        }
      }
    }

    return false;
  }

  private lineIntersectsBounds(p1: {lat: number, lon: number}, p2: {lat: number, lon: number}, bbox: BoundingBox): boolean {
    // 简化的线段与矩形相交检测
    const minLat = Math.min(p1.lat, p2.lat);
    const maxLat = Math.max(p1.lat, p2.lat);
    const minLon = Math.min(p1.lon, p2.lon);
    const maxLon = Math.max(p1.lon, p2.lon);

    return !(maxLat < bbox.south || minLat > bbox.north || 
             maxLon < bbox.west || minLon > bbox.east);
  }

  private generateBasePlatform(bbox: BoundingBox, basicConfig: BasicConfig, modelConfig: ModelConfig): void {
    if (!modelConfig.terrain.enabled) return;

    // 计算实际地理距离并转换为模型尺寸
    const width = this.calculateDistance(bbox.west, bbox.south, bbox.east, bbox.south);
    const depth = this.calculateDistance(bbox.west, bbox.south, bbox.west, bbox.north);
    const platformHeight = modelConfig.terrain.baseHeight;
    
    console.log('底盘尺寸:', { width: width.toFixed(2), depth: depth.toFixed(2), height: platformHeight });
    
    // 创建地形基础
    let geometry: THREE.BufferGeometry;
    
    const aspectRatio = width / depth;
    if (Math.abs(aspectRatio - 1) < 0.1) {
      // 接近正方形，创建圆角矩形
      geometry = this.createRoundedBoxGeometry(width, platformHeight, depth, Math.min(width, depth) * 0.05);
    } else {
      // 普通矩形
      geometry = new THREE.BoxGeometry(width, platformHeight, depth);
    }
    
    const material = new THREE.MeshLambertMaterial({ 
      color: modelConfig.terrain.textureConfig.enabled ? modelConfig.terrain.color : basicConfig.baseColor,
      transparent: true,
      opacity: 0.9
    });
    
    // 添加边缘高光
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0x444444,
      transparent: true,
      opacity: 0.3
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    
    const platform = new THREE.Mesh(geometry, material);
    // 底盘底部在y=0，顶部在y=platformHeight
    platform.position.set(0, platformHeight / 2, 0);
    platform.receiveShadow = true;
    platform.add(wireframe);
    
    this.scene.add(platform);
    
    // 更新地形高度基准
    this.terrainHeight = platformHeight;
    
    this.models.push({
      id: 'base-platform',
      type: 'terrain',
      geometry: this.createExportableGeometry(geometry, platform.position),
      material,
      position: [0, platformHeight / 2, 0]
    });
    
    console.log('底盘生成完成，地形高度基准:', this.terrainHeight);
  }

  private createRoundedBoxGeometry(width: number, height: number, depth: number, radius: number): THREE.BufferGeometry {
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

  private processElement(element: OSMElement, basicConfig: BasicConfig, modelConfig: ModelConfig, bbox: BoundingBox): void {
    if (!element.tags || !element.geometry) return;

    // 严格检查元素是否在选择区域内
    if (!this.isElementInBounds(element, bbox)) return;

    const tags = element.tags;
    
    // 处理建筑
    if (tags.building && modelConfig.buildings.enabled) {
      this.createBuilding(element, basicConfig, modelConfig, bbox);
    }
    
    // 处理道路
    else if (tags.highway && modelConfig.roads.enabled) {
      this.createRoad(element, basicConfig, modelConfig, bbox);
    }
    
    // 处理桥梁
    else if (tags.bridge === 'yes' && modelConfig.bridges.enabled) {
      this.createBridge(element, basicConfig, modelConfig, bbox);
    }
    
    // 处理水体
    else if ((tags.waterway || tags.natural === 'water') && modelConfig.water.enabled) {
      this.createWater(element, basicConfig, modelConfig, bbox);
    }
    
    // 处理植被
    else if ((tags.landuse === 'grass' || tags.landuse === 'forest' || tags.natural === 'wood' || tags.leisure === 'park') && modelConfig.vegetation.enabled) {
      this.createVegetation(element, basicConfig, modelConfig, bbox);
    }
  }

  private clipGeometryToBounds(points: {x: number, z: number}[], bbox: BoundingBox): {x: number, z: number}[] {
    // 这个方法不再需要，因为我们在处理元素时就已经过滤了
    return points;
  }

  private createBuilding(element: OSMElement, basicConfig: BasicConfig, modelConfig: ModelConfig, bbox: BoundingBox): void {
    if (!element.geometry || element.geometry.length < 3) return;

    // 只处理在边界内的点
    let points = element.geometry
      .filter(point => 
        point.lat >= bbox.south && point.lat <= bbox.north &&
        point.lon >= bbox.west && point.lon <= bbox.east
      )
      .map(point => 
      this.latLonToLocal(point.lat, point.lon, bbox)
    );

    if (points.length < 3) return;

    // 创建建筑轮廓
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].z);
    
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].z);
    }

    // 确定建筑高度
    const levels = parseInt(element.tags?.levels || '3');
    const buildingHeight = element.tags?.height ? parseFloat(element.tags.height) : null;
    const height = (buildingHeight || Math.max(modelConfig.buildings.baseHeight, levels * 3)) * this.scale;

    const extrudeSettings = {
      depth: height,
      bevelEnabled: true,
      bevelThickness: 0.1 * this.scale,
      bevelSize: 0.1 * this.scale,
      bevelOffset: 0,
      bevelSegments: 2,
    };

    try {
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // 创建更丰富的材质
      const material = new THREE.MeshPhongMaterial({ 
        color: modelConfig.buildings.color,
        shininess: 30,
        transparent: true,
        opacity: 0.9
      });
      
      // 添加边缘线条
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x333333,
        transparent: true,
        opacity: 0.6
      });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      
      const building = new THREE.Mesh(geometry, material);
      building.rotation.x = -Math.PI / 2;
      // 建筑底部紧贴底盘顶部
      building.position.y = height / 2;
      building.castShadow = true;
      building.receiveShadow = true;
      building.add(wireframe);
      
      // 添加屋顶
      if (modelConfig.buildings.roofConfig.enabled) {
        this.addRoof(building, shape, height, modelConfig.buildings.roofConfig);
      }
      
      // 添加窗户
      if (modelConfig.buildings.windowConfig.enabled) {
        this.addWindows(building, geometry, modelConfig.buildings.windowConfig);
      }
      
      this.scene.add(building);
      
      this.models.push({
        id: `building-${element.id}`,
        type: 'building',
        geometry: this.createExportableGeometry(geometry, building.position),
        material,
        position: [building.position.x, building.position.y, building.position.z]
      });
    } catch (error) {
      console.warn('创建建筑时出错:', error);
    }
  }

  private isPointInBounds(point: {x: number, z: number}, bbox: BoundingBox): boolean {
    // 这个方法不再需要，因为我们在处理元素时就已经过滤了
    return true;
  }

  private createRoad(element: OSMElement, basicConfig: BasicConfig, modelConfig: ModelConfig, bbox: BoundingBox): void {
    if (!element.geometry || element.geometry.length < 2) return;

    // 只处理在边界内的点
    let points = element.geometry
      .filter(point => 
        point.lat >= bbox.south && point.lat <= bbox.north &&
        point.lon >= bbox.west && point.lon <= bbox.east
      )
      .map(point => 
        this.latLonToLocal(point.lat, point.lon, bbox)
      );

    if (points.length < 2) return;

    // 根据道路类型调整参数
    const roadType = element.tags?.highway as keyof typeof modelConfig.roads.types;
    const roadConfig = modelConfig.roads.types[roadType] || {
      width: modelConfig.roads.width,
      color: modelConfig.roads.color,
      height: modelConfig.roads.height
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
      
      const material = new THREE.MeshLambertMaterial({ 
        color: roadConfig.color,
        transparent: true,
        opacity: 0.8
      });
      
      const road = new THREE.Mesh(geometry, material);
      
      // 道路紧贴底盘顶部
      road.position.set(
        (start.x + end.x) / 2,
        roadConfig.height * this.scale / 2,
        (start.z + end.z) / 2
      );
      
      const angle = Math.atan2(end.z - start.z, end.x - start.x);
      road.rotation.y = angle;
      road.receiveShadow = true;
      
      this.scene.add(road);
      
      this.models.push({
        id: `road-${element.id}-${i}`,
        type: 'road',
        geometry: this.createExportableGeometry(geometry, road.position),
        material,
        position: [road.position.x, road.position.y, road.position.z],
        rotation: [0, angle, 0]
      });
    }
  }

  private createBridge(element: OSMElement, basicConfig: BasicConfig, modelConfig: ModelConfig, bbox: BoundingBox): void {
    if (!element.geometry || element.geometry.length < 2) return;

    // 只处理在边界内的点
    const points = element.geometry
      .filter(point => 
        point.lat >= bbox.south && point.lat <= bbox.north &&
        point.lon >= bbox.west && point.lon <= bbox.east
      )
      .map(point => 
        this.latLonToLocal(point.lat, point.lon, bbox)
      );

    if (points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      
      const distance = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2)
      );

      if (distance < 0.1) continue;

      // 桥梁主体
      const bridgeGeometry = new THREE.BoxGeometry(
        distance, 
        modelConfig.bridges.height * this.scale, 
        modelConfig.bridges.width * this.scale
      );
      const bridgeMaterial = new THREE.MeshPhongMaterial({ 
        color: modelConfig.bridges.color,
        shininess: 50
      });
      
      const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);
      
      // 桥梁高于底盘
      bridge.position.set(
        (start.x + end.x) / 2,
        modelConfig.bridges.height * this.scale / 2 + 2 * this.scale,
        (start.z + end.z) / 2
      );
      
      const angle = Math.atan2(end.z - start.z, end.x - start.x);
      bridge.rotation.y = angle;
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      
      // 添加桥梁支柱
      if (modelConfig.bridges.pillarConfig.enabled) {
        this.addBridgePillars(bridge, start, end, modelConfig.bridges.pillarConfig, distance);
      }
      
      this.scene.add(bridge);
      
      this.models.push({
        id: `bridge-${element.id}-${i}`,
        type: 'bridge',
        geometry: this.createExportableGeometry(bridgeGeometry, bridge.position),
        material: bridgeMaterial,
        position: [bridge.position.x, bridge.position.y, bridge.position.z],
        rotation: [0, angle, 0]
      });
    }
  }

  private createWater(element: OSMElement, basicConfig: BasicConfig, modelConfig: ModelConfig, bbox: BoundingBox): void {
    if (!element.geometry || element.geometry.length < 3) return;

    // 只处理在边界内的点
    let points = element.geometry
      .filter(point => 
        point.lat >= bbox.south && point.lat <= bbox.north &&
        point.lon >= bbox.west && point.lon <= bbox.east
      )
      .map(point => 
        this.latLonToLocal(point.lat, point.lon, bbox)
      );
      
    if (points.length < 3) return;

    try {
      const shape = new THREE.Shape();
      shape.moveTo(points[0].x, points[0].z);
      
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].z);
      }

      const geometry = new THREE.ShapeGeometry(shape);
      
      // 创建水面效果
      const material = new THREE.MeshPhongMaterial({ 
        color: modelConfig.water.color,
        transparent: true,
        opacity: 0.7,
        shininess: 100,
        reflectivity: 0.3
      });
      
      const water = new THREE.Mesh(geometry, material);
      water.rotation.x = -Math.PI / 2;
      // 水面紧贴底盘顶部
      water.position.y = modelConfig.water.height * this.scale;
      
      // 添加水面波纹效果
      if (modelConfig.water.waveConfig.enabled) {
        this.addWaterWaves(water, points, modelConfig.water.waveConfig);
      }
      
      this.scene.add(water);
      
      this.models.push({
        id: `water-${element.id}`,
        type: 'water',
        geometry: this.createExportableGeometry(geometry, water.position),
        material,
        position: [water.position.x, water.position.y, water.position.z]
      });
    } catch (error) {
      console.warn('创建水体时出错:', error);
    }
  }

  private createVegetation(element: OSMElement, basicConfig: BasicConfig, modelConfig: ModelConfig, bbox: BoundingBox): void {
    if (!element.geometry || element.geometry.length < 3) return;

    // 只处理在边界内的点
    let points = element.geometry
      .filter(point => 
        point.lat >= bbox.south && point.lat <= bbox.north &&
        point.lon >= bbox.west && point.lon <= bbox.east
      )
      .map(point => 
        this.latLonToLocal(point.lat, point.lon, bbox)
      );
      
    if (points.length < 3) return;

    try {
      const shape = new THREE.Shape();
      shape.moveTo(points[0].x, points[0].z);
      
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].z);
      }

      // 植被基础
      const geometry = new THREE.ShapeGeometry(shape);
      const material = new THREE.MeshLambertMaterial({ 
        color: modelConfig.vegetation.color,
        transparent: true,
        opacity: 0.8
      });
      
      const vegetation = new THREE.Mesh(geometry, material);
      vegetation.rotation.x = -Math.PI / 2;
      // 植被紧贴底盘顶部
      vegetation.position.y = modelConfig.vegetation.height * this.scale / 2;
      vegetation.receiveShadow = true;
      
      // 添加随机树木
      if (modelConfig.vegetation.treeConfig.enabled) {
        this.addTrees(vegetation, points, modelConfig.vegetation);
      }
      
      this.scene.add(vegetation);
      
      this.models.push({
        id: `vegetation-${element.id}`,
        type: 'vegetation',
        geometry: this.createExportableGeometry(geometry, vegetation.position),
        material,
        position: [vegetation.position.x, vegetation.position.y, vegetation.position.z]
      });
    } catch (error) {
      console.warn('创建植被时出错:', error);
    }
  }

  // 创建可导出的几何体数据
  private createExportableGeometry(geometry: THREE.BufferGeometry, position: THREE.Vector3): any {
    try {
      // 确保几何体有正确的属性
      if (!geometry.attributes.position) {
        console.warn('几何体缺少位置属性');
        return null;
      }

      // 确保几何体计算了边界盒
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      // 获取原始顶点数据
      const positionArray = geometry.attributes.position.array;
      const vertexCount = geometry.attributes.position.count;
      
      // 应用位置偏移到每个顶点
      const transformedPositions = new Float32Array(positionArray.length);
      for (let i = 0; i < vertexCount; i++) {
        const i3 = i * 3;
        transformedPositions[i3] = positionArray[i3] + position.x;
        transformedPositions[i3 + 1] = positionArray[i3 + 1] + position.y;
        transformedPositions[i3 + 2] = positionArray[i3 + 2] + position.z;
      }

      // 创建包含完整几何数据的对象
      const exportGeometry = {
        attributes: {
          position: {
            array: transformedPositions,
            itemSize: 3,
            count: vertexCount
          }
        },
        index: geometry.index ? {
          array: new Uint32Array(geometry.index.array),
          count: geometry.index.count
        } : null
      };

      // 处理法向量
      if (geometry.attributes.normal) {
        exportGeometry.attributes.normal = {
          array: new Float32Array(geometry.attributes.normal.array),
          itemSize: 3,
          count: geometry.attributes.normal.count
        };
      } else {
        // 计算法向量
        geometry.computeVertexNormals();
        if (geometry.attributes.normal) {
          exportGeometry.attributes.normal = {
            array: new Float32Array(geometry.attributes.normal.array),
            itemSize: 3,
            count: geometry.attributes.normal.count
          };
        }
      }

      console.log('导出几何体数据:', {
        vertexCount,
        hasIndex: !!exportGeometry.index,
        indexCount: exportGeometry.index?.count || 0,
        hasNormals: !!exportGeometry.attributes.normal
      });

      return exportGeometry;
    } catch (error) {
      console.error('创建导出几何体时出错:', error);
      return null;
    }
  }

  // 辅助方法
  private addRoof(building: THREE.Mesh, shape: THREE.Shape, height: number, roofConfig: any): void {
    // 简化的屋顶实现
    if (roofConfig.type === 'pitched') {
      // 添加斜屋顶逻辑
    }
  }

  private addWindows(building: THREE.Mesh, geometry: THREE.ExtrudeGeometry, windowConfig: any): void {
    // 简化的窗户实现
    // 在建筑表面添加窗户纹理或几何体
  }

  private addBridgePillars(bridge: THREE.Mesh, start: any, end: any, pillarConfig: any, distance: number): void {
    const pillarCount = Math.floor(distance / pillarConfig.spacing);
    const pillarHeight = bridge.position.y;
    
    for (let i = 0; i <= pillarCount; i++) {
      const t = i / Math.max(pillarCount, 1);
      const pillarGeometry = new THREE.CylinderGeometry(
        pillarConfig.radius * this.scale, 
        pillarConfig.radius * 1.2 * this.scale, 
        pillarHeight, 
        8
      );
      const pillarMaterial = new THREE.MeshLambertMaterial({ color: pillarConfig.color });
      
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(
        start.x + (end.x - start.x) * t,
        pillarHeight / 2,
        start.z + (end.z - start.z) * t
      );
      pillar.castShadow = true;
      
      this.scene.add(pillar);
    }
  }

  private addWaterWaves(water: THREE.Mesh, points: any[], waveConfig: any): void {
    // 简化的波浪效果
    for (let i = 0; i < 3; i++) {
      const rippleGeometry = new THREE.RingGeometry(0.5 * this.scale, 1 * this.scale, 16);
      const rippleMaterial = new THREE.MeshBasicMaterial({
        color: water.material instanceof THREE.Material ? (water.material as any).color : 0x4299e1,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      
      const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
      ripple.position.set(
        points[Math.floor(Math.random() * points.length)].x,
        water.position.y + 0.01 * this.scale,
        points[Math.floor(Math.random() * points.length)].z
      );
      ripple.rotation.x = -Math.PI / 2;
      this.scene.add(ripple);
    }
  }

  // 优化树木生成
  private addTrees(vegetation: THREE.Mesh, points: any[], vegetationConfig: any): void {
    const treeCount = Math.min(10, Math.floor(points.length * vegetationConfig.density));
    
    for (let i = 0; i < treeCount; i++) {
      const randomPoint = points[Math.floor(Math.random() * points.length)];
      
      // 树干
      const trunkGeometry = new THREE.CylinderGeometry(
        0.1 * this.scale, 
        0.2 * this.scale, 
        vegetationConfig.height * 0.6 * this.scale, 
        6
      );
      const trunkMaterial = new THREE.MeshLambertMaterial({ color: '#8B4513' });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      
      // 树冠
      const crownGeometry = new THREE.SphereGeometry(vegetationConfig.height * 0.4 * this.scale, 8, 6);
      const crownMaterial = new THREE.MeshLambertMaterial({ color: vegetationConfig.color });
      const crown = new THREE.Mesh(crownGeometry, crownMaterial);
      
      const randomOffset = vegetationConfig.treeConfig.randomness * this.scale;
      // 树木紧贴底盘顶部
      trunk.position.set(
        randomPoint.x + (Math.random() - 0.5) * randomOffset,
        vegetationConfig.height * 0.3 * this.scale,
        randomPoint.z + (Math.random() - 0.5) * randomOffset
      );
      
      crown.position.set(
        trunk.position.x,
        vegetationConfig.height * 0.8 * this.scale,
        trunk.position.z
      );
      
      trunk.castShadow = true;
      crown.castShadow = true;
      crown.receiveShadow = true;
      
      this.scene.add(trunk);
      this.scene.add(crown);
    }
  }

  private latLonToLocal(lat: number, lon: number, bbox: BoundingBox): { x: number; z: number } {
    // 使用配置的中心点和缩放
    const x = (lon - this.centerPoint[0]) * 111320 * Math.cos(this.centerPoint[1] * Math.PI / 180) * this.scale;
    const z = -(lat - this.centerPoint[1]) * 111320 * this.scale; // 负号是因为Three.js的Z轴方向
    
    return { x, z };
  }

  private calculateDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
    const R = 6371000; // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
    
    objectsToRemove.forEach(object => {
      this.scene.remove(object);
      // 清理几何体和材质
      if (object instanceof THREE.Mesh) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });
    
    this.models = [];
  }
}