import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Download, RotateCcw, Palette } from 'lucide-react';
import L from 'leaflet';

interface Model3DPreviewProps {
  bounds: L.LatLngBounds | null;
  shapeData?: any;
}

// 城市区域类型和对应颜色
const AREA_TYPES = {
  residential: { color: 0x90EE90, name: '住宅区' },
  commercial: { color: 0x4169E1, name: '商业区' },
  industrial: { color: 0x8B4513, name: '工业区' },
  park: { color: 0x228B22, name: '公园绿地' },
  water: { color: 0x1E90FF, name: '水域' },
  road: { color: 0x696969, name: '道路' },
  building: { color: 0xD3D3D3, name: '建筑物' }
};

export default function Model3DPreview({ bounds, shapeData }: Model3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelGenerated, setModelGenerated] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, 400 / 300, 0.1, 1000);
    camera.position.set(0, 8, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 300);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create main group for all city elements
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (groupRef.current) {
        groupRef.current.rotation.y += 0.003;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const generateCityModel = async () => {
    if (!bounds || !sceneRef.current || !groupRef.current) return;

    setIsGenerating(true);
    
    // Clear existing model
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    // Simulate city model generation
    setTimeout(() => {
      if (!groupRef.current) return;

      const group = groupRef.current;
      
      // Create base plane (city foundation)
      const baseGeometry = new THREE.PlaneGeometry(8, 8);
      const baseMaterial = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
      const basePlane = new THREE.Mesh(baseGeometry, baseMaterial);
      basePlane.rotation.x = -Math.PI / 2;
      basePlane.receiveShadow = true;
      group.add(basePlane);

      // Generate different city areas
      generateCityAreas(group);
      
      setIsGenerating(false);
      setModelGenerated(true);
    }, 2000);
  };

  const generateCityAreas = (group: THREE.Group) => {
    const areas = [
      // 住宅区
      { type: 'residential', x: -2, z: -2, width: 1.5, depth: 1.5, height: 0.1 },
      { type: 'residential', x: 2, z: -2, width: 1.5, depth: 1.5, height: 0.1 },
      
      // 商业区 (稍高一些)
      { type: 'commercial', x: -1, z: 0, width: 2, depth: 1, height: 0.3 },
      
      // 工业区
      { type: 'industrial', x: -3, z: 1, width: 1, depth: 2, height: 0.15 },
      
      // 公园绿地
      { type: 'park', x: 1, z: 2, width: 2, depth: 1.5, height: 0.05 },
      
      // 水域
      { type: 'water', x: 3, z: 0, width: 1, depth: 3, height: 0.02 },
    ];

    areas.forEach(area => {
      const geometry = new THREE.BoxGeometry(area.width, area.height, area.depth);
      const material = new THREE.MeshLambertMaterial({ 
        color: AREA_TYPES[area.type as keyof typeof AREA_TYPES].color 
      });
      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.position.set(area.x, area.height / 2, area.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      group.add(mesh);
    });

    // 添加一些建筑物
    generateBuildings(group);
    
    // 添加道路
    generateRoads(group);
  };

  const generateBuildings = (group: THREE.Group) => {
    const buildings = [
      { x: -2, z: -2, width: 0.3, height: 0.8, depth: 0.3 },
      { x: -1.5, z: -1.8, width: 0.2, height: 0.6, depth: 0.2 },
      { x: -2.2, z: -1.5, width: 0.25, height: 0.7, depth: 0.25 },
      { x: 2, z: -2, width: 0.3, height: 0.9, depth: 0.3 },
      { x: 1.7, z: -1.7, width: 0.2, height: 0.5, depth: 0.2 },
      { x: -1, z: 0, width: 0.4, height: 1.2, depth: 0.4 }, // 商业建筑
      { x: -0.5, z: 0.2, width: 0.3, height: 1.0, depth: 0.3 },
    ];

    buildings.forEach(building => {
      const geometry = new THREE.BoxGeometry(building.width, building.height, building.depth);
      const material = new THREE.MeshLambertMaterial({ color: AREA_TYPES.building.color });
      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.position.set(building.x, building.height / 2 + 0.1, building.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      group.add(mesh);
    });
  };

  const generateRoads = (group: THREE.Group) => {
    const roads = [
      // 主干道
      { x: 0, z: -3, width: 6, depth: 0.2, height: 0.01 },
      { x: 0, z: 3, width: 6, depth: 0.2, height: 0.01 },
      { x: -3, z: 0, width: 0.2, depth: 6, height: 0.01 },
      { x: 3, z: 0, width: 0.2, depth: 6, height: 0.01 },
    ];

    roads.forEach(road => {
      const geometry = new THREE.BoxGeometry(road.width, road.height, road.depth);
      const material = new THREE.MeshLambertMaterial({ color: AREA_TYPES.road.color });
      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.position.set(road.x, road.height / 2 + 0.001, road.z);
      mesh.receiveShadow = true;
      
      group.add(mesh);
    });
  };

  const download3MF = () => {
    // 模拟3MF文件下载
    const element = document.createElement('a');
    const file = new Blob(['3MF city model content'], { type: 'application/3mf' });
    element.href = URL.createObjectURL(file);
    element.download = 'city_model.3mf';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const resetView = () => {
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 8, 8);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">城市3D模型预览</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            title="显示图例"
          >
            <Palette className="h-4 w-4" />
          </button>
          <button
            onClick={resetView}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            title="重置视角"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          {modelGenerated && (
            <button
              onClick={download3MF}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              下载3MF
            </button>
          )}
        </div>
      </div>
      
      <div className="relative">
        <div ref={mountRef} className="w-full flex justify-center" />
        
        {showLegend && (
          <div className="absolute top-4 right-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">区域图例</h4>
            <div className="space-y-1">
              {Object.entries(AREA_TYPES).map(([key, area]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: `#${area.color.toString(16).padStart(6, '0')}` }}
                  />
                  <span className="text-gray-700">{area.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {!bounds && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">请先在地图上选择区域</p>
          </div>
        )}
        
        {bounds && !modelGenerated && !isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 rounded-lg">
            <button
              onClick={generateCityModel}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              生成城市3D模型
            </button>
          </div>
        )}
        
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">正在生成城市3D模型...</p>
            </div>
          </div>
        )}
      </div>
      
      {modelGenerated && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800">
            ✓ 城市3D模型已生成完成，包含不同功能区域的彩色分布
          </p>
        </div>
      )}
    </div>
  );
}