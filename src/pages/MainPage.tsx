import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapSelector } from "../components/MapSelector";
import { Preview3D } from "../components/Preview3D";
import { ModelConfigPanel } from "../components/ModelConfigPanel";
import { OverpassService } from "../services/overpassService";
import { BoundingBox, ModelConfig, BasicConfig, OSMData } from "../types";
import { Map, Eye, Settings, Loader, AlertTriangle, X } from "lucide-react";
import { initialBasicConfig, initialModelConfig } from "./config";

export const MainPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedBBox, setSelectedBBox] = useState<BoundingBox | null>(null);
  const [selectedArea, setSelectedArea] = useState<any>(null); // 完整的选择区域信息
  const [osmData, setOsmData] = useState<OSMData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "preview">("map");
  const [showSettings, setShowSettings] = useState(false);

  // 地图状态持久化
  const [mapState, setMapState] = useState({
    center: [116.3953, 39.9067] as [number, number],
    zoom: 16,
    bearing: 0,
    pitch: 0,
  });

  const [basicConfig, setBasicConfig] =
    useState<BasicConfig>(initialBasicConfig);
  const [modelConfig, setModelConfig] =
    useState<ModelConfig>(initialModelConfig);

  const handleAreaSelected = useCallback(
    async (bbox: BoundingBox, selectionInfo?: any) => {
      setSelectedBBox(bbox);
      setSelectedArea(selectionInfo || { bbox, shape: "rectangle" }); // 保存完整选择信息
      setIsLoading(true);
      setError(null);
      setOsmData(null);
      // 不自动切换到预览界面，保持在地图界面
      // setActiveTab("map");

      setBasicConfig((prev) => ({
        ...prev,
        coordinateSystem: {
          ...prev.coordinateSystem,
          centerPoint: [
            (bbox.east + bbox.west) / 2,
            (bbox.north + bbox.south) / 2,
          ],
        },
      }));

      try {
        const data = await OverpassService.queryArea(bbox);
        setOsmData(data);
        // 移除自动跳转到预览界面的逻辑，让用户自己选择何时查看预览
        // setActiveTab("preview");
      } catch (err) {
        setError("获取数据失败，请重试");
        console.error("获取OSM数据时出错:", err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handlePreview = useCallback(() => {
    if (osmData && selectedBBox) {
      sessionStorage.setItem("osmData", JSON.stringify(osmData));
      sessionStorage.setItem("selectedBBox", JSON.stringify(selectedBBox));
      sessionStorage.setItem("selectedArea", JSON.stringify(selectedArea)); // 保存完整选择信息
      sessionStorage.setItem("basicConfig", JSON.stringify(basicConfig));
      sessionStorage.setItem("modelConfig", JSON.stringify(modelConfig));
      navigate("/preview");
    }
  }, [navigate, osmData, selectedBBox, selectedArea, basicConfig, modelConfig]);

  const status = osmData ? "loaded" : selectedBBox ? "selected" : "waiting";
  const statusColor = {
    loaded: "bg-green-500",
    selected: "bg-yellow-500",
    waiting: "bg-gray-500",
  }[status];
  const statusText = {
    loaded: "数据已加载",
    selected: "区域已选择",
    waiting: "选择区域开始",
  }[status];

  return (
    <div className="h-[120vh] w-full bg-slate-900 text-white relative overflow-hidden">
      {/* 顶部工具栏 - 紧凑设计 */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700">
        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded">
              <Map className="h-4 w-4" />
            </div>
            <h1 className="text-base font-semibold">地图3D建模器</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* 状态指示 */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded text-xs">
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`}></div>
              <span>{statusText}</span>
            </div>

            {/* 切换按钮 */}
            <div className="flex bg-slate-800 rounded p-0.5">
              <button
                onClick={() => setActiveTab("map")}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  activeTab === "map"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                地图
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                disabled={!osmData || !selectedBBox}
                className={`px-2 py-1 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === "preview"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                3D预览
              </button>
            </div>

            {/* 设置按钮 */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            >
              <Settings className="h-3 w-3" />
            </button>

            {/* 全屏预览按钮 */}
            {osmData && selectedBBox && (
              <button
                onClick={handlePreview}
                className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center gap-1.5 text-xs"
              >
                <Eye className="h-3 w-3" />
                <span>全屏</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 主要内容区域 - 占据120vh */}
      <div className="pt-10 h-full relative">
        {/* 加载状态 */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-40">
            <div className="bg-slate-800 p-6 rounded-xl flex flex-col items-center gap-3">
              <Loader className="animate-spin h-8 w-8 text-blue-400" />
              <p className="text-sm text-slate-300">正在获取地图数据...</p>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="absolute inset-0 bg-red-900/20 flex items-center justify-center z-40">
            <div className="bg-slate-800 p-6 rounded-xl flex flex-col items-center gap-3 max-w-md">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="text-center text-slate-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {/* Canvas区域 - 全屏 */}
        <div className="h-full w-full">
          {activeTab === "map" ? (
            <MapSelector
              onAreaSelected={handleAreaSelected}
              className="maplibregl-map h-full w-full"
              mapState={mapState}
              onMapStateChange={setMapState}
            />
          ) : (
            <Preview3D
              osmData={osmData}
              basicConfig={basicConfig}
              modelConfig={modelConfig}
              bbox={selectedBBox}
              selectedArea={selectedArea}
              className="h-full w-full"
            />
          )}
        </div>
      </div>

      {/* 设置面板 - 侧边滑出 */}
      {showSettings && (
        <div className="absolute top-0 right-0 h-full w-80 bg-slate-800/95 backdrop-blur-sm border-l border-slate-700 z-50 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">设置</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 模型配置面板 */}
            <ModelConfigPanel config={modelConfig} onChange={setModelConfig} />
          </div>
        </div>
      )}
    </div>
  );
};
