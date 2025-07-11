import React, { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BoundingBox } from "../types";
import {
  Search,
  Square,
  Circle,
  Hexagon as Polygon,
  Navigation,
  Target,
  Eraser,
  MousePointer,
  Download,
  Upload,
  FileText,
  Map,
  Globe,
  Mountain,
} from "lucide-react";

interface MapSelectorProps {
  onAreaSelected: (bbox: BoundingBox, selectionInfo?: any) => void;
  className?: string;
  mapState?: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  };
  onMapStateChange?: (mapState: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  }) => void;
}

type SelectionShape = "rectangle" | "circle" | "polygon" | "freehand";
type MapMode = "browse" | "select" | "erase";

interface Selection {
  id: string;
  shape: SelectionShape;
  coordinates: number[][];
  center?: [number, number];
  radius?: number;
  bbox: BoundingBox;
}

export const MapSelector: React.FC<MapSelectorProps> = ({
  onAreaSelected,
  className,
  mapState,
  onMapStateChange,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapLayer, setMapLayer] = useState<"osm" | "satellite" | "terrain">(
    "osm"
  );
  const [mapMode, setMapMode] = useState<MapMode>("browse");
  const [selectionShape, setSelectionShape] =
    useState<SelectionShape>("rectangle");
  const [selections, setSelections] = useState<Selection[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);

  // 交互式选择状态
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [interactiveStartPoint, setInteractiveStartPoint] = useState<
    [number, number] | null
  >(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewCoordinates, setPreviewCoordinates] = useState<
    number[][] | null
  >(null);

  // GeoJSON导入导出状态
  const [showGeoJSONPanel, setShowGeoJSONPanel] = useState(false);
  const [geoJSONText, setGeoJSONText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SVG绘制状态
  const [svgPath, setSvgPath] = useState<string>("");
  const [currentMousePos, setCurrentMousePos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [svgPoints, setSvgPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawingSVG, setIsDrawingSVG] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [mapCursor, setMapCursor] = useState<string>("default");

  // 搜索地点
  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=5&addressdetails=1`
      );
      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error("搜索失败:", error);
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

  // 添加选择区域 - 移到前面避免初始化错误
  const addSelection = useCallback((selection: Selection) => {
    setSelections((prev) => [...prev, selection]);

    if (map.current) {
      map.current.addSource(selection.id, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { id: selection.id },
          geometry: {
            type: "Polygon",
            coordinates: selection.coordinates,
          },
        },
      });

      map.current.addLayer({
        id: `${selection.id}-fill`,
        type: "fill",
        source: selection.id,
        paint: {
          "fill-color": "#10B981",
          "fill-opacity": 0.25,
        },
      });

      map.current.addLayer({
        id: `${selection.id}-outline`,
        type: "line",
        source: selection.id,
        paint: {
          "line-color": "#10B981",
          "line-width": 4,
          "line-opacity": 1,
        },
      });

      if (selection.center) {
        const centerMarker = new maplibregl.Marker({
          color: "#10B981",
          scale: 0.8,
        })
          .setLngLat(selection.center)
          .addTo(map.current);
      }
    }
  }, []);

  // 移除选择区域
  const removeSelection = useCallback((selectionId: string) => {
    setSelections((prev) => prev.filter((s) => s.id !== selectionId));

    if (map.current && map.current.getSource(selectionId)) {
      map.current.removeLayer(`${selectionId}-fill`);
      map.current.removeLayer(`${selectionId}-outline`);
      map.current.removeSource(selectionId);
    }
  }, []);

  // SVG路径生成函数
  const generateSVGPath = useCallback(
    (points: { x: number; y: number }[], shape: SelectionShape) => {
      if (points.length === 0) return "";

      switch (shape) {
        case "rectangle":
          if (points.length >= 2) {
            const [start, end] = points;
            const minX = Math.min(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxX = Math.max(start.x, end.x);
            const maxY = Math.max(start.y, end.y);
            return `M ${minX} ${minY} L ${maxX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`;
          }
          break;
        case "circle":
          if (points.length >= 2) {
            const [center, edge] = points;
            const radius = Math.sqrt(
              Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
            );
            return `M ${center.x - radius} ${
              center.y
            } A ${radius} ${radius} 0 1 0 ${center.x + radius} ${
              center.y
            } A ${radius} ${radius} 0 1 0 ${center.x - radius} ${center.y} Z`;
          }
          break;
        case "polygon":
        case "freehand":
          if (points.length >= 2) {
            const pathData =
              points
                .map((point, index) =>
                  index === 0
                    ? `M ${point.x} ${point.y}`
                    : `L ${point.x} ${point.y}`
                )
                .join(" ") + " Z";
            return pathData;
          }
          break;
      }
      return "";
    },
    []
  );

  // SVG鼠标事件处理
  const handleSVGMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setCurrentMousePos({ x, y });

      if (isDrawingSVG && mapMode === "select") {
        if (selectionShape === "freehand") {
          setSvgPoints((prev) => [...prev, { x, y }]);
        } else if (svgPoints.length > 0) {
          const newPoints = [...svgPoints.slice(0, -1), { x, y }];
          setSvgPath(generateSVGPath(newPoints, selectionShape));
        }
      }
    },
    [isDrawingSVG, mapMode, selectionShape, svgPoints, generateSVGPath]
  );

  const handleSVGMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (mapMode !== "select" || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (!isDrawingSVG) {
        setIsDrawingSVG(true);
        setSvgPoints([{ x, y }]);
        if (selectionShape === "rectangle" || selectionShape === "circle") {
          setSvgPoints([
            { x, y },
            { x, y },
          ]);
        }
      } else if (selectionShape === "polygon") {
        setSvgPoints((prev) => [...prev, { x, y }]);
      }
    },
    [mapMode, isDrawingSVG, selectionShape]
  );

  const handleSVGMouseUp = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (
        mapMode === "select" &&
        isDrawingSVG &&
        map.current &&
        svgRef.current
      ) {
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 转换SVG坐标到地理坐标
        const endLngLat = map.current.unproject([x, y]);

        if (svgPoints.length > 0) {
          const startPoint = svgPoints[0];
          const startLngLat = map.current.unproject([
            startPoint.x,
            startPoint.y,
          ]);

          // 创建地理坐标选择区域
          let coordinates: number[][];
          let center: [number, number];
          let radius: number | undefined;
          let bbox: BoundingBox;

          switch (selectionShape) {
            case "rectangle":
              coordinates = [
                [
                  [
                    Math.min(startLngLat.lng, endLngLat.lng),
                    Math.max(startLngLat.lat, endLngLat.lat),
                  ],
                  [
                    Math.max(startLngLat.lng, endLngLat.lng),
                    Math.max(startLngLat.lat, endLngLat.lat),
                  ],
                  [
                    Math.max(startLngLat.lng, endLngLat.lng),
                    Math.min(startLngLat.lat, endLngLat.lat),
                  ],
                  [
                    Math.min(startLngLat.lng, endLngLat.lng),
                    Math.min(startLngLat.lat, endLngLat.lat),
                  ],
                  [
                    Math.min(startLngLat.lng, endLngLat.lng),
                    Math.max(startLngLat.lat, endLngLat.lat),
                  ],
                ],
              ];
              center = [
                (startLngLat.lng + endLngLat.lng) / 2,
                (startLngLat.lat + endLngLat.lat) / 2,
              ];
              bbox = {
                west: Math.min(startLngLat.lng, endLngLat.lng),
                south: Math.min(startLngLat.lat, endLngLat.lat),
                east: Math.max(startLngLat.lng, endLngLat.lng),
                north: Math.max(startLngLat.lat, endLngLat.lat),
              };
              break;

            case "circle":
              const distance = Math.sqrt(
                Math.pow(endLngLat.lng - startLngLat.lng, 2) +
                  Math.pow(endLngLat.lat - startLngLat.lat, 2)
              );
              radius = distance;
              coordinates = [
                createCircleCoordinates(
                  [startLngLat.lng, startLngLat.lat],
                  distance
                ),
              ];
              center = [startLngLat.lng, startLngLat.lat];
              bbox = {
                west: startLngLat.lng - distance,
                south: startLngLat.lat - distance,
                east: startLngLat.lng + distance,
                north: startLngLat.lat + distance,
              };
              break;

            default:
              // 对于多边形和自由绘制，转换所有点
              const geoPoints = svgPoints.map((point) => {
                const lngLat = map.current!.unproject([point.x, point.y]);
                return [lngLat.lng, lngLat.lat];
              });
              coordinates = [geoPoints.concat([geoPoints[0]])];

              const lngs = geoPoints.map((p) => p[0]);
              const lats = geoPoints.map((p) => p[1]);
              bbox = {
                west: Math.min(...lngs),
                south: Math.min(...lats),
                east: Math.max(...lngs),
                north: Math.max(...lats),
              };
              center = [
                (bbox.west + bbox.east) / 2,
                (bbox.south + bbox.north) / 2,
              ];
              break;
          }

          // 创建新的选择区域
          const newSelection: Selection = {
            id: `selection-${Date.now()}`,
            shape: selectionShape,
            coordinates,
            center,
            radius,
            bbox,
          };

          addSelection(newSelection);
          onAreaSelected(bbox, newSelection);
        }

        // 清理SVG状态
        setIsDrawingSVG(false);
        setSvgPoints([]);
        setSvgPath("");
        setCurrentMousePos(null);

        // 保持当前选择模式，不自动切换回浏览模式
      }
    },
    [
      mapMode,
      isDrawingSVG,
      selectionShape,
      svgPoints,
      addSelection,
      onAreaSelected,
    ]
  );

  // 更新鼠标样式
  useEffect(() => {
    let cursor = "default";

    switch (mapMode) {
      case "browse":
        cursor = "grab";
        break;
      case "select":
        switch (selectionShape) {
          case "rectangle":
            cursor = "crosshair";
            break;
          case "circle":
            cursor = "crosshair";
            break;
          case "polygon":
            cursor = "crosshair";
            break;
          case "freehand":
            cursor = "crosshair";
            break;
        }
        break;
      case "erase":
        cursor = "pointer";
        break;
    }

    setMapCursor(cursor);

    if (map.current) {
      map.current.getCanvas().style.cursor = cursor;
    }
  }, [mapMode, selectionShape]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入搜索框，不处理快捷键
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "Escape":
          // ESC键：取消当前操作，回到浏览模式
          e.preventDefault();
          setMapMode("browse");
          setIsInteractiveMode(false);
          setInteractiveStartPoint(null);
          setShowPreview(false);
          setIsDrawing(false);
          setDrawingPoints([]);
          if (map.current) {
            map.current.dragPan.enable();
          }
          break;

        case "1":
          e.preventDefault();
          setSelectionShape("rectangle");
          break;

        case "2":
          e.preventDefault();
          setSelectionShape("circle");
          break;

        case "3":
          e.preventDefault();
          setSelectionShape("polygon");
          break;

        case "4":
          e.preventDefault();
          setSelectionShape("freehand");
          break;

        case "b":
        case "B":
          e.preventDefault();
          setMapMode("browse");
          break;

        case "s":
        case "S":
          e.preventDefault();
          setMapMode("select");
          break;

        case "e":
        case "E":
          e.preventDefault();
          setMapMode("erase");
          break;

        case "Delete":
        case "Backspace":
          // 删除所有选中区域
          e.preventDefault();
          setSelections([]);
          // 清除地图上的所有选择图层
          selections.forEach((selection) => {
            if (map.current?.getSource(`selection-${selection.id}`)) {
              map.current.removeLayer(`selection-${selection.id}-fill`);
              map.current.removeLayer(`selection-${selection.id}-outline`);
              map.current.removeSource(`selection-${selection.id}`);
            }
          });
          break;

        case "Enter":
          // 回车键：如果有选择区域，生成3D模型
          if (selections.length > 0) {
            e.preventDefault();
            const combinedBbox = calculateCombinedBoundingBox(selections);
            onAreaSelected(combinedBbox);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mapMode, selections, onAreaSelected]);

  useEffect(() => {
    if (!mapContainer.current) return;

    // 初始化地图 - 使用传入的状态或默认值
    const initialCenter = mapState?.center || [116.3953, 39.9067];
    const initialZoom = mapState?.zoom || 16;
    const initialBearing = mapState?.bearing || 0;
    const initialPitch = mapState?.pitch || 0;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
          satellite: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "© Esri",
          },
          terrain: {
            type: "raster",
            tiles: [
              "https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© Stamen Design",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: initialCenter,
      zoom: initialZoom,
      pitch: initialPitch,
      bearing: initialBearing,
      antialias: true,
      fadeDuration: 300,
      attributionControl: false,
    });

    // 监听地图状态变化
    const updateMapState = () => {
      if (map.current && onMapStateChange) {
        const center = map.current.getCenter();
        onMapStateChange({
          center: [center.lng, center.lat],
          zoom: map.current.getZoom(),
          bearing: map.current.getBearing(),
          pitch: map.current.getPitch(),
        });
      }
    };

    // 添加地图状态变化监听器
    map.current.on("moveend", updateMapState);
    map.current.on("zoomend", updateMapState);
    map.current.on("rotateend", updateMapState);
    map.current.on("pitchend", updateMapState);

    // 添加导航控件
    map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    map.current.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: "metric",
      }),
      "bottom-left"
    );

    let startPoint: [number, number] | null = null;
    let currentDrawing: string | null = null;

    // 鼠标事件处理
    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      // 中键拖拽支持 - 在任何模式下都允许地图拖拽
      if (e.originalEvent.button === 1) {
        // 中键按下时确保拖拽功能启用
        map.current!.dragPan.enable();
        e.preventDefault();
        return;
      }

      // 右键也允许拖拽
      if (e.originalEvent.button === 2) {
        return;
      }

      // Ctrl+左键 - 允许地图平移而不是选择
      if (e.originalEvent.button === 0 && e.originalEvent.ctrlKey) {
        map.current!.dragPan.enable();
        return;
      }

      // 只处理普通左键点击
      if (e.originalEvent.button !== 0) return;

      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (mapMode === "browse") {
        return;
      }

      if (mapMode === "select") {
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

          if (selectionShape === "polygon" || selectionShape === "freehand") {
            setDrawingPoints([lngLat]);
          }

          // 只在非交互模式下禁用拖拽
          map.current!.dragPan.disable();
        }
      } else if (mapMode === "erase") {
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

      if (!isDrawing || !startPoint || mapMode !== "select") return;

      // 移除之前的临时绘制
      if (currentDrawing && map.current!.getSource("temp-selection")) {
        map.current!.removeLayer("temp-selection-fill");
        map.current!.removeLayer("temp-selection-outline");
        map.current!.removeSource("temp-selection");
      }

      let coordinates: number[][];

      switch (selectionShape) {
        case "rectangle":
          coordinates = [
            [
              [
                Math.min(startPoint[0], currentPoint[0]),
                Math.max(startPoint[1], currentPoint[1]),
              ],
              [
                Math.max(startPoint[0], currentPoint[0]),
                Math.max(startPoint[1], currentPoint[1]),
              ],
              [
                Math.max(startPoint[0], currentPoint[0]),
                Math.min(startPoint[1], currentPoint[1]),
              ],
              [
                Math.min(startPoint[0], currentPoint[0]),
                Math.min(startPoint[1], currentPoint[1]),
              ],
              [
                Math.min(startPoint[0], currentPoint[0]),
                Math.max(startPoint[1], currentPoint[1]),
              ],
            ],
          ];
          break;

        case "circle":
          const radius = Math.sqrt(
            Math.pow(currentPoint[0] - startPoint[0], 2) +
              Math.pow(currentPoint[1] - startPoint[1], 2)
          );
          coordinates = [createCircleCoordinates(startPoint, radius)];
          break;

        case "polygon":
          const currentPoints = [...drawingPoints, currentPoint];
          coordinates = [currentPoints.concat([currentPoints[0]])];
          break;

        case "freehand":
          setDrawingPoints((prev) => [...prev, currentPoint]);
          coordinates = [[...drawingPoints, currentPoint, drawingPoints[0]]];
          break;

        default:
          return;
      }

      addTemporarySelection(coordinates);
      currentDrawing = "temp-selection";
    };

    const onMouseUp = (e: maplibregl.MapMouseEvent) => {
      if (
        !isDrawing ||
        !startPoint ||
        mapMode !== "select" ||
        isInteractiveMode
      )
        return;

      const endPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      // 创建新的选择区域
      let coordinates: number[][];
      let center: [number, number];
      let radius: number | undefined;
      let bbox: BoundingBox;

      switch (selectionShape) {
        case "rectangle":
          coordinates = [
            [
              [
                Math.min(startPoint[0], endPoint[0]),
                Math.max(startPoint[1], endPoint[1]),
              ],
              [
                Math.max(startPoint[0], endPoint[0]),
                Math.max(startPoint[1], endPoint[1]),
              ],
              [
                Math.max(startPoint[0], endPoint[0]),
                Math.min(startPoint[1], endPoint[1]),
              ],
              [
                Math.min(startPoint[0], endPoint[0]),
                Math.min(startPoint[1], endPoint[1]),
              ],
              [
                Math.min(startPoint[0], endPoint[0]),
                Math.max(startPoint[1], endPoint[1]),
              ],
            ],
          ];
          center = [
            (startPoint[0] + endPoint[0]) / 2,
            (startPoint[1] + endPoint[1]) / 2,
          ];
          bbox = {
            west: Math.min(startPoint[0], endPoint[0]),
            south: Math.min(startPoint[1], endPoint[1]),
            east: Math.max(startPoint[0], endPoint[0]),
            north: Math.max(startPoint[1], endPoint[1]),
          };
          break;

        case "circle":
          radius = Math.sqrt(
            Math.pow(endPoint[0] - startPoint[0], 2) +
              Math.pow(endPoint[1] - startPoint[1], 2)
          );
          coordinates = [createCircleCoordinates(startPoint, radius)];
          center = startPoint;
          bbox = {
            west: startPoint[0] - radius,
            south: startPoint[1] - radius,
            east: startPoint[0] + radius,
            north: startPoint[1] + radius,
          };
          break;

        case "polygon":
        case "freehand":
          const finalPoints =
            selectionShape === "polygon"
              ? [...drawingPoints, endPoint]
              : [...drawingPoints, endPoint];
          coordinates = [finalPoints.concat([finalPoints[0]])];

          const lngs = finalPoints.map((p) => p[0]);
          const lats = finalPoints.map((p) => p[1]);
          bbox = {
            west: Math.min(...lngs),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            north: Math.max(...lats),
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
        bbox,
      };

      addSelection(newSelection);
      onAreaSelected(bbox, newSelection);

      // 清理
      cleanupDrawing();

      // 重置地图模式为浏览模式，恢复正常鼠标样式
      setMapMode("browse");
    };

    const onDoubleClick = (e: maplibregl.MapMouseEvent) => {
      if (
        mapMode === "select" &&
        selectionShape === "polygon" &&
        drawingPoints.length >= 3
      ) {
        e.preventDefault();
        onMouseUp(e);
      }
    };

    // 中键拖拽处理 - 确保中键可以拖拽地图
    const onWheel = (e: WheelEvent) => {
      // 允许滚轮缩放，不做任何阻止
    };

    // 添加中键拖拽支持
    const handleMiddleMouseDrag = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.button === 1) {
        // 中键按下时启用拖拽
        map.current!.dragPan.enable();
        return;
      }
    };

    map.current.on("mousedown", onMouseDown);
    map.current.on("mousemove", onMouseMove);
    map.current.on("mouseup", onMouseUp);
    map.current.on("dblclick", onDoubleClick);

    // 添加中键拖拽支持
    map.current.on("mousedown", handleMiddleMouseDrag);

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [
    mapMode,
    selectionShape,
    isDrawing,
    drawingPoints,
    onAreaSelected,
    isInteractiveMode,
    interactiveStartPoint,
    showPreview,
  ]);

  // 添加临时选择区域
  const addTemporarySelection = (coordinates: number[][]) => {
    if (!map.current) return;

    map.current.addSource("temp-selection", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: coordinates,
        },
      },
    });

    map.current.addLayer({
      id: "temp-selection-fill",
      type: "fill",
      source: "temp-selection",
      paint: {
        "fill-color": "#F59E0B",
        "fill-opacity": 0.25,
      },
    });

    map.current.addLayer({
      id: "temp-selection-outline",
      type: "line",
      source: "temp-selection",
      paint: {
        "line-color": "#F59E0B",
        "line-width": 3,
        "line-opacity": 1,
        "line-dasharray": [5, 5],
      },
    });
  };

  // 添加预览点
  const addPreviewPoint = (point: [number, number]) => {
    if (!map.current) return;

    if (map.current.getSource("preview-point")) {
      map.current.removeLayer("preview-point");
      map.current.removeSource("preview-point");
    }

    map.current.addSource("preview-point", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: point,
        },
      },
    });

    map.current.addLayer({
      id: "preview-point",
      type: "circle",
      source: "preview-point",
      paint: {
        "circle-radius": 8,
        "circle-color": "#F59E0B",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#FFFFFF",
        "circle-opacity": 0.9,
      },
    });
  };

  // 更新预览
  const updatePreview = (start: [number, number], end: [number, number]) => {
    if (!map.current) return;

    if (map.current.getSource("shape-preview")) {
      map.current.removeLayer("shape-preview-fill");
      map.current.removeLayer("shape-preview-outline");
      map.current.removeSource("shape-preview");
    }

    let coordinates: number[][];

    switch (selectionShape) {
      case "rectangle":
        coordinates = [
          [
            [Math.min(start[0], end[0]), Math.max(start[1], end[1])],
            [Math.max(start[0], end[0]), Math.max(start[1], end[1])],
            [Math.max(start[0], end[0]), Math.min(start[1], end[1])],
            [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
            [Math.min(start[0], end[0]), Math.max(start[1], end[1])],
          ],
        ];
        break;

      case "circle":
        const radius = Math.sqrt(
          Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
        );
        coordinates = [createCircleCoordinates(start, radius)];
        break;

      default:
        return;
    }

    setPreviewCoordinates(coordinates);

    map.current.addSource("shape-preview", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: coordinates,
        },
      },
    });

    map.current.addLayer({
      id: "shape-preview-fill",
      type: "fill",
      source: "shape-preview",
      paint: {
        "fill-color": "#F59E0B",
        "fill-opacity": 0.25,
      },
    });

    map.current.addLayer({
      id: "shape-preview-outline",
      type: "line",
      source: "shape-preview",
      paint: {
        "line-color": "#F59E0B",
        "line-width": 3,
        "line-opacity": 1,
        "line-dasharray": [5, 5],
      },
    });
  };

  // 完成交互式选择
  const completeInteractiveSelection = (
    start: [number, number],
    end: [number, number]
  ) => {
    if (!previewCoordinates) return;

    let center: [number, number];
    let radius: number | undefined;
    let bbox: BoundingBox;

    switch (selectionShape) {
      case "rectangle":
        center = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
        bbox = {
          west: Math.min(start[0], end[0]),
          south: Math.min(start[1], end[1]),
          east: Math.max(start[0], end[0]),
          north: Math.max(start[1], end[1]),
        };
        break;

      case "circle":
        radius = Math.sqrt(
          Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
        );
        center = start;
        bbox = {
          west: start[0] - radius,
          south: start[1] - radius,
          east: start[0] + radius,
          north: start[1] + radius,
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
      bbox,
    };

    addSelection(newSelection);
    onAreaSelected(bbox, newSelection);

    // 清理交互式选择状态
    clearInteractiveMode();

    // 重置地图模式为浏览模式，恢复正常鼠标样式
    setMapMode("browse");
  };

  // 清理交互式模式
  const clearInteractiveMode = () => {
    setIsInteractiveMode(false);
    setInteractiveStartPoint(null);
    setShowPreview(false);
    setPreviewCoordinates(null);

    if (map.current) {
      if (map.current.getSource("preview-point")) {
        map.current.removeLayer("preview-point");
        map.current.removeSource("preview-point");
      }

      if (map.current.getSource("shape-preview")) {
        map.current.removeLayer("shape-preview-fill");
        map.current.removeLayer("shape-preview-outline");
        map.current.removeSource("shape-preview");
      }
    }
  };

  // 清理绘制状态
  const cleanupDrawing = () => {
    setIsDrawing(false);
    setDrawingPoints([]);
    if (map.current) {
      map.current.dragPan.enable();

      if (map.current.getSource("temp-selection")) {
        map.current.removeLayer("temp-selection-fill");
        map.current.removeLayer("temp-selection-outline");
        map.current.removeSource("temp-selection");
      }
    }
  };

  // 创建圆形坐标
  const createCircleCoordinates = (
    center: [number, number],
    radius: number
  ): number[][] => {
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

  // 查找点击位置的选择区域
  const findSelectionAtPoint = (point: [number, number]): Selection | null => {
    for (const selection of selections) {
      const bbox = selection.bbox;
      if (
        point[0] >= bbox.west &&
        point[0] <= bbox.east &&
        point[1] >= bbox.south &&
        point[1] <= bbox.north
      ) {
        return selection;
      }
    }
    return null;
  };

  // 计算多个选择区域的组合边界框
  const calculateCombinedBoundingBox = (
    selections: Selection[]
  ): BoundingBox => {
    if (selections.length === 0) {
      throw new Error("没有选择区域");
    }

    let west = Infinity;
    let east = -Infinity;
    let south = Infinity;
    let north = -Infinity;

    selections.forEach((selection) => {
      const bbox = selection.bbox;
      west = Math.min(west, bbox.west);
      east = Math.max(east, bbox.east);
      south = Math.min(south, bbox.south);
      north = Math.max(north, bbox.north);
    });

    return { west, east, south, north };
  };

  // 搜索结果点击
  const handleSearchResultClick = (result: any) => {
    if (map.current) {
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);

      map.current.flyTo({
        center: [lon, lat],
        zoom: 16,
        duration: 1000,
      });

      setSearchResults([]);
      setSearchQuery("");
    }
  };

  // 处理形状选择
  const handleShapeSelect = (shape: SelectionShape) => {
    setSelectionShape(shape);
    if (mapMode === "select") {
      setIsInteractiveMode(true);
      clearInteractiveMode();
    }
  };

  // 获取模式图标
  const getModeIcon = (mode: MapMode) => {
    switch (mode) {
      case "browse":
        return <Navigation className="h-5 w-5" />;
      case "select":
        return <Target className="h-5 w-5" />;
      case "erase":
        return <Eraser className="h-5 w-5" />;
      default:
        return <Navigation className="h-5 w-5" />;
    }
  };

  // 获取形状图标
  const getShapeIcon = (shape: SelectionShape) => {
    switch (shape) {
      case "rectangle":
        return <Square className="h-4 w-4" />;
      case "circle":
        return <Circle className="h-4 w-4" />;
      case "polygon":
        return <Polygon className="h-4 w-4" />;
      case "freehand":
        return <MousePointer className="h-4 w-4" />;
      default:
        return <Square className="h-4 w-4" />;
    }
  };

  // 获取鼠标样式
  const getMapCursor = () => {
    if (mapMode === "browse") return "grab";
    if (mapMode === "erase") return "pointer";
    if (mapMode === "select") {
      if (isInteractiveMode) {
        return "crosshair";
      }
      return "crosshair";
    }
    return "default";
  };

  // GeoJSON导出功能
  const exportGeoJSON = () => {
    if (selections.length === 0) {
      alert("没有选择区域可导出");
      return;
    }

    const features = selections.map((selection) => ({
      type: "Feature",
      properties: {
        id: selection.id,
        shape: selection.shape,
        center: selection.center,
        radius: selection.radius,
      },
      geometry: {
        type: "Polygon",
        coordinates: [selection.coordinates],
      },
    }));

    const geoJSON = {
      type: "FeatureCollection",
      features,
    };

    const blob = new Blob([JSON.stringify(geoJSON, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `map-selections-${
      new Date().toISOString().split("T")[0]
    }.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // GeoJSON导入功能
  const importGeoJSON = (geoJSONData: any) => {
    try {
      setImportError(null);

      if (!geoJSONData || typeof geoJSONData !== "object") {
        throw new Error("无效的GeoJSON格式");
      }

      const features =
        geoJSONData.type === "FeatureCollection"
          ? geoJSONData.features
          : [geoJSONData];

      const newSelections: Selection[] = [];

      features.forEach((feature: any, index: number) => {
        if (!feature.geometry || feature.geometry.type !== "Polygon") {
          console.warn(`跳过非多边形要素 ${index}`);
          return;
        }

        const coordinates = feature.geometry.coordinates[0];
        if (!coordinates || coordinates.length < 4) {
          console.warn(`跳过无效坐标的要素 ${index}`);
          return;
        }

        // 计算边界框
        const lngs = coordinates.map((coord: number[]) => coord[0]);
        const lats = coordinates.map((coord: number[]) => coord[1]);
        const bbox: BoundingBox = {
          west: Math.min(...lngs),
          east: Math.max(...lngs),
          south: Math.min(...lats),
          north: Math.max(...lats),
        };

        const selection: Selection = {
          id: `imported-${Date.now()}-${index}`,
          shape: feature.properties?.shape || "polygon",
          coordinates,
          center: feature.properties?.center,
          radius: feature.properties?.radius,
          bbox,
        };

        newSelections.push(selection);
      });

      if (newSelections.length === 0) {
        throw new Error("没有找到有效的多边形要素");
      }

      // 添加到现有选择中
      newSelections.forEach((selection) => addSelection(selection));

      // 缩放到导入的区域
      if (newSelections.length > 0 && map.current) {
        const allCoords = newSelections.flatMap((s) => s.coordinates);
        const bounds = new maplibregl.LngLatBounds();
        allCoords.forEach((coord) => bounds.extend(coord as [number, number]));
        map.current.fitBounds(bounds, { padding: 50 });
      }

      console.log(`成功导入 ${newSelections.length} 个选择区域`);
      setShowGeoJSONPanel(false);
      setGeoJSONText("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "导入失败";
      setImportError(errorMessage);
      console.error("GeoJSON导入错误:", error);
    }
  };

  // 处理文件导入
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const geoJSONData = JSON.parse(content);
        importGeoJSON(geoJSONData);
      } catch (error) {
        setImportError("文件格式错误，请确保是有效的GeoJSON文件");
      }
    };
    reader.readAsText(file);

    // 清空input值，允许重复选择同一文件
    event.target.value = "";
  };

  // 处理文本导入
  const handleTextImport = () => {
    try {
      const geoJSONData = JSON.parse(geoJSONText);
      importGeoJSON(geoJSONData);
    } catch (error) {
      setImportError("JSON格式错误，请检查输入的GeoJSON数据");
    }
  };

  // 切换地图图层
  const switchMapLayer = (layer: "osm" | "satellite" | "terrain") => {
    if (!map.current) return;

    // 隐藏所有图层
    ["osm", "satellite", "terrain"].forEach((layerId) => {
      if (map.current!.getLayer(layerId)) {
        map.current!.setLayoutProperty(layerId, "visibility", "none");
      }
    });

    // 如果目标图层不存在，先添加它
    if (!map.current.getLayer(layer)) {
      map.current.addLayer({
        id: layer,
        type: "raster",
        source: layer,
      });
    }

    // 显示目标图层
    map.current.setLayoutProperty(layer, "visibility", "visible");
    setMapLayer(layer);
  };

  // 导出当前选择区域的坐标边界
  const exportBounds = () => {
    if (selections.length === 0) {
      alert("没有选择区域可导出");
      return;
    }

    const bounds = selections.map((selection) => ({
      id: selection.id,
      shape: selection.shape,
      bbox: selection.bbox,
      center: selection.center,
      radius: selection.radius,
      coordinates: selection.coordinates,
    }));

    const data = {
      type: "BoundingBoxCollection",
      timestamp: new Date().toISOString(),
      count: bounds.length,
      bounds,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `map-bounds-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`${className} flex h-full`}>
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
              className="w-full pl-10 pr-10 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 hover:bg-gray-650"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              </div>
            )}
            {searchQuery && !isSearching && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
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
                  <div className="text-white text-sm font-medium truncate">
                    {result.display_name}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    {result.type} • {parseFloat(result.lat).toFixed(4)},{" "}
                    {parseFloat(result.lon).toFixed(4)}
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
              setMapMode("browse");
              clearInteractiveMode();
            }}
            className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              mapMode === "browse"
                ? "bg-blue-600 text-white shadow-lg scale-105 ring-2 ring-blue-400"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-102"
            }`}
          >
            {getModeIcon("browse")}
            浏览
          </button>
          <button
            onClick={() => {
              setMapMode("select");
              setIsInteractiveMode(true);
              clearInteractiveMode();
            }}
            className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              mapMode === "select"
                ? "bg-green-600 text-white shadow-lg scale-105 ring-2 ring-green-400"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-102"
            }`}
          >
            {getModeIcon("select")}
            选择
          </button>
          <button
            onClick={() => {
              setMapMode("erase");
              clearInteractiveMode();
            }}
            className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              mapMode === "erase"
                ? "bg-red-600 text-white shadow-lg scale-105 ring-2 ring-red-400"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-102"
            }`}
          >
            {getModeIcon("erase")}
            擦除
          </button>
        </div>

        {/* 地图图层选择 */}
        <div className="p-3 bg-gray-700 rounded-lg border border-gray-600">
          <div className="text-xs text-gray-300 mb-2 text-center font-medium">
            地图图层
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => switchMapLayer("osm")}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                mapLayer === "osm"
                  ? "bg-blue-600 text-white shadow-lg scale-105"
                  : "bg-gray-600 text-gray-300 hover:bg-gray-500"
              }`}
            >
              <Map className="h-3 w-3" />
              街道
            </button>
            <button
              onClick={() => switchMapLayer("satellite")}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                mapLayer === "satellite"
                  ? "bg-blue-600 text-white shadow-lg scale-105"
                  : "bg-gray-600 text-gray-300 hover:bg-gray-500"
              }`}
            >
              <Globe className="h-3 w-3" />
              卫星
            </button>
            <button
              onClick={() => switchMapLayer("terrain")}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                mapLayer === "terrain"
                  ? "bg-blue-600 text-white shadow-lg scale-105"
                  : "bg-gray-600 text-gray-300 hover:bg-gray-500"
              }`}
            >
              <Mountain className="h-3 w-3" />
              地形
            </button>
          </div>
        </div>

        {/* 形状选择 */}
        {mapMode === "select" && (
          <div className="p-3 bg-gray-700 rounded-lg border border-gray-600">
            <div className="text-xs text-gray-300 mb-2 text-center font-medium">
              选择形状
            </div>
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => handleShapeSelect("rectangle")}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                  selectionShape === "rectangle"
                    ? "bg-blue-600 text-white shadow-lg scale-105"
                    : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                }`}
              >
                {getShapeIcon("rectangle")}
                矩形
              </button>
              <button
                onClick={() => handleShapeSelect("circle")}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                  selectionShape === "circle"
                    ? "bg-blue-600 text-white shadow-lg scale-105"
                    : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                }`}
              >
                {getShapeIcon("circle")}
                圆形
              </button>
              <button
                onClick={() => handleShapeSelect("polygon")}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                  selectionShape === "polygon"
                    ? "bg-blue-600 text-white shadow-lg scale-105"
                    : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                }`}
              >
                {getShapeIcon("polygon")}
                多边形
              </button>
              <button
                onClick={() => handleShapeSelect("freehand")}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs transition-all duration-200 ${
                  selectionShape === "freehand"
                    ? "bg-blue-600 text-white shadow-lg scale-105"
                    : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                }`}
              >
                {getShapeIcon("freehand")}
                自由
              </button>
            </div>
          </div>
        )}

        {/* GeoJSON导入导出 */}
        <div className="p-3 bg-gray-700 rounded-lg border border-gray-600">
          <div className="text-xs text-gray-300 mb-2 text-center font-medium">
            数据导入导出
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => setShowGeoJSONPanel(!showGeoJSONPanel)}
              className="flex items-center justify-center gap-1 px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs transition-colors"
            >
              <Upload className="h-3 w-3" />
              导入
            </button>
            <button
              onClick={exportGeoJSON}
              disabled={selections.length === 0}
              className="flex items-center justify-center gap-1 px-2 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md text-xs transition-colors"
            >
              <Download className="h-3 w-3" />
              导出
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={exportBounds}
              disabled={selections.length === 0}
              className="flex items-center justify-center gap-1 px-2 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md text-xs transition-colors"
            >
              <FileText className="h-3 w-3" />
              边界
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1 px-2 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-xs transition-colors"
            >
              <Map className="h-3 w-3" />
              文件
            </button>
          </div>
        </div>

        {/* 操作提示 - 增强版 */}
        <div className="text-xs text-gray-400 p-3 bg-gradient-to-r from-gray-700 to-gray-600 rounded-lg border border-gray-500 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-3 h-3 rounded-full ${
                mapMode === "browse"
                  ? "bg-blue-400 shadow-blue-400/50"
                  : mapMode === "select"
                  ? "bg-green-400 shadow-green-400/50"
                  : mapMode === "erase"
                  ? "bg-red-400 shadow-red-400/50"
                  : "bg-gray-400"
              } animate-pulse shadow-lg`}
            ></div>
            <span className="font-semibold text-sm text-white">操作指南</span>
          </div>
          <div className="text-gray-200 text-xs leading-relaxed">
            {mapMode === "browse" && (
              <div className="space-y-1">
                <div>• 拖拽浏览地图，滚轮缩放</div>
                <div>• 中键/右键也可拖拽</div>
                <div>• 双击快速缩放</div>
              </div>
            )}
            {mapMode === "select" && !isInteractiveMode && (
              <div className="space-y-1">
                <div>• 先选择形状工具</div>
                <div>• 然后在地图上绘制区域</div>
                <div>• 支持多个选择区域</div>
              </div>
            )}
            {mapMode === "select" &&
              isInteractiveMode &&
              !interactiveStartPoint && (
                <div className="space-y-1 text-green-200">
                  <div>• 点击地图设置起始点</div>
                  <div>• 拖拽调整选择区域</div>
                </div>
              )}
            {mapMode === "select" &&
              isInteractiveMode &&
              interactiveStartPoint && (
                <div className="space-y-1 text-green-200">
                  <div>• 移动鼠标调整大小</div>
                  <div>• 再次点击完成选择</div>
                  <div>• ESC键取消选择</div>
                </div>
              )}
            {mapMode === "erase" && (
              <div className="space-y-1 text-red-200">
                <div>• 点击选择区域删除</div>
                <div>• 支持批量删除</div>
              </div>
            )}
            {isDrawing && (
              <div className="text-yellow-200 font-medium animate-pulse">
                正在绘制选择区域...
              </div>
            )}
          </div>
        </div>

        {/* 选择区域统计 */}
        {selections.length > 0 && (
          <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-200">
                已选择区域
              </span>
              <span className="text-xs text-blue-300 bg-blue-500/20 px-2 py-1 rounded-full">
                {selections.length} 个
              </span>
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {selections.slice(-3).map((selection, index) => (
                <div
                  key={selection.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-blue-200 truncate">
                    {selection.shape} #{selections.length - 2 + index}
                  </span>
                  <button
                    onClick={() => removeSelection(selection.id)}
                    className="text-red-400 hover:text-red-300 ml-2"
                  >
                    ×
                  </button>
                </div>
              ))}
              {selections.length > 3 && (
                <div className="text-xs text-blue-300 text-center pt-1 border-t border-blue-500/20">
                  还有 {selections.length - 3} 个区域...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 地图容器 - 占据剩余空间 */}
      <div className="flex-1 relative min-h-0">
        <div
          ref={mapContainer}
          className="w-full h-full"
          style={{ cursor: getMapCursor() }}
        />

        {/* SVG覆盖层 - 用于实时路径显示 */}
        {mapMode === "select" && (
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 1000, pointerEvents: "auto" }}
            onMouseMove={handleSVGMouseMove}
            onMouseDown={handleSVGMouseDown}
            onMouseUp={handleSVGMouseUp}
          >
            {/* 实时绘制路径 */}
            {svgPath && (
              <path
                d={svgPath}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            )}

            {/* 鼠标位置指示器 */}
            {currentMousePos && (
              <circle
                cx={currentMousePos.x}
                cy={currentMousePos.y}
                r="4"
                fill="#3b82f6"
                stroke="white"
                strokeWidth="2"
              />
            )}
          </svg>
        )}

        {/* 选择区域信息面板 */}
        {selections.length > 0 && (
          <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-lg p-3 max-w-xs border border-gray-600 shadow-2xl max-h-64 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <h4 className="text-sm font-semibold text-white">
                选择区域 ({selections.length})
              </h4>
              <button
                onClick={() => {
                  selections.forEach((s) => removeSelection(s.id));
                }}
                className="ml-auto p-1 text-gray-400 hover:text-red-400 transition-colors text-xs"
                title="清除所有选择"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {selections.map((selection, index) => (
                <div
                  key={selection.id}
                  className="p-2 bg-gray-800 rounded-md border border-gray-600"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      {getShapeIcon(selection.shape)}
                      <span className="font-medium text-green-400 text-xs">
                        {selection.shape === "rectangle"
                          ? "矩形"
                          : selection.shape === "circle"
                          ? "圆形"
                          : selection.shape === "polygon"
                          ? "多边形"
                          : "自由形状"}{" "}
                        {index + 1}
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
                    <div>
                      坐标: {selection.bbox.south.toFixed(4)},{" "}
                      {selection.bbox.west.toFixed(4)}
                    </div>
                    <div>
                      到: {selection.bbox.north.toFixed(4)},{" "}
                      {selection.bbox.east.toFixed(4)}
                    </div>
                    <div className="text-gray-400">
                      大小:{" "}
                      {(
                        (selection.bbox.east - selection.bbox.west) *
                        111320 *
                        Math.cos((selection.bbox.north * Math.PI) / 180)
                      ).toFixed(0)}
                      m ×{" "}
                      {(
                        (selection.bbox.north - selection.bbox.south) *
                        111320
                      ).toFixed(0)}
                      m
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
              {!interactiveStartPoint
                ? "点击地图设置起始点"
                : "移动鼠标调整大小，点击完成"}
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

        {/* GeoJSON导入面板 */}
        {showGeoJSONPanel && (
          <div className="absolute inset-4 bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-lg p-4 border border-gray-600 shadow-2xl z-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Upload className="h-5 w-5" />
                导入GeoJSON数据
              </h3>
              <button
                onClick={() => {
                  setShowGeoJSONPanel(false);
                  setGeoJSONText("");
                  setImportError(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  粘贴GeoJSON数据:
                </label>
                <textarea
                  value={geoJSONText}
                  onChange={(e) => {
                    setGeoJSONText(e.target.value);
                    setImportError(null);
                  }}
                  placeholder='粘贴GeoJSON数据，例如: {"type": "FeatureCollection", "features": [...]}'
                  className="w-full h-32 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {importError && (
                <div className="p-3 bg-red-900 border border-red-600 rounded-md">
                  <p className="text-red-300 text-sm">{importError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleTextImport}
                  disabled={!geoJSONText.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md text-sm transition-colors"
                >
                  导入数据
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  选择文件
                </button>
              </div>

              <div className="text-xs text-gray-400">
                <p className="mb-1">支持的格式:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>GeoJSON FeatureCollection</li>
                  <li>单个GeoJSON Feature</li>
                  <li>包含Polygon几何体的要素</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 键盘快捷键帮助面板 */}
        <div className="absolute bottom-4 right-4 bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-lg p-3 border border-gray-600 shadow-2xl max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <h4 className="text-sm font-semibold text-white">快捷键</h4>
          </div>

          <div className="space-y-1 text-xs text-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-400">ESC</span>
              <span>取消操作</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">1-4</span>
              <span>切换形状</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">B/S/E</span>
              <span>切换模式</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Del</span>
              <span>清除选择</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Enter</span>
              <span>生成模型</span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-gray-600">
            <div className="text-xs text-gray-400 space-y-1">
              <div>1-矩形 2-圆形 3-多边形 4-自由</div>
              <div>B-浏览 S-选择 E-擦除</div>
              <div className="text-blue-400 mt-1">
                Ctrl+拖拽 或 中键拖拽 = 平移地图
              </div>
            </div>
          </div>
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json"
          onChange={handleFileImport}
          className="hidden"
        />
      </div>
    </div>
  );
};
