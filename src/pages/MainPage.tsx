import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapSelector } from '../components/MapSelector';
import { ConfigPanel } from '../components/ConfigPanel';
import { DataVisualization } from '../components/DataVisualization';
import { Preview3D } from '../components/Preview3D';
import { OverpassService } from '../services/overpassService';
import { BoundingBox, ModelConfig, BasicConfig, OSMData } from '../types';
import { Map, Settings, Eye, AlertCircle, ArrowRight } from 'lucide-react';

export const MainPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedBBox, setSelectedBBox] = useState<BoundingBox | null>(null);
  const [osmData, setOsmData] = useState<OSMData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'preview'>('map');
  
  const [basicConfig, setBasicConfig] = useState<BasicConfig>({
    renderHeight: 1.0,
    baseColor: '#68d391',
    showLabels: true,
    labelConfig: {
      enabled: true,
      fontSize: 12,
      color: '#ffffff',
      fontFamily: 'Arial'
    },
    tileConfig: {
      maxZoom: 18,
      minZoom: 10,
      tileSize: 256
    },
    coordinateSystem: {
      projection: 'mercator',
      centerPoint: [0, 0],
      scale: 1.0
    }
  });

  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    roads: {
      enabled: true,
      height: 0.2,
      width: 4,
      color: '#4a5568',
      types: {
        motorway: { width: 12, color: '#2d3748', height: 0.3 },
        trunk: { width: 10, color: '#4a5568', height: 0.25 },
        primary: { width: 8, color: '#718096', height: 0.2 },
        secondary: { width: 6, color: '#a0aec0', height: 0.15 },
        residential: { width: 4, color: '#cbd5e0', height: 0.1 },
        footway: { width: 1.5, color: '#e2e8f0', height: 0.05 }
      }
    },
    bridges: {
      enabled: true,
      height: 1.5,
      width: 6,
      color: '#718096',
      pillarConfig: {
        enabled: true,
        radius: 0.5,
        color: '#8B7355',
        spacing: 20
      }
    },
    buildings: {
      enabled: true,
      baseHeight: 3,
      maxHeight: 50,
      color: '#cbd5e0',
      roofConfig: {
        enabled: true,
        type: 'flat',
        color: '#a0aec0'
      },
      windowConfig: {
        enabled: true,
        color: '#4299e1',
        spacing: 2
      }
    },
    terrain: {
      enabled: true,
      baseHeight: 2,
      elevationScale: 1,
      color: '#68d391',
      textureConfig: {
        enabled: true,
        type: 'grass',
        scale: 1
      }
    },
    vegetation: {
      enabled: true,
      height: 1.5,
      density: 1,
      color: '#48bb78',
      treeConfig: {
        enabled: true,
        types: ['oak', 'pine', 'birch'],
        randomness: 0.5
      }
    },
    water: {
      enabled: true,
      height: 0.1,
      color: '#4299e1',
      waveConfig: {
        enabled: true,
        amplitude: 0.1,
        frequency: 1
      }
    }
  });

  const handleAreaSelected = async (bbox: BoundingBox) => {
    setSelectedBBox(bbox);
    setIsLoading(true);
    setError(null);
    
    // 更新坐标系统中心点
    setBasicConfig(prev => ({
      ...prev,
      coordinateSystem: {
        ...prev.coordinateSystem,
        centerPoint: [(bbox.east + bbox.west) / 2, (bbox.north + bbox.south) / 2]
      }
    }));
    
    try {
      const data = await OverpassService.queryArea(bbox);
      setOsmData(data);
    } catch (err) {
      setError('从Overpass API获取数据失败，请重试。');
      console.error('获取OSM数据时出错:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = () => {
    if (osmData && selectedBBox) {
      // 将数据存储到 sessionStorage 以便在预览页面使用
      sessionStorage.setItem('osmData', JSON.stringify(osmData));
      sessionStorage.setItem('selectedBBox', JSON.stringify(selectedBBox));
      sessionStorage.setItem('basicConfig', JSON.stringify(basicConfig));
      sessionStorage.setItem('modelConfig', JSON.stringify(modelConfig));
      navigate('/preview');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 头部 */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Map className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Overpass 3D建模器</h1>
                <p className="text-gray-400 text-sm">从OpenStreetMap数据生成3D模型</p>
              </div>
            </div>
            
            {osmData && selectedBBox && (
              <button
                onClick={handlePreview}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                <Eye className="h-5 w-5" />
                全屏预览
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
          {/* 配置面板 */}
          <div className="lg:col-span-1">
            <ConfigPanel
              basicConfig={basicConfig}
              modelConfig={modelConfig}
              onBasicConfigChange={setBasicConfig}
              onModelConfigChange={setModelConfig}
              className="h-full"
            />
          </div>

          {/* 主要工作区域 */}
          <div className="lg:col-span-3 flex flex-col">
            {/* 标签页切换 */}
            <div className="flex mb-4 bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('map')}
                className={`flex-1 py-3 px-6 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'map' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Map className="h-4 w-4" />
                地图选择
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                disabled={!osmData || !selectedBBox}
                className={`flex-1 py-3 px-6 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'preview' 
                    ? 'bg-teal-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                <Eye className="h-4 w-4" />
                3D预览
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              {activeTab === 'map' ? (
                <div className="h-full flex">
                  {/* 地图区域 */}
                  <div className="flex-1 h-full">
                    <MapSelector
                      onAreaSelected={handleAreaSelected}
                      className="h-full"
                    />
                  </div>
                  
                  {/* 数据可视化侧边栏 */}
                  <div className="w-80 border-l border-gray-700 h-full overflow-hidden">
                    <DataVisualization
                      osmData={osmData}
                      bbox={selectedBBox}
                      className="h-full p-4"
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full">
                  <Preview3D
                    osmData={osmData}
                    basicConfig={basicConfig}
                    modelConfig={modelConfig}
                    bbox={selectedBBox}
                    className="h-full p-4"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 状态消息 */}
        {isLoading && (
          <div className="fixed bottom-6 right-6 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>正在获取地图数据...</span>
          </div>
        )}

        {error && (
          <div className="fixed bottom-6 right-6 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        )}

        {osmData && (
          <div className="fixed bottom-6 left-6 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
            <Eye className="h-5 w-5" />
            <span>数据已加载: {osmData.elements.length} 个元素</span>
          </div>
        )}
      </main>
    </div>
  );
};