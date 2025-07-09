import React, { useState } from 'react';
import { Upload, MapPin, Settings, Download, Loader2, CheckCircle } from 'lucide-react';

export default function ModelGenerator() {
  const [activeStep, setActiveStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const steps = [
    { number: 1, title: 'Upload Map', icon: Upload },
    { number: 2, title: 'Configure', icon: Settings },
    { number: 3, title: 'Generate', icon: MapPin },
    { number: 4, title: 'Download', icon: Download }
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setActiveStep(2);
    }
  };

  const handleGenerate = () => {
    setIsProcessing(true);
    setActiveStep(3);
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      setIsComplete(true);
      setActiveStep(4);
    }, 3000);
  };

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Create Your 3D Model
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Follow these simple steps to transform your map into a 3D printable model
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center space-x-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full ${
                  activeStep >= step.number ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {activeStep > step.number ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    <step.icon className="h-6 w-6" />
                  )}
                </div>
                <span className={`ml-3 font-medium ${
                  activeStep >= step.number ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 ml-8 ${
                    activeStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
          {activeStep === 1 && (
            <div className="text-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-blue-400 transition-colors">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Your Map</h3>
                <p className="text-gray-600 mb-6">
                  Drag and drop your map file or click to browse. Supports JPG, PNG, GeoTIFF, and KML formats.
                </p>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".jpg,.jpeg,.png,.tiff,.kml,.geotiff"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
                >
                  Choose File
                </label>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Configure Your Model</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scale (1:{' '}
                    </label>
                    <input
                      type="number"
                      defaultValue="25000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Base Thickness (mm)
                    </label>
                    <input
                      type="number"
                      defaultValue="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vertical Exaggeration
                    </label>
                    <input
                      type="number"
                      defaultValue="2"
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Output Format
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="3mf">3MF (Recommended)</option>
                      <option value="stl">STL</option>
                      <option value="obj">OBJ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resolution
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="high">High (Best Quality)</option>
                      <option value="medium">Medium (Balanced)</option>
                      <option value="low">Low (Fast)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" defaultChecked />
                      <span className="text-sm text-gray-700">Include buildings</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" defaultChecked />
                      <span className="text-sm text-gray-700">Include roads</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm text-gray-700">Include water bodies</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-8 text-center">
                <button
                  onClick={handleGenerate}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Generate 3D Model
                </button>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="text-center">
              <div className="mb-8">
                {isProcessing ? (
                  <Loader2 className="h-16 w-16 text-blue-600 mx-auto animate-spin" />
                ) : (
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {isProcessing ? 'Processing Your Model...' : 'Model Generated Successfully!'}
              </h3>
              <p className="text-gray-600 mb-6">
                {isProcessing 
                  ? 'Please wait while we convert your map into a 3D model. This may take a few moments.'
                  : 'Your 3D model has been generated and is ready for download.'
                }
              </p>
              {isProcessing && (
                <div className="bg-gray-200 rounded-full h-2 max-w-md mx-auto">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              )}
            </div>
          )}

          {activeStep === 4 && (
            <div className="text-center">
              <div className="bg-green-50 rounded-lg p-6 mb-8">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Your 3D Model is Ready!
                </h3>
                <p className="text-gray-600">
                  Model size: 15.2 MB | Format: 3MF | Vertices: 125,843
                </p>
              </div>
              
              <div className="flex justify-center space-x-4">
                <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download Model
                </button>
                <button className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                  Preview in Browser
                </button>
              </div>
              
              <div className="mt-8 text-center">
                <button
                  onClick={() => {
                    setActiveStep(1);
                    setFile(null);
                    setIsProcessing(false);
                    setIsComplete(false);
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Create Another Model
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}