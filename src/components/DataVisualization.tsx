import React, { useMemo } from 'react';
import { OSMData, BoundingBox } from '../types';
import { Database, Home, Loader as Road, Grid as Bridge, Waves, Trees, Mountain } from 'lucide-react';

interface DataVisualizationProps {
  osmData: OSMData | null;
  bbox: BoundingBox | null;
  className?: string;
}

export const DataVisualization: React.FC<DataVisualizationProps> = ({ osmData, bbox, className }) => {
  const analysis = useMemo(() => {
    if (!osmData || !bbox) return null;

    const elements = osmData.elements;
    const stats = {
      buildings: 0,
      roads: 0,
      bridges: 0,
      water: 0,
      vegetation: 0,
      other: 0
    };

    const elementsByType: { [key: string]: any[] } = {
      buildings: [],
      roads: [],
      bridges: [],
      water: [],
      vegetation: [],
      other: []
    };

    elements.forEach(element => {
      if (!element.tags) {
        stats.other++;
        elementsByType.other.push(element);
        return;
      }

      const tags = element.tags;
      
      if (tags.building) {
        stats.buildings++;
        elementsByType.buildings.push(element);
      } else if (tags.highway) {
        stats.roads++;
        elementsByType.roads.push(element);
      } else if (tags.bridge === 'yes') {
        stats.bridges++;
        elementsByType.bridges.push(element);
      } else if (tags.waterway || tags.natural === 'water') {
        stats.water++;
        elementsByType.water.push(element);
      } else if (tags.landuse === 'grass' || tags.landuse === 'forest' || tags.natural === 'wood') {
        stats.vegetation++;
        elementsByType.vegetation.push(element);
      } else {
        stats.other++;
        elementsByType.other.push(element);
      }
    });

    return { stats, elementsByType };
  }, [osmData, bbox]);

  const generateSVGVisualization = () => {
    if (!osmData || !bbox || !analysis) return null;

    const svgWidth = 280;
    const svgHeight = 200;
    const padding = 10;
    
    // 计算坐标转换函数
    const latRange = bbox.north - bbox.south;
    const lonRange = bbox.east - bbox.west;
    
    const latToY = (lat: number) => {
      return padding + ((bbox.north - lat) / latRange) * (svgHeight - 2 * padding);
    };
    
    const lonToX = (lon: number) => {
      return padding + ((lon - bbox.west) / lonRange) * (svgWidth - 2 * padding);
    };

    const elements: JSX.Element[] = [];

    // 绘制不同类型的元素
    osmData.elements.forEach((element, index) => {
      if (!element.geometry || !element.tags) return;

      const geometry = element.geometry;
      const tags = element.tags;

      if (geometry.length === 0) return;

      let color = '#666';
      let strokeWidth = 1;

      if (tags.building) {
        color = '#cbd5e0';
        strokeWidth = 2;
      } else if (tags.highway) {
        color = '#4a5568';
        strokeWidth = 3;
      } else if (tags.bridge === 'yes') {
        color = '#718096';
        strokeWidth = 4;
      } else if (tags.waterway || tags.natural === 'water') {
        color = '#4299e1';
        strokeWidth = 2;
      } else if (tags.landuse === 'grass' || tags.landuse === 'forest' || tags.natural === 'wood') {
        color = '#48bb78';
        strokeWidth = 1;
      }

      if (geometry.length === 1) {
        // 点元素
        const point = geometry[0];
        elements.push(
          <circle
            key={`point-${index}`}
            cx={lonToX(point.lon)}
            cy={latToY(point.lat)}
            r="2"
            fill={color}
          />
        );
      } else if (geometry.length >= 2) {
        // 线或面元素
        const pathData = geometry.map((point, i) => {
          const x = lonToX(point.lon);
          const y = latToY(point.lat);
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        if (tags.building || tags.natural === 'water' || tags.landuse) {
          // 面元素
          elements.push(
            <path
              key={`area-${index}`}
              d={`${pathData} Z`}
              fill={color}
              fillOpacity="0.6"
              stroke={color}
              strokeWidth="1"
            />
          );
        } else {
          // 线元素
          elements.push(
            <path
              key={`line-${index}`}
              d={pathData}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          );
        }
      }
    });

    return (
      <div className="bg-gray-900 rounded-lg p-3 border border-gray-600">
        <h4 className="text-sm font-medium text-white mb-3">区域可视化</h4>
        <svg width={svgWidth} height={svgHeight} className="border border-gray-600 rounded bg-gray-800 w-full">
          {/* 背景网格 */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* 边界框 */}
          <rect
            x={padding}
            y={padding}
            width={svgWidth - 2 * padding}
            height={svgHeight - 2 * padding}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* OSM元素 */}
          {elements}
          
          {/* 坐标标签 */}
          <text x={padding} y={padding - 2} fontSize="8" fill="#9CA3AF">
            {bbox.north.toFixed(4)}, {bbox.west.toFixed(4)}
          </text>
          <text x={svgWidth - padding} y={svgHeight - 2} fontSize="8" fill="#9CA3AF" textAnchor="end">
            {bbox.south.toFixed(4)}, {bbox.east.toFixed(4)}
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-4">
        <Database className="h-5 w-5 text-green-400" />
        <h3 className="text-lg font-medium text-white">数据分析</h3>
      </div>
      
      {!osmData ? (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 h-full flex items-center justify-center">
          <p className="text-gray-400 text-center text-sm">
            选择区域后将显示数据分析结果
          </p>
        </div>
      ) : (
        <div className="space-y-4 h-full overflow-y-auto">
          {/* SVG可视化 */}
          {generateSVGVisualization()}

          {/* 统计信息 */}
          {analysis && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-medium text-white mb-3">元素统计</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-blue-400" />
                    <span className="text-gray-300">建筑</span>
                  </div>
                  <span className="text-white font-medium">{analysis.stats.buildings}</span>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Road className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-300">道路</span>
                  </div>
                  <span className="text-white font-medium">{analysis.stats.roads}</span>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Bridge className="h-4 w-4 text-purple-400" />
                    <span className="text-gray-300">桥梁</span>
                  </div>
                  <span className="text-white font-medium">{analysis.stats.bridges}</span>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Waves className="h-4 w-4 text-blue-500" />
                    <span className="text-gray-300">水体</span>
                  </div>
                  <span className="text-white font-medium">{analysis.stats.water}</span>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Trees className="h-4 w-4 text-green-500" />
                    <span className="text-gray-300">植被</span>
                  </div>
                  <span className="text-white font-medium">{analysis.stats.vegetation}</span>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Mountain className="h-4 w-4 text-yellow-500" />
                    <span className="text-gray-300">其他</span>
                  </div>
                  <span className="text-white font-medium">{analysis.stats.other}</span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-600">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">总计</span>
                  <span className="text-white font-bold">{osmData.elements.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* 图例 */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-medium text-white mb-3">图例</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-300 rounded"></div>
                <span className="text-gray-400">建筑</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 bg-gray-600 rounded"></div>
                <span className="text-gray-400">道路</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 bg-gray-500 rounded"></div>
                <span className="text-gray-400">桥梁</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded opacity-60"></div>
                <span className="text-gray-400">水体</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded opacity-60"></div>
                <span className="text-gray-400">植被</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-blue-500 border-dashed rounded"></div>
                <span className="text-gray-400">选择区域</span>
              </div>
            </div>
          </div>

          {/* 区域信息 */}
          {bbox && (
            <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-3">
              <h4 className="text-green-300 text-sm font-medium mb-2">选择区域信息</h4>
              <div className="text-xs text-green-400 space-y-1">
                <p>坐标: {bbox.south.toFixed(4)}, {bbox.west.toFixed(4)} 到 {bbox.north.toFixed(4)}, {bbox.east.toFixed(4)}</p>
                <p>
                  大小: {((bbox.east - bbox.west) * 111320 * Math.cos(bbox.north * Math.PI / 180)).toFixed(0)}m × {((bbox.north - bbox.south) * 111320).toFixed(0)}m
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};