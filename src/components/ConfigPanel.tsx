import React, { useState } from 'react';
import { ModelConfig, BasicConfig } from '../types';
import { Settings, Home, Grid as Bridge, Waves, Trees, Mountain, Sliders, Type, Map } from 'lucide-react';

interface ConfigPanelProps {
  basicConfig: BasicConfig;
  modelConfig: ModelConfig;
  onBasicConfigChange: (config: BasicConfig) => void;
  onModelConfigChange: (config: ModelConfig) => void;
  className?: string;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ 
  basicConfig, 
  modelConfig, 
  onBasicConfigChange, 
  onModelConfigChange, 
  className 
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'model'>('basic');

  const updateBasicConfig = (field: string, value: any) => {
    const keys = field.split('.');
    if (keys.length === 1) {
      onBasicConfigChange({
        ...basicConfig,
        [field]: value
      });
    } else {
      const [category, subField] = keys;
      onBasicConfigChange({
        ...basicConfig,
        [category]: {
          ...(basicConfig as any)[category],
          [subField]: value
        }
      });
    }
  };

  const updateModelConfig = (category: keyof ModelConfig, field: string, value: any) => {
    const keys = field.split('.');
    if (keys.length === 1) {
      onModelConfigChange({
        ...modelConfig,
        [category]: {
          ...modelConfig[category],
          [field]: value
        }
      });
    } else {
      const [subCategory, subField] = keys;
      onModelConfigChange({
        ...modelConfig,
        [category]: {
          ...modelConfig[category],
          [subCategory]: {
            ...(modelConfig[category] as any)[subCategory],
            [subField]: value
          }
        }
      });
    }
  };

