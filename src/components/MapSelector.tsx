import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BoundingBox } from '../types';
import { MapPin, Square, Crosshair } from 'lucide-react';

interface MapSelectorProps {
  onAreaSelected: (bbox: BoundingBox) => void;
  className?: string;
}

export const MapSelector: React.FC<MapSelectorProps> = ({ onAreaSelected, className }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedArea, setSelectedArea] = useState<BoundingBox | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionBox = useRef<maplibregl.Marker | null>(null);

  // 预设的一些城市区域
  const presetAreas = [
    {
      name: '北京天安门广场',
      bbox: { north: 39.9092, south: 39.9042, east: 116.3978, west: 116.3928 },
      center: [116.3953, 39.9067]
    },
    {
      name: '上海外滩',
      bbox: { north: 31.2420, south: 31.2370, east: 121.4950, west: 121.4900 },
      center: [121.4925, 31.2395]
    },
    {
      name: '广州塔周边',
      bbox: { north: 23.1090, south: 23.1040, east: 113.3240, west: 113.3190 },
      center: [113.3215, 23.1065]
    },
    {
      name: '深圳市民中心',
      bbox: { north: 22.5470, south: 22.5420, east: 114.0620, west: 114.0570 },
      center: [114.0595, 22.5445]
    },
    {
      name: '西湖断桥',
      bbox: { north: 30.2599, south: 30.2549, east: 120.1499, west: 120.1449 },
      center: [120.1474, 30.2574]
    }
  ];

  useEffect(() => {
    if (!mapContainer.current) return;

    // 初始化地图
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm'
          }
        ]
      },
      center: [116.3953, 39.9067], // 北京天安门
      zoom: 16,
      pitch: 0,
      bearing: 0
    });

    // 添加导航控件
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // 添加比例尺
    map.current.addControl(new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    }), 'bottom-left');

    let startPoint: [number, number] | null = null;
    let currentRectangle: string | null = null;

    // 鼠标按下开始选择
    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (!isSelecting) return;
      
      startPoint = [e.lngLat.lng, e.lngLat.lat];
      map.current!.getCanvas().style.cursor = 'crosshair';
      
      // 阻止地图拖拽
      map.current!.dragPan.disable();
    };

    // 鼠标移动更新选择框
    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!isSelecting || !startPoint) return;

      const endPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      // 移除之前的矩形
      if (currentRectangle && map.current!.getSource('selection-area')) {
        map.current!.removeLayer('selection-fill');
        map.current!.removeLayer('selection-outline');
        map.current!.removeSource('selection-area');
      }

      // 创建矩形坐标
      const coordinates = [[
        [Math.min(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])], // 西北
        [Math.max(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])], // 东北
        [Math.max(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])], // 东南
        [Math.min(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])], // 西南
        [Math.min(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])]  // 闭合
      ]];

      // 添加选择区域
      map.current!.addSource('selection-area', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: coordinates
          }
        }
      });

      // 添加填充
      map.current!.addLayer({
        id: 'selection-fill',
        type: 'fill',
        source: 'selection-area',
        paint: {
          'fill-color': '#3B82F6',
          'fill-opacity': 0.2
        }
      });

      // 添加边框
      map.current!.addLayer({
        id: 'selection-outline',
        type: 'line',
        source: 'selection-area',
        paint: {
          'line-color': '#3B82F6',
          'line-width': 2,
          'line-dasharray': [5, 5]
        }
      });

      currentRectangle = 'selection-area';
    };

    // 鼠标抬起完成选择
    const onMouseUp = (e: maplibregl.MapMouseEvent) => {
      if (!isSelecting || !startPoint) return;

      const endPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      const bbox: BoundingBox = {
        west: Math.min(startPoint[0], endPoint[0]),
        south: Math.min(startPoint[1], endPoint[1]),
        east: Math.max(startPoint[0], endPoint[0]),
        north: Math.max(startPoint[1], endPoint[1])
      };

      setSelectedArea(bbox);
      onAreaSelected(bbox);
      setIsSelecting(false);
      
      map.current!.getCanvas().style.cursor = '';
      map.current!.dragPan.enable();
      
      startPoint = null;
    };

    map.current.on('mousedown', onMouseDown);
    map.current.on('mousemove', onMouseMove);
    map.current.on('mouseup', onMouseUp);

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [isSelecting, onAreaSelected]);

  const selectPresetArea = (area: typeof presetAreas[0]) => {
    setSelectedArea(area.bbox);
    onAreaSelected(area.bbox);
    
    if (map.current) {
      // 飞到选定区域
      map.current.flyTo({
        center: area.center as [number, number],
        zoom: 16,
        duration: 1000
      });

      // 清除之前的选择
      if (map.current.getSource('selection-area')) {
        map.current.removeLayer('selection-fill');
        map.current.removeLayer('selection-outline');
        map.current.removeSource('selection-area');
      }

      // 显示选定区域
      const coordinates = [[
        [area.bbox.west, area.bbox.north], // 西北
        [area.bbox.east, area.bbox.north], // 东北
        [area.bbox.east, area.bbox.south], // 东南
        [area.bbox.west, area.bbox.south], // 西南
        [area.bbox.west, area.bbox.north]  // 闭合
      ]];

      map.current.addSource('selection-area', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: coordinates
          }
        }
      });

      map.current.addLayer({
        id: 'selection-fill',
        type: 'fill',
        source: 'selection-area',
        paint: {
          'fill-color': '#10B981',
          'fill-opacity': 0.2
        }
      });

      map.current.addLayer({
        id: 'selection-outline',
        type: 'line',
        source: 'selection-area',
        paint: {
          'line-color': '#10B981',
          'line-width': 2
        }
      });
    }
  };

  const toggleSelection = () => {
    setIsSelecting(!isSelecting);
    if (map.current) {
      map.current.getCanvas().style.cursor = !isSelecting ? 'crosshair' : '';
    }
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* 预设区域选择 */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            快速选择区域
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {presetAreas.map((area, index) => (
              <button
                key={index}
                onClick={() => selectPresetArea(area)}
                className="text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-md text-sm text-gray-300 hover:text-white transition-colors"
              >
                {area.name}
              </button>
            ))}
          </div>
        </div>

        {/* 地图容器 */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Square className="h-4 w-4" />
              地图选择
            </h3>
            <button
              onClick={toggleSelection}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                isSelecting 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
            >
              <Crosshair className="h-4 w-4" />
              {isSelecting ? '取消选择' : '框选区域'}
            </button>
          </div>
          
          <div 
            ref={mapContainer}
            className="w-full h-80 rounded-lg overflow-hidden border border-gray-600"
          />
          
          {isSelecting && (
            <p className="text-xs text-blue-400 mt-2">
              在地图上按住鼠标左键拖拽选择区域
            </p>
          )}
        </div>

        {/* 坐标输入 */}
        {selectedArea && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-medium text-gray-300 mb-3">精确坐标调整</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">纬度范围</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="南"
                    step="0.0001"
                    value={selectedArea.south.toFixed(4)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        const newBbox = { ...selectedArea, south: value };
                        setSelectedArea(newBbox);
                        onAreaSelected(newBbox);
                      }
                    }}
                    className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  />
                  <input
                    type="number"
                    placeholder="北"
                    step="0.0001"
                    value={selectedArea.north.toFixed(4)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        const newBbox = { ...selectedArea, north: value };
                        setSelectedArea(newBbox);
                        onAreaSelected(newBbox);
                      }
                    }}
                    className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">经度范围</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="西"
                    step="0.0001"
                    value={selectedArea.west.toFixed(4)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        const newBbox = { ...selectedArea, west: value };
                        setSelectedArea(newBbox);
                        onAreaSelected(newBbox);
                      }
                    }}
                    className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  />
                  <input
                    type="number"
                    placeholder="东"
                    step="0.0001"
                    value={selectedArea.east.toFixed(4)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        const newBbox = { ...selectedArea, east: value };
                        setSelectedArea(newBbox);
                        onAreaSelected(newBbox);
                      }
                    }}
                    className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 选择结果显示 */}
        {selectedArea && (
          <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-3">
            <p className="text-green-300 text-sm">
              已选择区域: {selectedArea.south.toFixed(4)}, {selectedArea.west.toFixed(4)} 到 {selectedArea.north.toFixed(4)}, {selectedArea.east.toFixed(4)}
            </p>
            <p className="text-green-400 text-xs mt-1">
              区域大小: {((selectedArea.east - selectedArea.west) * 111320 * Math.cos(selectedArea.north * Math.PI / 180)).toFixed(0)}m × {((selectedArea.north - selectedArea.south) * 111320).toFixed(0)}m
            </p>
          </div>
        )}
      </div>
    </div>
  );
};