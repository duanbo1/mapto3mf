import React, { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BoundingBox } from '../types';
import { Search, Square, Circle, Hexagon as Polygon, Move, RotateCw, Trash2, MousePointer, Navigation, Eraser } from 'lucide-react';

interface MapSelectorProps {
  onAreaSelected: (bbox: BoundingBox) => void;
  className?: string;
}

type SelectionShape = 'rectangle' | 'circle' | 'polygon' | 'freehand';
type MapMode = 'browse' | 'select' | 'move' | 'rotate' | 'erase';

interface Selection {
  id: string;
  shape: SelectionShape;
  coordinates: number[][];
  center?: [number, number];
  radius?: number;
  bbox: BoundingBox;
}

export const MapSelector: React.FC<MapSelectorProps> = ({ onAreaSelected, className }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('browse');
  const [selectionShape, setSelectionShape] = useState<SelectionShape>('rectangle');
  const [selections, setSelections] = useState<Selection[]>([]);
  const [activeSelection, setActiveSelection] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);

  // 搜索地点
  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      );
      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      searchLocation(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, searchLocation]);

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
    let currentDrawing: string | null = null;

    // 鼠标事件处理
    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      // 中键拖拽支持
      if (e.originalEvent.button === 1) { // 中键
        e.originalEvent.preventDefault();
        return;
      }

      if (mapMode === 'browse') {
        return;
      }
      
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      if (mapMode === 'select') {
        startPoint = lngLat;
        setIsDrawing(true);
        
        if (selectionShape === 'polygon' || selectionShape === 'freehand') {
          setDrawingPoints([lngLat]);
        }
        
        map.current!.dragPan.disable();
      } else if (mapMode === 'erase') {
        // 检查点击位置是否在某个选择区域内
        const clickedSelection = findSelectionAtPoint(lngLat);
        if (clickedSelection) {
          removeSelection(clickedSelection.id);
        }
      }
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawing || !startPoint || mapMode !== 'select') return;

      const endPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      // 移除之前的临时绘制
      if (currentDrawing && map.current!.getSource('temp-selection')) {
        map.current!.removeLayer('temp-selection-fill');
        map.current!.removeLayer('temp-selection-outline');
        map.current!.removeSource('temp-selection');
      }

      let coordinates: number[][];
      
      switch (selectionShape) {
        case 'rectangle':
          coordinates = [[
            [Math.min(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])],
            [Math.max(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])],
            [Math.max(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])],
            [Math.min(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])],
            [Math.min(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])]
          ]];
          break;
          
        case 'circle':
          const radius = Math.sqrt(
            Math.pow(endPoint[0] - startPoint[0], 2) + Math.pow(endPoint[1] - startPoint[1], 2)
          );
          coordinates = [createCircleCoordinates(startPoint, radius)];
          break;
          
        case 'polygon':
          const currentPoints = [...drawingPoints, endPoint];
          coordinates = [currentPoints.concat([currentPoints[0]])];
          break;
          
        case 'freehand':
          setDrawingPoints(prev => [...prev, endPoint]);
          coordinates = [[...drawingPoints, endPoint, drawingPoints[0]]];
          break;
          
        default:
          return;
      }

      // 添加临时选择区域 - 实线显示
      map.current!.addSource('temp-selection', {
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

      map.current!.addLayer({
        id: 'temp-selection-fill',
        type: 'fill',
        source: 'temp-selection',
        paint: {
          'fill-color': '#3B82F6',
          'fill-opacity': 0.2
        }
      });

      map.current!.addLayer({
        id: 'temp-selection-outline',
        type: 'line',
        source: 'temp-selection',
        paint: {
          'line-color': '#3B82F6',
          'line-width': 3,
          'line-opacity': 0.8
        }
      });

      currentDrawing = 'temp-selection';
    };

    const onMouseUp = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawing || !startPoint || mapMode !== 'select') return;

      const endPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      // 创建新的选择区域
      let coordinates: number[][];
      let center: [number, number];
      let radius: number | undefined;
      let bbox: BoundingBox;
      
      switch (selectionShape) {
        case 'rectangle':
          coordinates = [[
            [Math.min(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])],
            [Math.max(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])],
            [Math.max(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])],
            [Math.min(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])],
            [Math.min(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])]
          ]];
          center = [(startPoint[0] + endPoint[0]) / 2, (startPoint[1] + endPoint[1]) / 2];
          bbox = {
            west: Math.min(startPoint[0], endPoint[0]),
            south: Math.min(startPoint[1], endPoint[1]),
            east: Math.max(startPoint[0], endPoint[0]),
            north: Math.max(startPoint[1], endPoint[1])
          };
          break;
          
        case 'circle':
          radius = Math.sqrt(
            Math.pow(endPoint[0] - startPoint[0], 2) + Math.pow(endPoint[1] - startPoint[1], 2)
          );
          coordinates = [createCircleCoordinates(startPoint, radius)];
          center = startPoint;
          bbox = {
            west: startPoint[0] - radius,
            south: startPoint[1] - radius,
            east: startPoint[0] + radius,
            north: startPoint[1] + radius
          };
          break;
          
        case 'polygon':
        case 'freehand':
          const finalPoints = selectionShape === 'polygon' ? 
            [...drawingPoints, endPoint] : 
            [...drawingPoints, endPoint];
          coordinates = [finalPoints.concat([finalPoints[0]])];
          
          // 计算多边形的边界框和中心
          const lngs = finalPoints.map(p => p[0]);
          const lats = finalPoints.map(p => p[1]);
          bbox = {
            west: Math.min(...lngs),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            north: Math.max(...lats)
          };
          center = [(bbox.west + bbox.east) / 2, (bbox.south + bbox.north) / 2];
          break;
          
        default:
          return;
      }

      // 添加到选择列表
      const newSelection: Selection = {
        id: `selection-${Date.now()}`,
        shape: selectionShape,
        coordinates,
        center,
        radius,
        bbox
      };

      addSelection(newSelection);
      onAreaSelected(bbox);
      
      // 清理临时绘制
      if (currentDrawing && map.current!.getSource('temp-selection')) {
        map.current!.removeLayer('temp-selection-fill');
        map.current!.removeLayer('temp-selection-outline');
        map.current!.removeSource('temp-selection');
      }
      
      setIsDrawing(false);
      setDrawingPoints([]);
      map.current!.dragPan.enable();
      startPoint = null;
      currentDrawing = null;
    };

    // 双击完成多边形绘制
    const onDoubleClick = (e: maplibregl.MapMouseEvent) => {
      if (mapMode === 'select' && selectionShape === 'polygon' && drawingPoints.length >= 3) {
        e.preventDefault();
        onMouseUp(e);
      }
    };

    map.current.on('mousedown', onMouseDown);
    map.current.on('mousemove', onMouseMove);
    map.current.on('mouseup', onMouseUp);
    map.current.on('dblclick', onDoubleClick);

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapMode, selectionShape, isDrawing, drawingPoints, onAreaSelected]);

  // 创建圆形坐标
  const createCircleCoordinates = (center: [number, number], radius: number): number[][] => {
    const points: number[][] = [];
    const steps = 64;
    
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const x = center[0] + radius * Math.cos(angle);
      const y = center[1] + radius * Math.sin(angle);
      points.push([x, y]);
    }
    
    return points;
  };

  // 添加选择区域
  const addSelection = (selection: Selection) => {
    setSelections(prev => [...prev, selection]);
    
    if (map.current) {
      // 添加到地图 - 实线显示
      map.current.addSource(selection.id, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { id: selection.id },
          geometry: {
            type: 'Polygon',
            coordinates: selection.coordinates
          }
        }
      });

      map.current.addLayer({
        id: `${selection.id}-fill`,
        type: 'fill',
        source: selection.id,
        paint: {
          'fill-color': '#10B981',
          'fill-opacity': 0.25
        }
      });

      map.current.addLayer({
        id: `${selection.id}-outline`,
        type: 'line',
        source: selection.id,
        paint: {
          'line-color': '#10B981',
          'line-width': 3,
          'line-opacity': 1
        }
      });

      // 添加选择区域的控制点
      if (selection.center) {
        const centerMarker = new maplibregl.Marker({
          color: '#10B981',
          scale: 0.8
        })
        .setLngLat(selection.center)
        .addTo(map.current);
      }
    }
  };

  // 移除选择区域
  const removeSelection = (selectionId: string) => {
    setSelections(prev => prev.filter(s => s.id !== selectionId));
    
    if (map.current && map.current.getSource(selectionId)) {
      map.current.removeLayer(`${selectionId}-fill`);
      map.current.removeLayer(`${selectionId}-outline`);
      map.current.removeSource(selectionId);
    }
  };

  // 查找点击位置的选择区域
  const findSelectionAtPoint = (point: [number, number]): Selection | null => {
    // 简化的点在多边形内检测
    for (const selection of selections) {
      const bbox = selection.bbox;
      if (point[0] >= bbox.west && point[0] <= bbox.east &&
          point[1] >= bbox.south && point[1] <= bbox.north) {
        return selection;
      }
    }
    return null;
  };

  // 搜索结果点击
  const handleSearchResultClick = (result: any) => {
    if (map.current) {
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      
      map.current.flyTo({
        center: [lon, lat],
        zoom: 16,
        duration: 1000
      });
      
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  // 获取模式图标
  const getModeIcon = (mode: MapMode) => {
    switch (mode) {
      case 'browse':
        return <Navigation className="h-5 w-5" />;
      case 'select':
        return <Square className="h-5 w-5" />;
      case 'move':
        return <Move className="h-5 w-5" />;
      case 'rotate':
        return <RotateCw className="h-5 w-5" />;
      case 'erase':
        return <Eraser className="h-5 w-5" />;
      default:
        return <MousePointer className="h-5 w-5" />;
    }
  };

  // 获取形状图标
  const getShapeIcon = (shape: SelectionShape) => {
    switch (shape) {
      case 'rectangle':
        return <Square className="h-5 w-5" />;
      case 'circle':
        return <Circle className="h-5 w-5" />;
      case 'polygon':
        return <Polygon className="h-5 w-5" />;
      case 'freehand':
        return <MousePointer className="h-5 w-5" />;
      default:
        return <Square className="h-5 w-5" />;
    }
  };

  return (
    <div className={className}>
      <div className="h-full flex flex-col">
        {/* 工具栏 */}
        <div className="bg-gray-800 border-b border-gray-700 p-4 space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索地点..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                </div>
              )}
            </div>
            
            {/* 搜索结果 */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearchResultClick(result)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-600 border-b border-gray-600 last:border-b-0 transition-colors"
                  >
                    <div className="text-white text-sm font-medium">{result.display_name}</div>
                    <div className="text-gray-400 text-xs mt-1">
                      {result.type} • {parseFloat(result.lat).toFixed(4)}, {parseFloat(result.lon).toFixed(4)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 模式选择 */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setMapMode('browse')}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg ${
                mapMode === 'browse' 
                  ? 'bg-blue-600 text-white shadow-blue-500/25 scale-105 ring-2 ring-blue-400' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-102 hover:shadow-xl'
              }`}
            >
              {getModeIcon('browse')}
              浏览
            </button>
            <button
              onClick={() => setMapMode('select')}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg ${
                mapMode === 'select' 
                  ? 'bg-green-600 text-white shadow-green-500/25 scale-105 ring-2 ring-green-400' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-102 hover:shadow-xl'
              }`}
            >
              {getModeIcon('select')}
              选择
            </button>
            <button
              onClick={() => setMapMode('erase')}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg ${
                mapMode === 'erase' 
                  ? 'bg-red-600 text-white shadow-red-500/25 scale-105 ring-2 ring-red-400' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-102 hover:shadow-xl'
              }`}
            >
              {getModeIcon('erase')}
              擦除
            </button>
          </div>

          {/* 形状选择 */}
          {mapMode === 'select' && (
            <div className="p-4 bg-gray-700 rounded-xl border border-gray-600 shadow-inner">
              <div className="text-sm text-gray-300 mb-3 text-center font-medium">选择形状</div>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setSelectionShape('rectangle')}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg text-xs transition-all duration-200 ${
                    selectionShape === 'rectangle' 
                      ? 'bg-blue-600 text-white shadow-lg scale-105 ring-2 ring-blue-400' 
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:scale-102'
                  }`}
                >
                  {getShapeIcon('rectangle')}
                  矩形
                </button>
                <button
                  onClick={() => setSelectionShape('circle')}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg text-xs transition-all duration-200 ${
                    selectionShape === 'circle' 
                      ? 'bg-blue-600 text-white shadow-lg scale-105 ring-2 ring-blue-400' 
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:scale-102'
                  }`}
                >
                  {getShapeIcon('circle')}
                  圆形
                </button>
                <button
                  onClick={() => setSelectionShape('polygon')}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg text-xs transition-all duration-200 ${
                    selectionShape === 'polygon' 
                      ? 'bg-blue-600 text-white shadow-lg scale-105 ring-2 ring-blue-400' 
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:scale-102'
                  }`}
                >
                  {getShapeIcon('polygon')}
                  多边形
                </button>
                <button
                  onClick={() => setSelectionShape('freehand')}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg text-xs transition-all duration-200 ${
                    selectionShape === 'freehand' 
                      ? 'bg-blue-600 text-white shadow-lg scale-105 ring-2 ring-blue-400' 
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500 hover:scale-102'
                  }`}
                >
                  {getShapeIcon('freehand')}
                  自由
                </button>
              </div>
            </div>
          )}

          {/* 操作提示 */}
          <div className="text-xs text-gray-400 p-4 bg-gray-700 rounded-xl border border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${
                mapMode === 'browse' ? 'bg-blue-400' :
                mapMode === 'select' ? 'bg-green-400' :
                mapMode === 'erase' ? 'bg-red-400' : 'bg-gray-400'
              } animate-pulse`}></div>
              <span className="font-medium">操作提示</span>
            </div>
            <div className="text-gray-300">
              {mapMode === 'browse' && '拖拽浏览地图，滚轮缩放，中键也可拖拽'}
              {mapMode === 'select' && selectionShape === 'rectangle' && '按住鼠标左键拖拽选择矩形区域'}
              {mapMode === 'select' && selectionShape === 'circle' && '按住鼠标左键拖拽选择圆形区域'}
              {mapMode === 'select' && selectionShape === 'polygon' && '点击添加多边形顶点，双击完成'}
              {mapMode === 'select' && selectionShape === 'freehand' && '按住鼠标左键自由绘制区域'}
              {mapMode === 'erase' && '点击选择区域删除'}
            </div>
          </div>
        </div>

        {/* 地图容器 */}
        <div className="flex-1 relative">
          <div 
            ref={mapContainer}
            className="w-full h-full"
            style={{ 
              cursor: mapMode === 'select' ? 'crosshair' : 
                     mapMode === 'erase' ? 'pointer' : 
                     mapMode === 'move' ? 'move' :
                     mapMode === 'rotate' ? 'grab' : 'grab' 
            }}
          />
          
          {/* 选择区域信息面板 */}
          {selections.length > 0 && (
            <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-xl p-4 max-w-sm border border-gray-600 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <h4 className="text-sm font-semibold text-white">选择区域 ({selections.length})</h4>
                <button
                  onClick={() => {
                    selections.forEach(s => removeSelection(s.id));
                  }}
                  className="ml-auto p-1 text-gray-400 hover:text-red-400 transition-colors"
                  title="清除所有选择"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {selections.map((selection, index) => (
                  <div key={selection.id} className="p-3 bg-gray-800 rounded-lg border border-gray-600 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getShapeIcon(selection.shape)}
                        <span className="font-medium text-green-400 text-sm">
                          {selection.shape === 'rectangle' ? '矩形' :
                           selection.shape === 'circle' ? '圆形' :
                           selection.shape === 'polygon' ? '多边形' : '自由形状'} {index + 1}
                        </span>
                      </div>
                      <button
                        onClick={() => removeSelection(selection.id)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        title="删除此选择"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    
                    <div className="text-xs text-gray-300 space-y-1">
                      <div>坐标: {selection.bbox.south.toFixed(4)}, {selection.bbox.west.toFixed(4)}</div>
                      <div>到: {selection.bbox.north.toFixed(4)}, {selection.bbox.east.toFixed(4)}</div>
                      <div className="text-gray-400">
                        大小: {((selection.bbox.east - selection.bbox.west) * 111320 * Math.cos(selection.bbox.north * Math.PI / 180)).toFixed(0)}m × {((selection.bbox.north - selection.bbox.south) * 111320).toFixed(0)}m
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 绘制状态指示器 */}
          {isDrawing && (
            <div className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">正在绘制...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};