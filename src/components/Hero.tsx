import React from 'react';
import { ArrowRight, Play } from 'lucide-react';

interface HeroProps {
  onGetStarted: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Transform Maps into
            <span className="text-blue-600 block">3D Printable Models</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Convert any geographical map into a detailed 3D model ready for 3D printing. 
            Create stunning terrain models, cityscapes, and topographical representations with just a few clicks.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={onGetStarted}
              className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-blue-700 transition-all transform hover:scale-105 flex items-center gap-2"
            >
              Start Creating
              <ArrowRight className="h-5 w-5" />
            </button>
            <button className="text-gray-700 hover:text-blue-600 px-8 py-4 rounded-lg text-lg font-medium transition-colors flex items-center gap-2">
              <Play className="h-5 w-5" />
              Watch Demo
            </button>
          </div>
        </div>
        
        <div className="mt-16 relative">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="bg-gray-100 rounded-lg p-6 h-48 flex items-center justify-center">
                <span className="text-gray-500 text-lg">Interactive Map Preview</span>
              </div>
              <div className="bg-gray-100 rounded-lg p-6 h-48 flex items-center justify-center">
                <span className="text-gray-500 text-lg">3D Model Preview</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}