  const BasicConfigSection = () => (
    <div className="space-y-4">
      {/* 基础渲染配置 */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Sliders className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-medium text-white">基础渲染</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              3D渲染高度缩放
            </label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={basicConfig.renderHeight}
              onChange={(e) => updateBasicConfig('renderHeight', parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-xs text-gray-400">{basicConfig.renderHeight}x</span>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              基础颜色
            </label>
            <input
              type="color"
              value={basicConfig.baseColor}
              onChange={(e) => updateBasicConfig('baseColor', e.target.value)}
              className="w-full h-10 rounded-md border border-gray-600 bg-gray-700"
            />
          </div>
        </div>
      </div>

      {/* 标签配置 */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Type className="h-5 w-5 text-green-400" />
          <h3 className="text-lg font-medium text-white">地图标签</h3>
          <label className="ml-auto flex items-center">
            <input
              type="checkbox"
              checked={basicConfig.showLabels}
              onChange={(e) => updateBasicConfig('showLabels', e.target.checked)}
              className="sr-only"
            />
            <div className={`relative inline-block w-10 h-6 transition-colors duration-200 ease-in-out rounded-full ${
              basicConfig.showLabels ? 'bg-green-600' : 'bg-gray-600'
            }`}>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${
                basicConfig.showLabels ? 'transform translate-x-4' : ''
              }`} />
            </div>
          </label>
        </div>
        
        {basicConfig.showLabels && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                字体大小
              </label>
              <input
                type="number"
                value={basicConfig.labelConfig.fontSize}
                onChange={(e) => updateBasicConfig('labelConfig.fontSize', parseInt(e.target.value) || 12)}
                min="8"
                max="24"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                字体颜色
              </label>
              <input
                type="color"
                value={basicConfig.labelConfig.color}
                onChange={(e) => updateBasicConfig('labelConfig.color', e.target.value)}
                className="w-full h-10 rounded-md border border-gray-600 bg-gray-700"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                字体族
              </label>
              <select
                value={basicConfig.labelConfig.fontFamily}
                onChange={(e) => updateBasicConfig('labelConfig.fontFamily', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 坐标系统配置 */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Map className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-medium text-white">坐标系统</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              投影方式
            </label>
            <select
              value={basicConfig.coordinateSystem.projection}
              onChange={(e) => updateBasicConfig('coordinateSystem.projection', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              <option value="mercator">墨卡托投影</option>
              <option value="geographic">地理坐标</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              缩放比例
            </label>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={basicConfig.coordinateSystem.scale}
              onChange={(e) => updateBasicConfig('coordinateSystem.scale', parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-xs text-gray-400">{basicConfig.coordinateSystem.scale}x</span>
          </div>
        </div>
      </div>
    </div>
  );

  const ModelConfigSection = ({ 
    title, 
    icon: Icon, 
    category, 
    fields 
  }: { 
    title: string; 
    icon: any; 
    category: keyof ModelConfig; 
    fields: Array<{ key: string; label: string; type: string; min?: number; max?: number; step?: number; options?: string[] }>;
  }) => (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Icon className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-medium text-white">{title}</h3>
        <label className="ml-auto flex items-center">
          <input
            type="checkbox"
            checked={(modelConfig[category] as any).enabled}
            onChange={(e) => updateModelConfig(category, 'enabled', e.target.checked)}
            className="sr-only"
          />
          <div className={`relative inline-block w-10 h-6 transition-colors duration-200 ease-in-out rounded-full ${
            (modelConfig[category] as any).enabled ? 'bg-blue-600' : 'bg-gray-600'
          }`}>
            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${
              (modelConfig[category] as any).enabled ? 'transform translate-x-4' : ''
            }`} />
          </div>
        </label>
      </div>
      
      {(modelConfig[category] as any).enabled && (
        <div className="space-y-4">
          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {field.label}
              </label>
              {field.type === 'color' ? (
                <input
                  type="color"
                  value={(modelConfig[category] as any)[field.key]}
                  onChange={(e) => updateModelConfig(category, field.key, e.target.value)}
                  className="w-full h-10 rounded-md border border-gray-600 bg-gray-700"
                />
              ) : field.type === 'select' ? (
                <select
                  value={(modelConfig[category] as any)[field.key]}
                  onChange={(e) => updateModelConfig(category, field.key, e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  {field.options?.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={(modelConfig[category] as any)[field.key]}
                    onChange={(e) => updateModelConfig(category, field.key, e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-gray-300">启用</span>
                </label>
              ) : (
                <input
                  type="number"
                  value={(modelConfig[category] as any)[field.key]}
                  onChange={(e) => updateModelConfig(category, field.key, parseFloat(e.target.value) || 0)}
                  min={field.min}
                  max={field.max}
                  step={field.step || 0.1}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-blue-400" />
        <h2 className="text-xl font-bold text-white">配置面板</h2>
      </div>
      
      {/* 标签页切换 */}
      <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'basic' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          基础配置
        </button>
        <button
          onClick={() => setActiveTab('model')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'model' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          模型配置
        </button>
      </div>
      
      <div className="space-y-4 max-h-full overflow-y-auto">
        {activeTab === 'basic' ? (
          <BasicConfigSection />
        ) : (
          <>
            <ModelConfigSection
              title="地形"
              icon={Mountain}
              category="terrain"
              fields={[
                { key: 'baseHeight', label: '基础高度 (米)', type: 'number', min: 0.1, max: 10 },
                { key: 'elevationScale', label: '高程缩放', type: 'number', min: 0.1, max: 5 },
                { key: 'color', label: '颜色', type: 'color' },
                { key: 'textureConfig.enabled', label: '纹理', type: 'checkbox' },
                { key: 'textureConfig.type', label: '纹理类型', type: 'select', options: ['grass', 'concrete', 'dirt'] }
              ]}
            />

            <ModelConfigSection
              title="建筑"
              icon={Home}
              category="buildings"
              fields={[
                { key: 'baseHeight', label: '基础高度 (米)', type: 'number', min: 1, max: 50 },
                { key: 'maxHeight', label: '最大高度 (米)', type: 'number', min: 5, max: 200 },
                { key: 'color', label: '颜色', type: 'color' },
                { key: 'roofConfig.enabled', label: '屋顶', type: 'checkbox' },
                { key: 'roofConfig.type', label: '屋顶类型', type: 'select', options: ['flat', 'pitched', 'dome'] },
                { key: 'windowConfig.enabled', label: '窗户', type: 'checkbox' }
              ]}
            />

            <ModelConfigSection
              title="道路"
              icon={Settings}
              category="roads"
              fields={[
                { key: 'height', label: '高度 (米)', type: 'number', min: 0.05, max: 2 },
                { key: 'width', label: '宽度 (米)', type: 'number', min: 1, max: 20 },
                { key: 'color', label: '颜色', type: 'color' }
              ]}
            />

            <ModelConfigSection
              title="桥梁"
              icon={Bridge}
              category="bridges"
              fields={[
                { key: 'height', label: '高度 (米)', type: 'number', min: 0.5, max: 5 },
                { key: 'width', label: '宽度 (米)', type: 'number', min: 2, max: 30 },
                { key: 'color', label: '颜色', type: 'color' },
                { key: 'pillarConfig.enabled', label: '支柱', type: 'checkbox' },
                { key: 'pillarConfig.spacing', label: '支柱间距', type: 'number', min: 5, max: 50 }
              ]}
            />

            <ModelConfigSection
              title="水体"
              icon={Waves}
              category="water"
              fields={[
                { key: 'height', label: '高度 (米)', type: 'number', min: -2, max: 5 },
                { key: 'color', label: '颜色', type: 'color' },
                { key: 'waveConfig.enabled', label: '波浪效果', type: 'checkbox' },
                { key: 'waveConfig.amplitude', label: '波浪幅度', type: 'number', min: 0.1, max: 2 }
              ]}
            />

            <ModelConfigSection
              title="植被"
              icon={Trees}
              category="vegetation"
              fields={[
                { key: 'height', label: '高度 (米)', type: 'number', min: 0.1, max: 3 },
                { key: 'density', label: '密度', type: 'number', min: 0.1, max: 2 },
                { key: 'color', label: '颜色', type: 'color' },
                { key: 'treeConfig.enabled', label: '树木', type: 'checkbox' },
                { key: 'treeConfig.randomness', label: '随机性', type: 'number', min: 0, max: 1, step: 0.1 }
              ]}
            />
          </>
        )}
      </div>
    </div>
  );
};