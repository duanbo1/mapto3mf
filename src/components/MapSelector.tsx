import React, { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BoundingBox } from '../types';
import { Search, Square, Circle, Hexagon as Polygon, Navigation, Target, Eraser, MousePointer } from 'lucide-react';

interface MapSelectorProps {
  onAreaSelected: (bbox: BoundingBox) => void;
  className?: string;
}

type SelectionShape = 'rectangle' | 'circle' | 'polygon' | 'freehand';
type MapMode = 'browse' | 'select' | 'erase';

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  
  // 交互式选择状态
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [interactiveStartPoint, setInteractiveStartPoint] = useState<[number, number] | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewCoordinates, setPreviewCoordinates] = useState<number[][] | null>(null);

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
    map.current.addControl(new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    }), 'bottom-left');

    let startPoint: [number, number] | null = null;
    let currentDrawing: string | null = null;

    // 鼠标事件处理
    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      // 中键拖拽支持 - 在任何模式下都允许
      if (e.originalEvent.button === 1) {
        e.originalEvent.preventDefault();
        return;
      }

      // 右键也允许拖拽
      if (e.originalEvent.button === 2) {
        return;
      }

      // 只处理左键点击
      if (e.originalEvent.button !== 0) return;

      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      if (mapMode === 'browse') {
        return;
      }
      
      if (mapMode === 'select') {
        if (isInteractiveMode) {
          if (!interactiveStartPoint) {
            // 第一次点击：设置起始点
            setInteractiveStartPoint(lngLat);
            addPreviewPoint(lngLat);
            setShowPreview(true);
            return;
          } else {
            // 第二次点击：完成选择
            completeInteractiveSelection(interactiveStartPoint, lngLat);
            return;
          }
        } else {
          // 传统拖拽模式
          startPoint = lngLat;
          setIsDrawing(true);
          
          if (selectionShape === 'polygon' || selectionShape === 'freehand') {
            setDrawingPoints([lngLat]);
          }
          
          // 只在非交互模式下禁用拖拽
          map.current!.dragPan.disable();
        }
      } else if (mapMode === 'erase') {
        const clickedSelection = findSelectionAtPoint(lngLat);
        if (clickedSelection) {
          removeSelection(clickedSelection.id);
        }
      }
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const currentPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      // 交互式模式预览
      if (isInteractiveMode && interactiveStartPoint && showPreview) {
        updatePreview(interactiveStartPoint, currentPoint);
        return;
      }
      
      if (!isDrawing || !startPoint || mapMode !== 'select') return;

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
            [Math.min(startPoint[0], currentPoint[0]), Math.max(startPoint[1], currentPoint[1])],
            [Math.max(startPoint[0], currentPoint[0]), Math.max(startPoint[1], currentPoint[1])],
            [Math.max(startPoint[0], currentPoint[0]), Math.min(startPoint[1], currentPoint[1])],
            [Math.min(startPoint[0], currentPoint[0]), Math.min(startPoint[1], currentPoint[1])],
            [Math.min(startPoint[0], currentPoint[0]), Math.max(startPoint[1], currentPoint[1])]
          ]];
          break;
          
        case 'circle':
          const radius = Math.sqrt(
            Math.pow(currentPoint[0] - startPoint[0], 2) + Math.pow(currentPoint[1] - startPoint[1], 2)
          );
          coordinates = [createCircleCoordinates(startPoint, radius)];
          break;
          
        case 'polygon':
          const currentPoints = [...drawingPoints, currentPoint];
          coordinates = [currentPoints.concat([currentPoints[0]])];
          break;
          
        case 'freehand':
          setDrawingPoints(prev => [...prev, currentPoint]);
          coordinates = [[...drawingPoints, currentPoint, drawingPoints[0]]];
          break;
          
        default:
          return;
      }

      addTemporarySelection(coordinates);
      currentDrawing = 'temp-selection';
    };

    const onMouseUp = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawing || !startPoint || mapMode !== 'select' || isInteractiveMode) return;

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
      
      // 清理
      cleanupDrawing();
    };

    const onDoubleClick = (e: maplibregl.MapMouseEvent) => {
      if (mapMode === 'select' && selectionShape === 'polygon' && drawingPoints.length >= 3) {
        e.preventDefault();
        onMouseUp(e);
      }
    };

    // 中键拖拽处理
    const onWheel = (e: WheelEvent) => {
      // 允许滚轮缩放
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
  }, [mapMode, selectionShape, isDrawing, drawingPoints, onAreaSelected, isInteractiveMode, interactiveStartPoint, showPreview]);

  // 添加临时选择区域
  const addTemporarySelection = (coordinates: number[][]) => {
    if (!map.current) return;

    map.current.addSource('temp-selection', {
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
      id: 'temp-selection-fill',
      type: 'fill',
      source: 'temp-selection',
      paint: {
        'fill-color': '#F59E0B',
        'fill-opacity': 0.25
      }
    });

    map.current.addLayer({
      id: 'temp-selection-outline',
      type: 'line',
      source: 'temp-selection',
      paint: {
        'line-color': '#F59E0B',
        'line-width': 3,
        'line-opacity': 1,
        'line-dasharray': [5, 5]
      }
    });
  };

  // 添加预览点
  const addPreviewPoint = (point: [number, number]) => {
    if (!map.current) return;
    
    if (map.current.getSource('preview-point')) {
      map.current.removeLayer('preview-point');
      map.current.removeSource('preview-point');
    }
    
    map.current.addSource('preview-point', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: point
        }
      }
    });

    map.current.addLayer({
      id: 'preview-point',
      type: 'circle',
      source: 'preview-point',
      paint: {
        'circle-radius': 8,
        'circle-color': '#F59E0B',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#FFFFFF',
        'circle-opacity': 0.9
      }
    });
  };

  // 更新预览
  const updatePreview = (start: [number, number], end: [number, number]) => {
    if (!map.current) return;
    
    if (map.current.getSource('shape-preview')) {
      map.current.removeLayer('shape-preview-fill');
      map.current.removeLayer('shape-preview-outline');
      map.current.removeSource('shape-preview');
    }
    
    let coordinates: number[][];
    
    switch (selectionShape) {
      case 'rectangle':
        coordinates = [[
          [Math.min(start[0], end[0]), Math.max(start[1], end[1])],
          [Math.max(start[0], end[0]), Math.max(start[1], end[1])],
          [Math.max(start[0], end[0]), Math.min(start[1], end[1])],
          [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
          [Math.min(start[0], end[0]), Math.max(start[1], end[1])]
        ]];
        break;
        
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
        );
        coordinates = [createCircleCoordinates(start, radius)];
        break;
        
      default:
        return;
    }
    
    setPreviewCoordinates(coordinates);
    
    map.current.addSource('shape-preview', {
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
      id: 'shape-preview-fill',
      type: 'fill',
      source: 'shape-preview',
      paint: {
        'fill-color': '#F59E0B',
        'fill-opacity': 0.25
      }
    });

    map.current.addLayer({
      id: 'shape-preview-outline',
      type: 'line',
      source: 'shape-preview',
      paint: {
        'line-color': '#F59E0B',
        'line-width': 3,
        'line-opacity': 1,
        'line-dasharray': [5, 5]
      }
    });
  };

  // 完成交互式选择
  const completeInteractiveSelection = (start: [number, number], end: [number, number]) => {
    if (!previewCoordinates) return;

    let center: [number, number];
    let radius: number | undefined;
    let bbox: BoundingBox;
    
    switch (selectionShape) {
      case 'rectangle':
        center = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
        bbox = {
          west: Math.min(start[0], end[0]),
          south: Math.min(start[1], end[1]),
          east: Math.max(start[0], end[0]),
          north: Math.max(start[1], end[1])
        };
        break;
        
      case 'circle':
        radius = Math.sqrt(
          Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
        );
        center = start;
        bbox = {
          west: start[0] - radius,
          south: start[1] - radius,
          east: start[0] + radius,
          north: start[1] + radius
        };
        break;
        
      default:
        return;
    }

    const newSelection: Selection = {
      id: `selection-${Date.now()}`,
      shape: selectionShape,
      coordinates: previewCoordinates,
      center,
      radius,
      bbox
    };

    addSelection(newSelection);
    onAreaSelected(bbox);
    
    // 清理交互式选择状态
    clearInteractiveMode();
  };

  // 清理交互式模式
  const clearInteractiveMode = () => {
    setIsInteractiveMode(false);
    setInteractiveStartPoint(null);
    setShowPreview(false);
    setPreviewCoordinates(null);
    
    if (map.current) {
      if (map.current.getSource('preview-point')) {
        map.current.removeLayer('preview-point');
        map.current.removeSource('preview-point');
      }
      
      if (map.current.getSource('shape-preview')) {
        map.current.removeLayer('shape-preview-fill');
        map.current.removeLayer('shape-preview-outline');
        map.current.removeSource('shape-preview');
      }
    }
  };

  // 清理绘制状态
  const cleanupDrawing = () => {
    setIsDrawing(false);
    setDrawingPoints([]);
    if (map.current) {
      map.current.dragPan.enable();
      
      if (map.current.getSource('temp-selection')) {
        map.current.removeLayer('temp-selection-fill');
        map.current.removeLayer('temp-selection-outline');
        map.current.removeSource('temp-selection');
      }
    }
  };

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
          'line-width': 4,
          'line-opacity': 1
        }
      });

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

  // 处理形状选择
  const handleShapeSelect = (shape: SelectionShape) => {
    setSelectionShape(shape);
    if (mapMode === 'select') {
      setIsInteractiveMode(true);
      clearInteractiveMode();
    }
  };

  // 获取模式图标
  const getModeIcon = (mode: MapMode) => {
    switch (mode) {
      case 'browse':
        return <Navigation className="h-5 w-5" />;
      case 'select':
        return <Target className="h-5 w-5" />;
      case 'erase':
        return <Eraser className="h-5 w-5" />;
      default:
        return <Navigation className="h-5 w-5" />;
    }
  };

  // 获取形状图标
  const getShapeIcon = (shape: SelectionShape) => {
    switch (shape) {
      case 'rectangle':
        return <Square className="h-4 w-4" />;
      case 'circle':
        return <Circle className="h-4 w-4" />;
      case 'polygon':
        return <Polygon className="h-4 w-4" />;
      case 'freehand':
        return <MousePointer className="h-4 w-4" />;
      default:
        return <Square className="h-4 w-4" />;
    }
  };

  // 获取鼠标样式
  const getMapCursor = () => {
    if (mapMode === 'browse') return 'grab';
    if (mapMode === 'erase') return 'pointer';
    if (mapMode === 'select') {
      if (isInteractiveMode) {
        return 'crosshair';
      }
      return 'crosshair';
    }
    return 'default';
  };

  return (
    <div className={`${className} flex flex-col h-full`}>
      {/* 工具栏 - 固定高度 */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 space-y-3 flex-shrink-0">
        {/* 搜索框 */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索地点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              </div>
            )}
          </div>
          
          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleSearchResultClick(result)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-600 border-b border-gray-600 last:border-b-0 transition-colors"
                >
                  <div className="text-white text-sm font-medium truncate">{result.display_name}</div>
                  <div className="text-gray-400 text-xs mt-1">
                    {result.type} • {parseFloat(result.lat).toFixed(4)}, {parseFloat(result.lon).toFixed(4)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 模式选择 */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              setMapMode('browse');
              clearInteractiveMode();
            }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              mapMode === 'browse' 
                ? 'bg-blue-600 text-white shadow-lg scale-105' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {getModeIcon('browse')}
            浏览
          </button>
          <button
            onClick={() => {
              setMapMode('select');
              setIsInteractiveMode(true);
              clearInteractiveMode();
            }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              mapMode === 'select' 
                ? 'bg-green-600 text-white shadow-lg scale-105' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {getModeIcon('select')}
            选择
          </button>
          <button
            onClick={() => {
              setMapMode('erase');
              clearInteractiveMode();
            }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              mapMode === 'erase' 
                ? 'bg-red-600 text-white shadow-lg scale-105' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {getModeIcon('erase')}
            擦除
          </button>
        </div>

        {/* 形状选择 */}
        {mapMode === 'select' && (
          <div className="p-3 bg-gray-700 rounded-lg border border-gray-600">
            <div className="text-xs text-gray-300 mb-2 text-center font-medium">选择形状</div>
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => handleShapeSelect('rectangle')}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                  selectionShape === 'rectangle' 
                    ? 'bg-blue-600 text-white shadow-lg scale-105' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {getShapeIcon('rectangle')}
                矩形
              </button>
              <button
                onClick={() => handleShapeSelect('circle')}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                  selectionShape === 'circle' 
                    ? 'bg-blue-600 text-white shadow-lg scale-105' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {getShapeIcon('circle')}
                圆形
              </button>
              <button
                onClick={() => handleShapeSelect('polygon')}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                  selectionShape === 'polygon' 
                    ? 'bg-blue-600 text-white shadow-lg scale-105' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {getShapeIcon('polygon')}
                多边形
              </button>
              <button
                onClick={() => handleShapeSelect('freehand')}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                  selectionShape === 'freehand' 
                    ? 'bg-blue-600 text-white shadow-lg scale-105' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {getShapeIcon('freehand')}
                自由
              </button>
            </div>
          </div>
        )}

        {/* 操作提示 */}
        <div className="text-xs text-gray-400 p-2 bg-gray-700 rounded-lg border border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${
              mapMode === 'browse' ? 'bg-blue-400' :
              mapMode === 'select' ? 'bg-green-400' :
              mapMode === 'erase' ? 'bg-red-400' : 'bg-gray-400'
            } animate-pulse`}></div>
            <span className="font-medium text-xs">操作提示</span>
          </div>
          <div className="text-gray-300 text-xs">
            {mapMode === 'browse' && '拖拽浏览地图，滚轮缩放，中键也可拖拽'}
            {mapMode === 'select' && !isInteractiveMode && '选择形状后点击地图开始选择区域'}
            {mapMode === 'select' && isInteractiveMode && !interactiveStartPoint && '点击地图设置起始点'}
            {mapMode === 'select' && isInteractiveMode && interactiveStartPoint && '移动鼠标调整大小，再次点击完成选择'}
            {mapMode === 'erase' && '点击选择区域删除'}
            {isDrawing && '正在绘制...'}
          </div>
        </div>
      </div>

      {/* 地图容器 - 占据剩余空间 */}
      <div className="flex-1 relative min-h-0">
        <div 
          ref={mapContainer}
          className="w-full h-full"
          style={{ cursor: getMapCursor() }}
        />
        
        {/* 选择区域信息面板 */}
        {selections.length > 0 && (
          <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-lg p-3 max-w-xs border border-gray-600 shadow-2xl max-h-64 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <h4 className="text-sm font-semibold text-white">选择区域 ({selections.length})</h4>
              <button
                onClick={() => {
                  selections.forEach(s => removeSelection(s.id));
                }}
                className="ml-auto p-1 text-gray-400 hover:text-red-400 transition-colors text-xs"
                title="清除所有选择"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-2">
              {selections.map((selection, index) => (
                <div key={selection.id} className="p-2 bg-gray-800 rounded-md border border-gray-600">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      {getShapeIcon(selection.shape)}
                      <span className="font-medium text-green-400 text-xs">
                        {selection.shape === 'rectangle' ? '矩形' :
                         selection.shape === 'circle' ? '圆形' :
                         selection.shape === 'polygon' ? '多边形' : '自由形状'} {index + 1}
                      </span>
                    </div>
                    <button
                      onClick={() => removeSelection(selection.id)}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors text-xs"
                      title="删除此选择"
                    >
                      ×
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

        {/* 交互式选择状态指示器 */}
        {isInteractiveMode && (
          <div className="absolute top-4 right-4 bg-orange-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {!interactiveStartPoint ? '点击地图设置起始点' : '移动鼠标调整大小，点击完成'}
            </span>
          </div>
        )}

        {/* 绘制状态指示器 */}
        {isDrawing && (
          <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">正在绘制...</span>
          </div>
        )}
      </div>
    </div>
  );
};