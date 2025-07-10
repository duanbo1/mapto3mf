import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Preview3D } from '../components/Preview3D';
import { BoundingBox, ModelConfig, BasicConfig, OSMData } from '../types';
import { ArrowLeft, Settings, Eye } from 'lucide-react';

export const PreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [osmData, setOsmData] = useState<OSMData | null>(null);
  const [selectedBBox, setSelectedBBox] = useState<BoundingBox | null>(null);
  const [basicConfig, setBasicConfig] = useState<BasicConfig | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);

  useEffect(() => {
    // 从 sessionStorage 获取数据
    const storedOsmData = sessionStorage.getItem('osmData');
    const storedBBox = sessionStorage.getItem('selectedBBox');
    const storedBasicConfig = sessionStorage.getItem('basicConfig');
    const storedModelConfig = sessionStorage.getItem('modelConfig');

    if (storedOsmData && storedBBox && storedBasicConfig && storedModelConfig) {
      setOsmData(JSON.parse(storedOsmData));
      setSelectedBBox(JSON.parse(storedBBox));
      setBasicConfig(JSON.parse(storedBasicConfig));
      setModelConfig(JSON.parse(storedModelConfig));
    } else {
      // 如果没有数据，返回主页
      navigate('/');
    }
  }, [navigate]);

  if (!osmData || !selectedBBox || !basicConfig || !modelConfig) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">加载预览数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 头部 */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-600 rounded-lg">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">3D模型预览</h1>
                  <p className="text-gray-400 text-sm">
                    区域: {selectedBBox.south.toFixed(4)}, {selectedBBox.west.toFixed(4)} 到 {selectedBBox.north.toFixed(4)}, {selectedBBox.east.toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>{osmData.elements.length} 个OSM元素</span>
              </div>
              <div className="flex items-center gap-2">
                <span>渲染高度: {basicConfig.renderHeight}x</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 3D预览区域 */}
      <main className="container mx-auto px-6 py-6">
        <div className="h-[calc(100vh-140px)]">
          <Preview3D
            osmData={osmData}
            basicConfig={basicConfig}
            modelConfig={modelConfig}
            bbox={selectedBBox}
            className="h-full"
          />
        </div>
      </main>
    </div>
  );
};