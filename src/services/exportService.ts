import { Model3D } from '../types';

export class ExportService {
  static export3MF(models: Model3D[], filename: string = 'model.3mf'): void {
    // 生成3MF XML内容
    const xml = this.generate3MFContent(models);
    
    // 创建并下载文件
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  private static generate3MFContent(models: Model3D[]): string {
    console.log('开始生成3MF内容，模型数量:', models.length);
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="meter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">Overpass 3D Model</metadata>
  <metadata name="Designer">Overpass 3D Modeler</metadata>
  <metadata name="Description">从OpenStreetMap数据生成的3D模型</metadata>
  <resources>`;

    // 为每个模型添加顶点和三角形
    let objectId = 1;

    models.forEach((model) => {
      console.log(`处理模型 ${modelIndex}:`, model.id, model.type);
      
      const vertices: string[] = [];
      const triangles: string[] = [];
      
      if (model.geometry && model.geometry.attributes && model.geometry.attributes.position) {
        const positionAttr = model.geometry.attributes.position;
        const positions = positionAttr.array;
        const indices = model.geometry.index ? model.geometry.index.array : null;
        
        console.log(`模型 ${modelIndex} 顶点数:`, positions.length / 3);
        console.log(`模型 ${modelIndex} 索引数:`, indices ? indices.length : '无索引');
        
        // 添加顶点
        for (let i = 0; i < positions.length; i += 3) {
          // 应用模型的位置偏移
          const x = (positions[i] + (model.position[0] || 0)).toFixed(6);
          const y = (positions[i + 1] + (model.position[1] || 0)).toFixed(6);
          const z = (positions[i + 2] + (model.position[2] || 0)).toFixed(6);
          vertices.push(`    <vertex x="${x}" y="${y}" z="${z}" />`);
        }
        
        // 添加三角形
        if (indices) {
          for (let i = 0; i < indices.length; i += 3) {
            if (i + 2 < indices.length) {
              const v1 = indices[i];
              const v2 = indices[i + 1];
              const v3 = indices[i + 2];
              triangles.push(`    <triangle v1="${v1}" v2="${v2}" v3="${v3}" />`);
            }
          }
        } else {
          // 为非索引几何体生成三角形
          const vertexCount = Math.floor(positions.length / 3);
          console.log(`模型 ${modelIndex} 非索引几何体，顶点数:`, vertexCount);
          for (let i = 0; i < vertexCount; i += 3) {
            if (i + 2 < vertexCount) {
              const v1 = i;
              const v2 = i + 1;
              const v3 = i + 2;
              triangles.push(`    <triangle v1="${v1}" v2="${v2}" v3="${v3}" />`);
            }
          }
        }

        console.log(`模型 ${modelIndex} 生成顶点数:`, vertices.length, '三角形数:', triangles.length);
        
        if (vertices.length > 0 && triangles.length > 0) {
          xml += `
    <object id="${objectId}" type="model">
      <mesh>
        <vertices>
${vertices.join('\n')}
        </vertices>
        <triangles>
${triangles.join('\n')}
        </triangles>
      </mesh>
    </object>`;

          objectId++;
        } else {
          console.warn(`模型 ${modelIndex} 没有有效的几何数据`);
        }
      } else {
        console.warn(`模型 ${modelIndex} 缺少几何属性`);
      }
    });

    console.log('总共生成对象数:', objectId - 1);
    
    xml += `
  </resources>
  <build>`;

    // 添加构建项
    for (let i = 1; i < objectId; i++) {
      xml += `
    <item objectid="${i}" />`;
    }

    xml += `
  </build>
</model>`;

    console.log('3MF内容生成完成');
    return xml;
  }
}