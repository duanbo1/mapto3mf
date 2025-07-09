import React from 'react';
import { Square, Circle, Hexagon as Polygon, MousePointer } from 'lucide-react';

export type ShapeType = 'rectangle' | 'circle' | 'polygon' | 'none';

interface ShapeSelectorProps {
  selectedShape: ShapeType;
  onShapeSelect: (shape: ShapeType) => void;
  isSelecting: boolean;
}

export default function ShapeSelector({ selectedShape, onShapeSelect, isSelecting }: ShapeSelectorProps) {
  const shapes = [
    { type: 'rectangle' as ShapeType, icon: Square, label: '矩形选择' },
    { type: 'circle' as ShapeType, icon: Circle, label: '圆形选择' },
    { type: 'polygon' as ShapeType, icon: Polygon, label: '多边形选择' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onShapeSelect('none')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors ${
            selectedShape === 'none' 
              ? 'bg-gray-100 text-gray-700' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <MousePointer className="h-4 w-4" />
          浏览
        </button>
        
        <div className="w-px h-6 bg-gray-300" />
        
        {shapes.map((shape) => (
          <button
            key={shape.type}
            onClick={() => onShapeSelect(shape.type)}
            disabled={isSelecting}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors ${
              selectedShape === shape.type
                ? 'bg-blue-600 text-white'
                : isSelecting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
            title={shape.label}
          >
            <shape.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{shape.label}</span>
          </button>
        ))}
      </div>
      
      {isSelecting && (
        <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
          {selectedShape === 'rectangle' && '拖拽鼠标绘制矩形区域'}
          {selectedShape === 'circle' && '点击中心点，拖拽设置半径'}
          {selectedShape === 'polygon' && '点击绘制多边形顶点，双击完成'}
        </div>
      )}
    </div>
  );
}