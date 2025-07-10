import { BoundingBox, OSMData } from '../types';

export class OverpassService {
  private static readonly API_URL = 'https://overpass-api.de/api/interpreter';

  static async queryArea(bbox: BoundingBox): Promise<OSMData> {
    const query = this.buildQuery(bbox);
    
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // 处理数据，确保每个元素都有正确的几何信息
      const processedData = this.processOSMData(data);
      
      return processedData;
    } catch (error) {
      console.error('Error fetching from Overpass API:', error);
      throw error;
    }
  }

  private static buildQuery(bbox: BoundingBox): string {
    const { south, west, north, east } = bbox;
    
    // 构建更精确的Overpass查询
    return `[out:json][timeout:30];
(
  // Buildings with geometry
  way["building"](${south},${west},${north},${east});
  relation["building"](${south},${west},${north},${east});
  
  // Roads and highways
  way["highway"~"^(primary|secondary|tertiary|residential|service|footway|cycleway|path|trunk|motorway)$"](${south},${west},${north},${east});
  
  // Bridges
  way["bridge"="yes"](${south},${west},${north},${east});
  way["highway"]["bridge"="yes"](${south},${west},${north},${east});
  
  // Water features
  way["waterway"~"^(river|stream|canal)$"](${south},${west},${north},${east});
  way["natural"="water"](${south},${west},${north},${east});
  relation["natural"="water"](${south},${west},${north},${east});
  
  // Green areas and vegetation
  way["landuse"~"^(grass|forest|meadow|park)$"](${south},${west},${north},${east});
  way["natural"~"^(wood|forest|grassland)$"](${south},${west},${north},${east});
  way["leisure"~"^(park|garden)$"](${south},${west},${north},${east});
  
  // Railways
  way["railway"~"^(rail|light_rail|subway)$"](${south},${west},${north},${east});
);
out geom;`;
  }

  private static processOSMData(rawData: any): OSMData {
    if (!rawData || !rawData.elements) {
      return { elements: [] };
    }

    const processedElements = rawData.elements.map((element: any) => {
      // 确保每个元素都有正确的几何信息
      if (element.type === 'way' && element.geometry) {
        // Way元素已经有geometry数组
        return {
          ...element,
          geometry: element.geometry.map((point: any) => ({
            lat: point.lat,
            lon: point.lon
          }))
        };
      } else if (element.type === 'node') {
        // Node元素转换为单点geometry
        return {
          ...element,
          geometry: [{
            lat: element.lat,
            lon: element.lon
          }]
        };
      } else if (element.type === 'relation' && element.members) {
        // 关系元素需要特殊处理，这里简化处理
        // 在实际应用中，需要解析relation的members来构建几何形状
        return {
          ...element,
          geometry: [] // 暂时为空，需要更复杂的处理
        };
      }

      return element;
    }).filter((element: any) => {
      // 过滤掉没有有效几何信息的元素
      return element.geometry && element.geometry.length > 0;
    });

    return {
      elements: processedElements
    };
  }
}