import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { ModelingService } from "../services/modelingService";
import { ExportService } from "../services/exportService";
import {
  OSMData,
  ModelConfig,
  BasicConfig,
  BoundingBox,
  Model3D,
} from "../types";
import { Eye, Download, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

interface Preview3DProps {
  osmData: OSMData | null;
  basicConfig: BasicConfig;
  modelConfig: ModelConfig;
  bbox: BoundingBox | null;
  selectedArea?: any; // 完整的选择区域信息
  className?: string;
}

export const Preview3D: React.FC<Preview3DProps> = ({
  osmData,
  basicConfig,
  modelConfig,
  bbox,
  selectedArea,
  className,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelingServiceRef = useRef<ModelingService | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const controlsRef = useRef<any>(null);
  const [models, setModels] = useState<Model3D[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [modelStats, setModelStats] = useState({
    buildings: 0,
    roads: 0,
    bridges: 0,
    water: 0,
    vegetation: 0,
    totalVertices: 0,
    totalTriangles: 0,
  });
  const [cameraPosition, setCameraPosition] = useState({
    distance: 100,
    theta: 0,
    phi: Math.PI / 4,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
  });

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
      powerPreference: "high-performance",
    });
    renderer.setSize(400, 300);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // 超强全局光照系统 - 确保场景特别明亮，无黑暗区域
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // 强化环境光，使用白光
    scene.add(ambientLight);

    // 主光源 - 中央顶部强光，覆盖整个场景
    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
    mainLight.position.set(0, 500, 0); // 正上方
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 4096;
    mainLight.shadow.mapSize.height = 4096;
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 1000;
    mainLight.shadow.camera.left = -400;
    mainLight.shadow.camera.right = 400;
    mainLight.shadow.camera.top = 400;
    mainLight.shadow.camera.bottom = -400;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);

    // 天空光 - 强化天空散射效果
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.0);
    scene.add(hemisphereLight);

    // 360度环绕光照系统 - 消除所有阴影死角
    const lightPositions = [
      [300, 200, 300], // 东北
      [-300, 200, 300], // 西北
      [300, 200, -300], // 东南
      [-300, 200, -300], // 西南
      [0, 200, 400], // 北
      [0, 200, -400], // 南
      [400, 200, 0], // 东
      [-400, 200, 0], // 西
    ];

    lightPositions.forEach((pos, index) => {
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
      fillLight.position.set(pos[0], pos[1], pos[2]);
      scene.add(fillLight);
    });

    // 底部反射光 - 模拟地面反射
    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.5);
    bottomLight.position.set(0, -100, 0);
    scene.add(bottomLight);

    // 点光源阵列 - 确保局部区域充分照明
    const pointLightPositions = [
      [0, 100, 0], // 中心
      [200, 100, 200], // 四角
      [-200, 100, 200],
      [200, 100, -200],
      [-200, 100, -200],
    ];

    pointLightPositions.forEach((pos) => {
      const pointLight = new THREE.PointLight(0xffffff, 1.0, 800);
      pointLight.position.set(pos[0], pos[1], pos[2]);
      scene.add(pointLight);
    });

    // 改进的控制器 - 支持Ctrl+拖拽和更好的交互
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let ctrlPressed = false;

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return; // 只处理左键
      mouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
      ctrlPressed = event.ctrlKey;
      renderer.domElement.style.cursor = ctrlPressed ? "move" : "grabbing";
    };

    const onMouseUp = () => {
      mouseDown = false;
      ctrlPressed = false;
      renderer.domElement.style.cursor = "grab";
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!mouseDown || !cameraRef.current) {
        // 鼠标悬停时显示可交互状态
        if (event.ctrlKey) {
          renderer.domElement.style.cursor = "grab";
        } else {
          renderer.domElement.style.cursor = "default";
        }
        return;
      }

      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      setCameraPosition((prev) => {
        if (ctrlPressed) {
          // Ctrl+鼠标左键：平移视野
          const panSensitivity = 0.5;
          const newTargetX = prev.targetX - deltaX * panSensitivity;
          const newTargetY = prev.targetY + deltaY * panSensitivity;

          const newPosition = {
            ...prev,
            targetX: newTargetX,
            targetY: newTargetY,
          };
          updateCameraPosition(cameraRef.current!, newPosition);
          return newPosition;
        } else {
          // 普通拖拽：旋转视角
          const rotateSensitivity = 0.01;
          const newTheta = prev.theta - deltaX * rotateSensitivity;
          const newPhi = Math.max(
            0.1,
            Math.min(Math.PI - 0.1, prev.phi + deltaY * rotateSensitivity)
          );

          const newPosition = { ...prev, theta: newTheta, phi: newPhi };
          updateCameraPosition(cameraRef.current!, newPosition);
          return newPosition;
        }
      });

      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && !ctrlPressed) {
        renderer.domElement.style.cursor = "grab";
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!event.ctrlKey && ctrlPressed) {
        renderer.domElement.style.cursor = "default";
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!cameraRef.current) return;

      setCameraPosition((prev) => {
        const scale = event.deltaY > 0 ? 1.1 : 0.9;
        const newDistance = Math.max(10, Math.min(500, prev.distance * scale));

        const newPosition = { ...prev, distance: newDistance };
        updateCameraPosition(cameraRef.current!, newPosition);
        return newPosition;
      });
    };

    // 设置初始光标样式
    renderer.domElement.style.cursor = "grab";

    // 注册事件监听器
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("contextmenu", (e) =>
      e.preventDefault()
    ); // 禁用右键菜单
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // 初始化建模服务
    modelingServiceRef.current = new ModelingService(scene);

    mountRef.current.appendChild(renderer.domElement);

    // 优化的动画循环 - 减少不必要的渲染
    let lastRenderTime = 0;
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      animationIdRef.current = requestAnimationFrame(animate);

      // 限制帧率以减少GPU负载
      if (currentTime - lastRenderTime < frameInterval) {
        return;
      }

      if (rendererRef.current && cameraRef.current && sceneRef.current) {
        // 只在需要时渲染
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        lastRenderTime = currentTime;
      }
    };
    animate(0);

    // 处理窗口大小变化
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current)
        return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("contextmenu", (e) =>
        e.preventDefault()
      );
      if (
        mountRef.current &&
        renderer.domElement &&
        mountRef.current.contains(renderer.domElement)
      ) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const updateCameraPosition = (
    camera: THREE.PerspectiveCamera,
    position: typeof cameraPosition
  ) => {
    const spherical = new THREE.Spherical(
      position.distance,
      position.phi,
      position.theta
    );
    camera.position.setFromSpherical(spherical);
    camera.position.add(
      new THREE.Vector3(position.targetX, position.targetY, position.targetZ)
    );
    camera.lookAt(position.targetX, position.targetY, position.targetZ);
  };

  const generateModel = async () => {
    if (!osmData || !bbox || !modelingServiceRef.current) return;

    setIsGenerating(true);
    setModelStats({
      buildings: 0,
      roads: 0,
      bridges: 0,
      water: 0,
      vegetation: 0,
      totalVertices: 0,
      totalTriangles: 0,
    });

    try {
      const generatedModels = await modelingServiceRef.current.generateModels(
        osmData,
        basicConfig,
        modelConfig,
        bbox,
        selectedArea
      );
      setModels(generatedModels);

      // 获取并设置模型统计信息
      const stats = modelingServiceRef.current.getModelStats();
      setModelStats(stats);

      console.log("生成的模型数量:", generatedModels.length);
      console.log("模型统计:", stats);

      generatedModels.forEach((model, index) => {
        console.log(`模型 ${index}:`, {
          id: model.id,
          type: model.type,
          hasGeometry: !!model.geometry,
          hasPositions: !!model.geometry?.attributes?.position,
          vertexCount: model.geometry?.attributes?.position?.count || 0,
        });
      });
    } catch (error) {
      console.error("生成模型时出错:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportModel = async (format: "stl" | "3mf") => {
    if (models.length === 0) return;

    setIsExporting(true);
    setExportProgress(0);
    setShowExportDialog(false);

    try {
      console.log(
        `开始导出${format.toUpperCase()}模型:`,
        models.length,
        "个模型"
      );

      // 使用进度回调
      await new Promise<void>((resolve, reject) => {
        try {
          if (format === "3mf") {
            ExportService.export3MF(models, "osm-model.3mf", (progress) => {
              setExportProgress(Math.round(progress * 100));
            });
          } else {
            ExportService.exportSTL(models, "osm-model.stl", (progress) => {
              setExportProgress(Math.round(progress * 100));
            });
          }

          // 模拟最终完成
          setTimeout(() => {
            setExportProgress(100);
            resolve();
          }, 500);
        } catch (error) {
          reject(error);
        }
      });

      console.log(`${format.toUpperCase()}模型导出完成`);
    } catch (error) {
      console.error("导出模型时出错:", error);
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
    }
  };

  const resetCamera = () => {
    const newPosition = {
      distance: 100,
      theta: 0,
      phi: Math.PI / 4,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
    };
    setCameraPosition(newPosition);
    if (cameraRef.current) {
      updateCameraPosition(cameraRef.current, newPosition);
    }
  };

  const zoomIn = () => {
    setCameraPosition((prev) => {
      const newDistance = Math.max(10, prev.distance * 0.8);
      const newPosition = { ...prev, distance: newDistance };
      if (cameraRef.current) {
        updateCameraPosition(cameraRef.current, newPosition);
      }
      return newPosition;
    });
  };

  const zoomOut = () => {
    setCameraPosition((prev) => {
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
            {isGenerating ? "生成中..." : "生成模型"}
          </button>
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={models.length === 0 || isExporting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-white font-medium transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {isExporting ? `导出中... ${exportProgress}%` : "导出模型"}
          </button>
        </div>
      </div>

      <div
        className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 relative"
        style={{ height: "500px" }}
      >
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
                拖拽旋转视图 • Ctrl+拖拽平移视野 • 滚轮缩放 • 或使用上方按钮
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-400">
                <div>建筑: {modelStats.buildings}</div>
                <div>道路: {modelStats.roads}</div>
                <div>桥梁: {modelStats.bridges}</div>
                <div>水体: {modelStats.water}</div>
                <div>植被: {modelStats.vegetation}</div>
                <div>顶点: {modelStats.totalVertices.toLocaleString()}</div>
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>相机距离: {Math.round(cameraPosition.distance)}m</p>
              <p>视角: {Math.round((cameraPosition.theta * 180) / Math.PI)}°</p>
            </div>
          </div>
        </div>
      )}

      {isExporting && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <div className="flex-1">
              <p className="text-sm text-gray-300">正在导出模型...</p>
              <div className="mt-2 bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
            </div>
            <span className="text-sm text-gray-400">{exportProgress}%</span>
          </div>
        </div>
      )}

      {/* 导出格式选择对话框 */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
            <h3 className="text-lg font-semibold text-white mb-4">
              选择导出格式
            </h3>
            <p className="text-gray-300 text-sm mb-6">
              请选择您希望导出的3D模型格式：
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => exportModel("stl")}
                className="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors border border-gray-600 hover:border-gray-500"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">STL 格式</h4>
                    <p className="text-gray-400 text-sm mt-1">
                      标准3D打印格式，适用于大多数3D打印机
                    </p>
                  </div>
                  <div className="text-blue-400 text-sm font-medium">推荐</div>
                </div>
              </button>

              <button
                onClick={() => exportModel("3mf")}
                className="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors border border-gray-600 hover:border-gray-500"
              >
                <div>
                  <h4 className="text-white font-medium">3MF 格式</h4>
                  <p className="text-gray-400 text-sm mt-1">
                    微软3D制造格式，支持颜色和材质信息
                  </p>
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExportDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-white transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
