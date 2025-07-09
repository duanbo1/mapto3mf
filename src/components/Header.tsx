import React from 'react';
import { Mountain, Menu, X } from 'lucide-react';

interface HeaderProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

export default function Header({ isMobileMenuOpen, setIsMobileMenuOpen }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Mountain className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Map2Model</span>
            </div>
            <nav className="hidden md:ml-10 md:flex space-x-8">
              <a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                Home
              </a>
              <a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                Features
              </a>
              <a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                Gallery
              </a>
              <a href="#" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
                About
              </a>
            </nav>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            <button className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors">
              Sign In
            </button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Get Started
            </button>
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-700 hover:text-blue-600 p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <a href="#" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
              Home
            </a>
            <a href="#" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
              Features
            </a>
            <a href="#" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
              Gallery
            </a>
            <a href="#" className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
              About
            </a>
            <div className="pt-4 border-t border-gray-200">
              <button className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600">
                Sign In
              </button>
              <button className="block w-full mt-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-base font-medium hover:bg-blue-700">
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}