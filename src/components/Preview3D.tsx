import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { ModelingService } from '../services/modelingService';
import { ExportService } from '../services/exportService';
import { OSMData, ModelConfig, BasicConfig, BoundingBox, Model3D } from '../types';
import { Eye, Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface Preview3DProps {
  osmData: OSMData | null;
  basicConfig: BasicConfig;
  modelConfig: ModelConfig;
  bbox: BoundingBox | null;
  className?: string;
}

export const Preview3D: React.FC<Preview3DProps> = ({ osmData, basicConfig, modelConfig, bbox, className }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelingServiceRef = useRef<ModelingService | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const controlsRef = useRef<any>(null);
  const [models, setModels] = useState<Model3D[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cameraPosition, setCameraPosition] = useState({ distance: 100, theta: 0, phi: Math.PI / 4 });

  useEffect(() => {
    if (!mountRef.current) return;

    // 初始化Three.js场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 50, 500);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    updateCameraPosition(camera, cameraPosition);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(400, 300);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // 改进的光照系统
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    // 添加辅助光源
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.3);
    scene.add(hemisphereLight);

    // 添加控制器
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    const onMouseDown = (event: MouseEvent) => {
      mouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseUp = () => {
      mouseDown = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!mouseDown || !cameraRef.current) return;

      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      setCameraPosition(prev => {
        const newTheta = prev.theta - deltaX * 0.01;
        const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, prev.phi + deltaY * 0.01));
        
        const newPosition = { ...prev, theta: newTheta, phi: newPhi };
        updateCameraPosition(cameraRef.current!, newPosition);
        return newPosition;
      });

      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!cameraRef.current) return;
      
      setCameraPosition(prev => {
        const scale = event.deltaY > 0 ? 1.1 : 0.9;
        const newDistance = Math.max(10, Math.min(500, prev.distance * scale));
        
        const newPosition = { ...prev, distance: newDistance };
        updateCameraPosition(cameraRef.current!, newPosition);
        return newPosition;
      });
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // 初始化建模服务
    modelingServiceRef.current = new ModelingService(scene);

    mountRef.current.appendChild(renderer.domElement);

    // 动画循环
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      if (rendererRef.current && cameraRef.current && sceneRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // 处理窗口大小变化
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      if (mountRef.current && renderer.domElement && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const updateCameraPosition = (camera: THREE.PerspectiveCamera, position: typeof cameraPosition) => {
    const spherical = new THREE.Spherical(position.distance, position.phi, position.theta);
    camera.position.setFromSpherical(spherical);
    camera.lookAt(0, 0, 0);
  };

  const generateModel = async () => {
    if (!osmData || !bbox || !modelingServiceRef.current) return;

    setIsGenerating(true);
    try {
      const generatedModels = await modelingServiceRef.current.generateModels(osmData, basicConfig, modelConfig, bbox);
      setModels(generatedModels);
      console.log('生成的模型数量:', generatedModels.length);
      generatedModels.forEach((model, index) => {
        console.log(`模型 ${index}:`, {
          id: model.id,
          type: model.type,
          hasGeometry: !!model.geometry,
          hasPositions: !!(model.geometry?.attributes?.position),
          vertexCount: model.geometry?.attributes?.position?.count || 0
        });
      });
    } catch (error) {
      console.error('生成模型时出错:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportModel = () => {
    if (models.length === 0) return;
    console.log('导出模型:', models);
    ExportService.export3MF(models, 'osm-model.3mf');
  };

  const resetCamera = () => {
    const newPosition = { distance: 100, theta: 0, phi: Math.PI / 4 };
    setCameraPosition(newPosition);
    if (cameraRef.current) {
      updateCameraPosition(cameraRef.current, newPosition);
    }
  };

  const zoomIn = () => {
    setCameraPosition(prev => {
      const newDistance = Math.max(10, prev.distance * 0.8);
      const newPosition = { ...prev, distance: newDistance };
      if (cameraRef.current) {
        updateCameraPosition(cameraRef.current, newPosition);
      }
      return newPosition;
    });
  };

  const zoomOut = () => {
    setCameraPosition(prev => {
      const newDistance = Math.min(500, prev.distance * 1.25);
      const newPosition = { ...prev, distance: newDistance };
      if (cameraRef.current) {
        updateCameraPosition(cameraRef.current, newPosition);
      }
      return newPosition;
    });
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-teal-400" />
          <h3 className="text-lg font-medium text-white">3D预览</h3>
          <span className="text-sm text-gray-400">
            渲染高度: {basicConfig.renderHeight}x
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={zoomIn}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 hover:text-white transition-colors"
            title="放大"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={zoomOut}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 hover:text-white transition-colors"
            title="缩小"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={resetCamera}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 hover:text-white transition-colors"
            title="重置相机"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={generateModel}
            disabled={!osmData || !bbox || isGenerating}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-white font-medium transition-colors"
          >
            {isGenerating ? '生成中...' : '生成模型'}
          </button>
          <button
            onClick={exportModel}
            disabled={models.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-white font-medium transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            导出3MF
          </button>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 relative" style={{ height: '500px' }}>
        <div ref={mountRef} className="w-full h-full" />
        
        {!osmData && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
            <p className="text-gray-400 text-center">
              在地图上选择一个区域开始建模
            </p>
          </div>
        )}
        
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400 mx-auto mb-3"></div>
              <p className="text-gray-300">正在生成3D模型...</p>
              <p className="text-gray-500 text-sm mt-1">这可能需要几秒钟时间</p>
            </div>
          </div>
        )}
      </div>
      
      {models.length > 0 && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">
                已生成 {models.length} 个模型组件
              </p>
              <p className="text-xs text-gray-500 mt-1">
                使用鼠标拖拽旋转视图，滚轮缩放，或使用上方的控制按钮
              </p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>相机距离: {Math.round(cameraPosition.distance)}m</p>
              <p>视角: {Math.round(cameraPosition.theta * 180 / Math.PI)}°</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};