import React from 'react';
import { Map, Layers, Download, Settings, Zap, Shield } from 'lucide-react';

export default function Features() {
  const features = [
    {
      icon: Map,
      title: 'Multiple Map Sources',
      description: 'Support for various map formats including OpenStreetMap, Google Maps, and custom elevation data.'
    },
    {
      icon: Layers,
      title: 'Customizable Layers',
      description: 'Add buildings, roads, vegetation, and terrain details to create comprehensive 3D models.'
    },
    {
      icon: Settings,
      title: 'Advanced Configuration',
      description: 'Fine-tune scale, resolution, base thickness, and vertical exaggeration for perfect results.'
    },
    {
      icon: Zap,
      title: 'Fast Processing',
      description: 'Optimized algorithms ensure quick conversion from map data to 3D printable models.'
    },
    {
      icon: Download,
      title: 'Multiple Formats',
      description: 'Export to 3MF, STL, OBJ, and other popular 3D printing formats.'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your map data is processed securely and never stored on our servers.'
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Powerful Features for Perfect Models
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to create stunning 3D printed maps and terrain models
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-8 hover:shadow-md transition-shadow">
              <div className="bg-blue-100 rounded-lg p-3 inline-block mb-4">
                <feature.icon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}