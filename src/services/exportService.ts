import { Model3D } from "../types";

/**
 * 3D模型导出服务
 * 支持导出为3MF格式，包含材质信息和优化的几何体处理
 */
export class ExportService {
  /**
   * 将3D模型导出为3MF格式文件
   * @param models - 要导出的3D模型数组
   * @param filename - 导出文件名，默认为"model.3mf"
   * @param onProgress - 可选的进度回调函数
   */
  static export3MF(
    models: Model3D[],
    filename: string = "model.3mf",
    onProgress?: (progress: number) => void
  ): void {
    if (!models || models.length === 0) {
      console.warn("没有可导出的模型数据");
      return;
    }

    try {
      // 生成3MF XML内容
      const xml = this.generate3MFContent(models, onProgress);

      // 创建并下载文件
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      if (onProgress) onProgress(1.0);
      console.log(`成功导出3MF文件: ${filename}`);
    } catch (error) {
      console.error("导出3MF文件时出错:", error);
      throw error;
    }
  }

  /**
   * 将3D模型导出为STL格式文件
   * @param models - 要导出的3D模型数组
   * @param filename - 导出文件名，默认为"model.stl"
   * @param onProgress - 可选的进度回调函数
   */
  static exportSTL(
    models: Model3D[],
    filename: string = "model.stl",
    onProgress?: (progress: number) => void
  ): void {
    if (!models || models.length === 0) {
      console.warn("没有可导出的模型数据");
      return;
    }

    try {
      // 生成STL内容
      const stlContent = this.generateSTLContent(models, onProgress);

      // 创建并下载文件
      const blob = new Blob([stlContent], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      if (onProgress) onProgress(1.0);
      console.log(`成功导出STL文件: ${filename}`);
    } catch (error) {
      console.error("导出STL文件时出错:", error);
      throw error;
    }
  }

  /**
   * 导出为GeoJSON格式
   * @param models - 要导出的3D模型数组
   * @param bbox - 边界框信息
   * @param filename - 导出文件名
   */
  static exportGeoJSON(
    models: Model3D[],
    bbox: any,
    filename: string = "model.geojson"
  ): void {
    if (!models || models.length === 0) {
      console.warn("没有可导出的模型数据");
      return;
    }

    try {
      const geoJSON = this.generateGeoJSONContent(models, bbox);
      const blob = new Blob([JSON.stringify(geoJSON, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      console.log(`成功导出GeoJSON文件: ${filename}`);
    } catch (error) {
      console.error("导出GeoJSON文件时出错:", error);
      throw error;
    }
  }

  /**
   * 验证几何体数据的有效性
   * @param geometry - Three.js几何体
   * @returns 是否有效
   */
  private static validateGeometry(geometry: any): boolean {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) {
      return false;
    }

    const positions = geometry.attributes.position.array;
    if (!positions || positions.length === 0 || positions.length % 3 !== 0) {
      return false;
    }

    // 检查是否有无效的坐标值
    for (let i = 0; i < positions.length; i++) {
      if (!isFinite(positions[i]) || isNaN(positions[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * 验证坐标的有效性
   * @param x - X坐标
   * @param y - Y坐标
   * @param z - Z坐标
   * @returns 是否有效
   */
  private static isValidCoordinate(x: string, y: string, z: string): boolean {
    const numX = parseFloat(x);
    const numY = parseFloat(y);
    const numZ = parseFloat(z);

    return (
      isFinite(numX) &&
      isFinite(numY) &&
      isFinite(numZ) &&
      !isNaN(numX) &&
      !isNaN(numY) &&
      !isNaN(numZ)
    );
  }

  /**
   * 根据类型获取颜色
   * @param type - 模型类型
   * @returns 颜色值
   */
  private static getColorForType(type: string): string {
    const colorMap: { [key: string]: string } = {
      building: "#8B4513",
      road: "#696969",
      water: "#4169E1",
      vegetation: "#228B22",
      default: "#808080",
    };
    return colorMap[type] || colorMap["default"];
  }

  /**
   * 生成GeoJSON内容
   * @param models - 模型数组
   * @param bbox - 边界框
   * @returns GeoJSON对象
   */
  private static generateGeoJSONContent(models: Model3D[], bbox: any): any {
    const features = models.map((model, index) => ({
      type: "Feature",
      properties: {
        id: model.id || `model_${index}`,
        type: model.type,
        name: model.name || `Model ${index + 1}`,
      },
      geometry: {
        type: "Point",
        coordinates: [model.position?.x || 0, model.position?.z || 0],
      },
    }));

    return {
      type: "FeatureCollection",
      bbox: bbox ? [bbox.min.x, bbox.min.z, bbox.max.x, bbox.max.z] : undefined,
      features,
    };
  }

  /**
   * 生成STL格式内容
   * @param models - 模型数组
   * @param onProgress - 进度回调
   * @returns STL格式字符串
   */
  private static generateSTLContent(
    models: Model3D[],
    onProgress?: (progress: number) => void
  ): string {
    console.log("开始生成STL内容，模型数量:", models.length);

    let stlContent = "solid OSM_Model\n";
    let totalTriangles = 0;

    // 计算总三角形数量用于进度显示
    const totalModels = models.length;
    let processedModels = 0;

    for (const model of models) {
      if (!model.geometry || !this.validateGeometry(model.geometry)) {
        console.warn(`模型 ${model.id} 缺少几何体数据`);
        continue;
      }

      // 处理BufferGeometry
      if (model.geometry.attributes && model.geometry.attributes.position) {
        const positionAttr = model.geometry.attributes.position;
        const positions = positionAttr.array;
        const indices = model.geometry.index
          ? model.geometry.index.array
          : null;

        if (indices) {
          // 有索引的几何体
          for (let i = 0; i < indices.length; i += 3) {
            if (i + 2 < indices.length) {
              const i1 = indices[i] * 3;
              const i2 = indices[i + 1] * 3;
              const i3 = indices[i + 2] * 3;

              // 获取三角形的三个顶点
              const v1 = {
                x: positions[i1],
                y: positions[i1 + 1],
                z: positions[i1 + 2],
              };
              const v2 = {
                x: positions[i2],
                y: positions[i2 + 1],
                z: positions[i2 + 2],
              };
              const v3 = {
                x: positions[i3],
                y: positions[i3 + 1],
                z: positions[i3 + 2],
              };

              // 验证顶点有效性
              if (
                this.isValidVertex(v1) &&
                this.isValidVertex(v2) &&
                this.isValidVertex(v3)
              ) {
                // 计算法向量
                const normal = this.calculateNormal(v1, v2, v3);

                // 写入STL三角面格式
                stlContent += `  facet normal ${normal.x.toFixed(
                  6
                )} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
                stlContent += "    outer loop\n";
                stlContent += `      vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(
                  6
                )} ${v1.z.toFixed(6)}\n`;
                stlContent += `      vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(
                  6
                )} ${v2.z.toFixed(6)}\n`;
                stlContent += `      vertex ${v3.x.toFixed(6)} ${v3.y.toFixed(
                  6
                )} ${v3.z.toFixed(6)}\n`;
                stlContent += "    endloop\n";
                stlContent += "  endfacet\n";

                totalTriangles++;
              }
            }
          }
        } else {
          // 无索引的几何体，每3个顶点组成一个三角形
          for (let i = 0; i < positions.length; i += 9) {
            if (i + 8 < positions.length) {
              // 获取三角形的三个顶点
              const v1 = {
                x: positions[i],
                y: positions[i + 1],
                z: positions[i + 2],
              };
              const v2 = {
                x: positions[i + 3],
                y: positions[i + 4],
                z: positions[i + 5],
              };
              const v3 = {
                x: positions[i + 6],
                y: positions[i + 7],
                z: positions[i + 8],
              };

              // 验证顶点有效性
              if (
                this.isValidVertex(v1) &&
                this.isValidVertex(v2) &&
                this.isValidVertex(v3)
              ) {
                // 计算法向量
                const normal = this.calculateNormal(v1, v2, v3);

                // 写入STL三角面格式
                stlContent += `  facet normal ${normal.x.toFixed(
                  6
                )} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
                stlContent += "    outer loop\n";
                stlContent += `      vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(
                  6
                )} ${v1.z.toFixed(6)}\n`;
                stlContent += `      vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(
                  6
                )} ${v2.z.toFixed(6)}\n`;
                stlContent += `      vertex ${v3.x.toFixed(6)} ${v3.y.toFixed(
                  6
                )} ${v3.z.toFixed(6)}\n`;
                stlContent += "    endloop\n";
                stlContent += "  endfacet\n";

                totalTriangles++;
              }
            }
          }
        }
      }
      // 兼容旧的vertices/faces格式（如果存在）
      else if (model.geometry.vertices && model.geometry.faces) {
        const vertices = model.geometry.vertices;
        const faces = model.geometry.faces;

        // 处理每个三角面
        for (const face of faces) {
          if (face.length < 3) continue;

          // 获取三角形的三个顶点
          const v1 = vertices[face[0]];
          const v2 = vertices[face[1]];
          const v3 = vertices[face[2]];

          if (!v1 || !v2 || !v3) continue;

          // 计算法向量
          const normal = this.calculateNormal(v1, v2, v3);

          // 写入STL三角面格式
          stlContent += `  facet normal ${normal.x.toFixed(
            6
          )} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
          stlContent += "    outer loop\n";
          stlContent += `      vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(
            6
          )} ${v1.z.toFixed(6)}\n`;
          stlContent += `      vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(
            6
          )} ${v2.z.toFixed(6)}\n`;
          stlContent += `      vertex ${v3.x.toFixed(6)} ${v3.y.toFixed(
            6
          )} ${v3.z.toFixed(6)}\n`;
          stlContent += "    endloop\n";
          stlContent += "  endfacet\n";

          totalTriangles++;
        }
      }

      processedModels++;
      if (onProgress) {
        onProgress((processedModels / totalModels) * 0.9); // 90%用于处理模型
      }
    }

    stlContent += "endsolid OSM_Model\n";

    console.log(`STL生成完成，总三角形数: ${totalTriangles}`);
    if (onProgress) onProgress(1.0);

    return stlContent;
  }

  /**
   * 验证顶点有效性
   * @param vertex - 顶点坐标
   * @returns 是否有效
   */
  private static isValidVertex(vertex: {
    x: number;
    y: number;
    z: number;
  }): boolean {
    return (
      typeof vertex.x === "number" &&
      isFinite(vertex.x) &&
      typeof vertex.y === "number" &&
      isFinite(vertex.y) &&
      typeof vertex.z === "number" &&
      isFinite(vertex.z)
    );
  }

  /**
   * 计算三角形法向量
   * @param v1 - 顶点1
   * @param v2 - 顶点2
   * @param v3 - 顶点3
   * @returns 法向量
   */
  private static calculateNormal(
    v1: { x: number; y: number; z: number },
    v2: { x: number; y: number; z: number },
    v3: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    // 计算两个边向量
    const edge1 = {
      x: v2.x - v1.x,
      y: v2.y - v1.y,
      z: v2.z - v1.z,
    };

    const edge2 = {
      x: v3.x - v1.x,
      y: v3.y - v1.y,
      z: v3.z - v1.z,
    };

    // 计算叉积得到法向量
    const normal = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x,
    };

    // 归一化法向量
    const length = Math.sqrt(
      normal.x * normal.x + normal.y * normal.y + normal.z * normal.z
    );
    if (length > 0) {
      normal.x /= length;
      normal.y /= length;
      normal.z /= length;
    }

    return normal;
  }

  private static generate3MFContent(
    models: Model3D[],
    onProgress?: (progress: number) => void
  ): string {
    console.log("开始生成3MF内容，模型数量:", models.length);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">Overpass 3D Model</metadata>
  <metadata name="Designer">Overpass 3D Modeler</metadata>
  <metadata name="Description">从OpenStreetMap数据生成的3D模型</metadata>
  <metadata name="Application">Map to 3MF Converter</metadata>
  <metadata name="CreationDate">${new Date().toISOString()}</metadata>
  <resources>`;

    // 生成材质定义
    const materialTypes = new Set(models.map((m) => m.type));
    const materialMap = new Map<string, number>();
    let materialId = 1;

    if (materialTypes.size > 0) {
      xml += `
    <basematerials id="1">`;

      materialTypes.forEach((type) => {
        const color = this.getColorForType(type);
        xml += `
      <basematerial name="${type}" displaycolor="${color}" />`;
        materialMap.set(type, materialId++);
      });

      xml += `
    </basematerials>`;
    }

    // 为每个模型添加顶点和三角形
    let objectId = 1;
    const BATCH_SIZE = 1000; // 分批处理顶点

    models.forEach((model, modelIndex) => {
      if (onProgress) {
        onProgress((modelIndex / models.length) * 0.9); // 90%用于处理模型
      }

      console.log(
        `处理模型 ${modelIndex + 1}/${models.length}:`,
        model.id,
        model.type
      );

      if (!model.geometry || !this.validateGeometry(model.geometry)) {
        console.warn(`模型 ${modelIndex + 1} 几何数据无效`);
        return;
      }

      const vertices: string[] = [];
      const triangles: string[] = [];

      if (model.geometry.attributes && model.geometry.attributes.position) {
        const positionAttr = model.geometry.attributes.position;
        const positions = positionAttr.array;
        const indices = model.geometry.index
          ? model.geometry.index.array
          : null;

        const vertexCount = positions.length / 3;
        console.log(`模型 ${modelIndex + 1} 顶点数:`, vertexCount);
        console.log(
          `模型 ${modelIndex + 1} 索引数:`,
          indices ? indices.length : "无索引"
        );

        // 分批处理顶点以优化内存使用
        for (
          let batchStart = 0;
          batchStart < positions.length;
          batchStart += BATCH_SIZE * 3
        ) {
          const batchEnd = Math.min(
            batchStart + BATCH_SIZE * 3,
            positions.length
          );

          for (let i = batchStart; i < batchEnd; i += 3) {
            // 转换为毫米单位并确保精度
            const x = (positions[i] * 1000).toFixed(3);
            const y = (positions[i + 1] * 1000).toFixed(3);
            const z = (positions[i + 2] * 1000).toFixed(3);

            // 验证坐标有效性
            if (this.isValidCoordinate(x, y, z)) {
              vertices.push(`      <vertex x="${x}" y="${y}" z="${z}" />`);
            }
          }
        }

        // 处理三角形索引
        if (indices) {
          for (let i = 0; i < indices.length; i += 3) {
            if (i + 2 < indices.length) {
              const v1 = indices[i];
              const v2 = indices[i + 1];
              const v3 = indices[i + 2];

              // 验证索引有效性
              if (
                v1 < vertexCount &&
                v2 < vertexCount &&
                v3 < vertexCount &&
                v1 !== v2 &&
                v2 !== v3 &&
                v1 !== v3
              ) {
                triangles.push(
                  `      <triangle v1="${v1}" v2="${v2}" v3="${v3}" />`
                );
              }
            }
          }
        } else {
          // 为非索引几何体生成三角形
          const actualVertexCount = Math.floor(positions.length / 3);
          for (let i = 0; i < actualVertexCount; i += 3) {
            if (i + 2 < actualVertexCount) {
              triangles.push(
                `      <triangle v1="${i}" v2="${i + 1}" v3="${i + 2}" />`
              );
            }
          }
        }

        console.log(
          `模型 ${modelIndex + 1} 生成顶点数:`,
          vertices.length,
          "三角形数:",
          triangles.length
        );

        if (vertices.length > 0 && triangles.length > 0) {
          const materialId = materialMap.get(model.type) || 1;
          xml += `
    <object id="${objectId}" type="model" pid="${materialId}">
      <mesh>
        <vertices>
${vertices.join("\n")}
        </vertices>
        <triangles>
${triangles.join("\n")}
        </triangles>
      </mesh>
    </object>`;

          objectId++;
        } else {
          console.warn(`模型 ${modelIndex + 1} 没有有效的几何数据`);
        }
      } else {
        console.warn(`模型 ${modelIndex + 1} 缺少几何属性`);
      }
    });

    console.log("总共生成对象数:", objectId - 1);

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

    console.log("3MF内容生成完成");
    return xml;
  }
}
