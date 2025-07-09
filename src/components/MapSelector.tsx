import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SearchWidget from './SearchWidget';
import ShapeSelector, { ShapeType } from './ShapeSelector';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapSelectorProps {
  onAreaSelected: (bounds: L.LatLngBounds, shape: any) => void;
  selectedBounds: L.LatLngBounds | null;
}

export default function MapSelector({ onAreaSelected, selectedBounds }: MapSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentShapeRef = useRef<L.Layer | null>(null);
  const [selectedShape, setSelectedShape] = useState<ShapeType>('none');
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([39.9042, 116.4074], 10);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleLocationSelect = (lat: number, lon: number, bounds?: [number, number, number, number]) => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    map.setView([lat, lon], 12);
    
    if (bounds) {
      const leafletBounds = L.latLngBounds(
        [bounds[0], bounds[2]], // southwest
        [bounds[1], bounds[3]]  // northeast
      );
      map.fitBounds(leafletBounds);
    }
  };

  const startSelection = (shapeType: ShapeType) => {
    if (!mapInstanceRef.current || shapeType === 'none') {
      setIsSelecting(false);
      return;
    }

    setIsSelecting(true);
    const map = mapInstanceRef.current;

    // Remove existing shape
    if (currentShapeRef.current) {
      map.removeLayer(currentShapeRef.current);
      currentShapeRef.current = null;
    }

    if (shapeType === 'rectangle') {
      startRectangleSelection(map);
    } else if (shapeType === 'circle') {
      startCircleSelection(map);
    } else if (shapeType === 'polygon') {
      startPolygonSelection(map);
    }
  };

  const startRectangleSelection = (map: L.Map) => {
    let startLatLng: L.LatLng | null = null;
    let tempRectangle: L.Rectangle | null = null;

    const onMouseDown = (e: L.LeafletMouseEvent) => {
      startLatLng = e.latlng;
      map.dragging.disable();
    };

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      if (!startLatLng) return;

      if (tempRectangle) {
        map.removeLayer(tempRectangle);
      }

      const bounds = L.latLngBounds(startLatLng, e.latlng);
      tempRectangle = L.rectangle(bounds, {
        color: '#3b82f6',
        weight: 2,
        fillOpacity: 0.2
      }).addTo(map);
    };

    const onMouseUp = (e: L.LeafletMouseEvent) => {
      if (!startLatLng) return;

      const bounds = L.latLngBounds(startLatLng, e.latlng);
      
      if (tempRectangle) {
        map.removeLayer(tempRectangle);
      }

      currentShapeRef.current = L.rectangle(bounds, {
        color: '#3b82f6',
        weight: 2,
        fillOpacity: 0.2
      }).addTo(map);

      onAreaSelected(bounds, { type: 'rectangle', bounds });
      setIsSelecting(false);
      map.dragging.enable();

      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
  };

  const startCircleSelection = (map: L.Map) => {
    let centerLatLng: L.LatLng | null = null;
    let tempCircle: L.Circle | null = null;

    const onMouseDown = (e: L.LeafletMouseEvent) => {
      centerLatLng = e.latlng;
      map.dragging.disable();
    };

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      if (!centerLatLng) return;

      if (tempCircle) {
        map.removeLayer(tempCircle);
      }

      const radius = centerLatLng.distanceTo(e.latlng);
      tempCircle = L.circle(centerLatLng, {
        radius,
        color: '#3b82f6',
        weight: 2,
        fillOpacity: 0.2
      }).addTo(map);
    };

    const onMouseUp = (e: L.LeafletMouseEvent) => {
      if (!centerLatLng) return;

      const radius = centerLatLng.distanceTo(e.latlng);
      
      if (tempCircle) {
        map.removeLayer(tempCircle);
      }

      const circle = L.circle(centerLatLng, {
        radius,
        color: '#3b82f6',
        weight: 2,
        fillOpacity: 0.2
      }).addTo(map);

      currentShapeRef.current = circle;
      const bounds = circle.getBounds();
      onAreaSelected(bounds, { type: 'circle', center: centerLatLng, radius });
      setIsSelecting(false);
      map.dragging.enable();

      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
  };

  const startPolygonSelection = (map: L.Map) => {
    const points: L.LatLng[] = [];
    let tempPolygon: L.Polygon | null = null;

    const onClick = (e: L.LeafletMouseEvent) => {
      points.push(e.latlng);

      if (tempPolygon) {
        map.removeLayer(tempPolygon);
      }

      if (points.length >= 2) {
        tempPolygon = L.polygon(points, {
          color: '#3b82f6',
          weight: 2,
          fillOpacity: 0.2
        }).addTo(map);
      }
    };

    const onDoubleClick = () => {
      if (points.length < 3) return;

      if (tempPolygon) {
        map.removeLayer(tempPolygon);
      }

      const polygon = L.polygon(points, {
        color: '#3b82f6',
        weight: 2,
        fillOpacity: 0.2
      }).addTo(map);

      currentShapeRef.current = polygon;
      const bounds = polygon.getBounds();
      onAreaSelected(bounds, { type: 'polygon', points });
      setIsSelecting(false);

      map.off('click', onClick);
      map.off('dblclick', onDoubleClick);
    };

    map.on('click', onClick);
    map.on('dblclick', onDoubleClick);
  };

  useEffect(() => {
    if (selectedShape !== 'none') {
      startSelection(selectedShape);
    } else {
      setIsSelecting(false);
    }
  }, [selectedShape]);

  return (
    <div className="space-y-4">
      <SearchWidget onLocationSelect={handleLocationSelect} />
      
      <div className="relative">
        <div className="absolute top-4 left-4 z-[1000]">
          <ShapeSelector
            selectedShape={selectedShape}
            onShapeSelect={setSelectedShape}
            isSelecting={isSelecting}
          />
        </div>
        
        <div 
          ref={mapRef} 
          className="w-full h-96 rounded-lg border border-gray-300"
          style={{ cursor: isSelecting ? 'crosshair' : 'grab' }}
        />
      </div>
      
      {selectedBounds && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            已选择区域: {selectedBounds.getNorth().toFixed(4)}, {selectedBounds.getWest().toFixed(4)} 
            到 {selectedBounds.getSouth().toFixed(4)}, {selectedBounds.getEast().toFixed(4)}
          </p>
        </div>
      )}
    </div>
  );
}