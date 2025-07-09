import React, { useState } from 'react';
import { Mountain } from 'lucide-react';
import MapSelector from './components/MapSelector';
import Model3DPreview from './components/Model3DPreview';
import L from 'leaflet';

function App() {
  const [selectedBounds, setSelectedBounds] = useState<L.LatLngBounds | null>(null);
  const [shapeData, setShapeData] = useState<any>(null);

  const handleAreaSelected = (bounds: L.LatLngBounds, shape: any) => {
    setSelectedBounds(bounds);
    setShapeData(shape);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <div className="flex items-center">
              <Mountain className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Map2Model</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            城市地图转3D模型工具
          </h1>
          <p className="text-lg text-gray-600">
            搜索城市位置，选择不同形状的区域，生成彩色分区的城市3D模型
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Map Selection */}
          <div className="bg-white rounded-lg border border-gray-300 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">选择地图区域</h2>
            <MapSelector 
              onAreaSelected={handleAreaSelected}
              selectedBounds={selectedBounds}
            />
          </div>

          {/* 3D Preview */}
          <Model3DPreview bounds={selectedBounds} shapeData={shapeData} />
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">使用说明</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>使用搜索框快速定位到目标城市或地区</li>
            <li>选择合适的形状工具（矩形、圆形或多边形）</li>
            <li>在地图上绘制选择区域</li>
            <li>在右侧3D预览窗口中生成城市模型</li>
            <li>查看不同功能区域的彩色分布</li>
            <li>下载3MF文件用于3D打印</li>
          </ol>
        </div>
      </main>
    </div>
  );
}

export default App;