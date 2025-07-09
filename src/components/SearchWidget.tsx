import React, { useState } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
}

interface SearchWidgetProps {
  onLocationSelect: (lat: number, lon: number, bounds?: [number, number, number, number]) => void;
}

export default function SearchWidget({ onLocationSelect }: SearchWidgetProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchLocation = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      setResults(data);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchLocation(query);
  };

  const selectLocation = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const bounds: [number, number, number, number] = [
      parseFloat(result.boundingbox[0]), // south
      parseFloat(result.boundingbox[1]), // north
      parseFloat(result.boundingbox[2]), // west
      parseFloat(result.boundingbox[3])  // east
    ];
    
    onLocationSelect(lat, lon, bounds);
    setShowResults(false);
    setQuery(result.display_name);
  };

  return (
    <div className="relative">
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索城市、地址或地标..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />
          )}
        </div>
      </form>

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[1001] max-h-60 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={index}
              onClick={() => selectLocation(result)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-start gap-3"
            >
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {result.display_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}