import React, { useState } from "react";
import { ModelConfig } from "../types";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";

interface ModelConfigPanelProps {
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
  className?: string;
}

export const ModelConfigPanel: React.FC<ModelConfigPanelProps> = ({
  config,
  onChange,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "global" | "buildings" | "roads" | "vegetation" | "water"
  >("global");

  const updateConfig = (section: keyof ModelConfig, updates: any) => {
    onChange({
      ...config,
      [section]: {
        ...config[section],
        ...updates,
      },
    });
  };

  const updateNestedConfig = (
    section: keyof ModelConfig,
    subsection: string,
    updates: any
  ) => {
    onChange({
      ...config,
      [section]: {
        ...config[section],
        [subsection]: {
          ...(config[section] as any)[subsection],
          ...updates,
        },
      },
    });
  };

  if (!isOpen) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
        >
          <Settings size={20} />
          <span className="font-medium">模型配置</span>
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-blue-600" />
          <span className="font-medium text-gray-800">模型配置</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {/* 标签页 */}
      <div className="flex border-b">
        {[
          { key: "global", label: "全局" },
          { key: "buildings", label: "建筑" },
          { key: "roads", label: "道路" },
          { key: "vegetation", label: "植被" },
          { key: "water", label: "水体" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 配置内容 */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {activeTab === "global" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                地图尺寸: {config.global?.mapSize || 1}
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={config.global?.mapSize || 1}
                onChange={(e) =>
                  updateConfig("global", {
                    mapSize: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                全局缩放: {config.global?.scale || 1}
              </label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={config.global?.scale || 1}
                onChange={(e) =>
                  updateConfig("global", { scale: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                基础颜色
              </label>
              <input
                type="color"
                value={config.global?.baseColor || "#f0f0f0"}
                onChange={(e) =>
                  updateConfig("global", { baseColor: e.target.value })
                }
                className="w-full h-10 rounded border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                光照强度: {config.global?.lightingIntensity || 1}
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={config.global?.lightingIntensity || 1}
                onChange={(e) =>
                  updateConfig("global", {
                    lightingIntensity: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
          </div>
        )}

        {activeTab === "buildings" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.buildings.enabled}
                onChange={(e) =>
                  updateConfig("buildings", { enabled: e.target.checked })
                }
                className="rounded"
              />
              <label className="text-sm font-medium text-gray-700">
                启用建筑
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                建筑缩放: {config.buildings.scale || 1}
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={config.buildings.scale || 1}
                onChange={(e) =>
                  updateConfig("buildings", {
                    scale: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最小建筑高度: {config.buildings.minHeight || 3}m
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={config.buildings.minHeight || 3}
                onChange={(e) =>
                  updateConfig("buildings", {
                    minHeight: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                忽略小于 {config.buildings.ignoreSmaller || 10}m² 的建筑
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={config.buildings.ignoreSmaller || 10}
                onChange={(e) =>
                  updateConfig("buildings", {
                    ignoreSmaller: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                建筑颜色
              </label>
              <input
                type="color"
                value={config.buildings.color}
                onChange={(e) =>
                  updateConfig("buildings", { color: e.target.value })
                }
                className="w-full h-10 rounded border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                细节等级
              </label>
              <select
                value={config.buildings.detailLevel || "medium"}
                onChange={(e) =>
                  updateConfig("buildings", { detailLevel: e.target.value })
                }
                className="w-full p-2 border rounded"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === "roads" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.roads.enabled}
                onChange={(e) =>
                  updateConfig("roads", { enabled: e.target.checked })
                }
                className="rounded"
              />
              <label className="text-sm font-medium text-gray-700">
                启用道路
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                道路缩放: {config.roads.scale || 1}
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={config.roads.scale || 1}
                onChange={(e) =>
                  updateConfig("roads", { scale: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                道路高度: {config.roads.height}m
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={config.roads.height}
                onChange={(e) =>
                  updateConfig("roads", { height: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                道路颜色
              </label>
              <input
                type="color"
                value={config.roads.color}
                onChange={(e) =>
                  updateConfig("roads", { color: e.target.value })
                }
                className="w-full h-10 rounded border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                纹理类型
              </label>
              <select
                value={config.roads.texture?.type || "asphalt"}
                onChange={(e) =>
                  updateNestedConfig("roads", "texture", {
                    type: e.target.value,
                  })
                }
                className="w-full p-2 border rounded"
              >
                <option value="asphalt">沥青</option>
                <option value="concrete">混凝土</option>
                <option value="gravel">碎石</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === "vegetation" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.vegetation.enabled}
                onChange={(e) =>
                  updateConfig("vegetation", { enabled: e.target.checked })
                }
                className="rounded"
              />
              <label className="text-sm font-medium text-gray-700">
                启用植被
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                植被缩放: {config.vegetation.scale || 1}
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={config.vegetation.scale || 1}
                onChange={(e) =>
                  updateConfig("vegetation", {
                    scale: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                植被高度: {config.vegetation.height}m
              </label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={config.vegetation.height}
                onChange={(e) =>
                  updateConfig("vegetation", {
                    height: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最小区域面积: {config.vegetation.minArea || 5}m²
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={config.vegetation.minArea || 5}
                onChange={(e) =>
                  updateConfig("vegetation", {
                    minArea: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                植被颜色
              </label>
              <input
                type="color"
                value={config.vegetation.color}
                onChange={(e) =>
                  updateConfig("vegetation", { color: e.target.value })
                }
                className="w-full h-10 rounded border"
              />
            </div>
          </div>
        )}

        {activeTab === "water" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.water.enabled}
                onChange={(e) =>
                  updateConfig("water", { enabled: e.target.checked })
                }
                className="rounded"
              />
              <label className="text-sm font-medium text-gray-700">
                启用水体
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                水体缩放: {config.water.scale || 1}
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={config.water.scale || 1}
                onChange={(e) =>
                  updateConfig("water", { scale: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                水体高度: {config.water.height}m
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={config.water.height}
                onChange={(e) =>
                  updateConfig("water", { height: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                水体颜色
              </label>
              <input
                type="color"
                value={config.water.color}
                onChange={(e) =>
                  updateConfig("water", { color: e.target.value })
                }
                className="w-full h-10 rounded border"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
