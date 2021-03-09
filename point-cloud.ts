"use strict";

const DEGREE_TO_RADIAN_FACTOR: number = Math.PI / 180;

const SLOPE_SHIFT = -(255 / 2);

class PointCloud {
   private normalMap: NormalMap;
   private depthFactor: number;
   private azimuthalAngles: number[];
   private rotation: { azimuthal: number; polar: number };

   private mask: Uint8Array;
   private pixelToVertexIndexMap: number[];
   private vertexToPixelIndexMap: number[];

   private width: number;
   private height: number;
   private objString: string;

   private maxVertexCount: number;

   private gpuVertices: number[];

   constructor(
      normalMap: NormalMap,
      width: number,
      height: number,
      depthFactor: number,
      maxVertexCount: number,
      azimuthalAngles: number[],
      rotation: { azimuthal: number; polar: number } = {
         azimuthal: 0,
         polar: 0,
      },
      mask: Uint8Array = new Uint8Array(new Array(width * height * 4).fill(255))
   ) {
      this.normalMap = normalMap;
      this.depthFactor = depthFactor;
      this.width = width;
      this.height = height;
      this.maxVertexCount = maxVertexCount;
      this.azimuthalAngles = azimuthalAngles;
      this.rotation = rotation;
      this.mask = mask;
      this.calculateIndexMaps();
   }

   public getWidth(): number {
      return this.width;
   }

   public getHeight(): number {
      return this.height;
   }

   public getAzimuthalAngles(): number[] {
      return this.azimuthalAngles;
   }

   public downloadObj(filename: string, button: HTMLElement) {
      if (button) {
         button.style.display = "none";
      }
      const cThis: PointCloud = this;
      setTimeout(() => {
         filename += ".obj";

         let element = document.createElement("a");
         element.style.display = "none";

         let blob = new Blob([cThis.getObjString()], {
            type: "text/plain; charset = utf-8",
         });

         let url = window.URL.createObjectURL(blob);
         element.setAttribute("href", window.URL.createObjectURL(blob));
         element.setAttribute("download", filename);

         document.body.appendChild(element);

         element.click();

         window.URL.revokeObjectURL(url);
         element.remove();

         if (button) {
            setTimeout(() => {
               button.style.display = "inherit";
            }, 500);
         }
      });
   }

   private getRotatedVertex(vertex: number[]): number[] {
      const dotVec3: Function = (
         vector1: number[],
         vector2: number[]
      ): number => {
         let result: number = 0;
         for (let i = 0; i < 3; i++) {
            result += vector1[i] * vector2[i];
         }
         return result;
      };
      const rotateAround: Function = (
         vector: number[],
         axis: number[],
         angleDegree: number
      ): number[] => {
         const angle: number = angleDegree * DEGREE_TO_RADIAN_FACTOR;

         if (angle === 0) {
            return vertex;
         }
         const axisDivisor: number = Math.sqrt(dotVec3(axis, axis));
         axis = [
            axis[0] / axisDivisor,
            axis[1] / axisDivisor,
            axis[2] / axisDivisor,
         ];

         const a: number = Math.cos(angle / 2.0);
         const b: number = -axis[0] * Math.sin(angle / 2.0);
         const c: number = -axis[1] * Math.sin(angle / 2.0);
         const d: number = -axis[2] * Math.sin(angle / 2.0);

         const aa: number = a * a;
         const bb: number = b * b;
         const cc: number = c * c;
         const dd: number = d * d;

         const bc: number = b * c;
         const ad: number = a * d;
         const ac: number = a * c;
         const ab: number = a * b;
         const bd: number = b * d;
         const cd: number = c * d;

         const rotationMatrix: number[][] = [
            [aa + bb - cc - dd, 2 * (bc + ad), 2 * (bd - ac)],
            [2 * (bc - ad), aa + cc - bb - dd, 2 * (cd + ab)],
            [2 * (bd + ac), 2 * (cd - ab), aa + dd - bb - cc],
         ];

         /*const rotationMatrix: number[][] = [
            [aa + bb - cc - dd, 2 * (bc - ad), 2 * (bd + ac)],
            [2 * (bc + ad), aa + cc - bb - dd, 2 * (cd - ab)],
            [2 * (bd - ac), 2 * (cd + ab), aa + dd - bb - cc],
         ];*/

         return [
            dotVec3(vector, rotationMatrix[0]),
            dotVec3(vector, rotationMatrix[1]),
            dotVec3(vector, rotationMatrix[2]),
         ];
      };

      const polar: number = this.rotation.polar;
      const azimuthal: number = this.rotation.azimuthal;

      const polarRad: number = polar * DEGREE_TO_RADIAN_FACTOR;
      const azimuthalRad: number = azimuthal * DEGREE_TO_RADIAN_FACTOR;

      const polarAxis: number[] = rotateAround(
         [
            Math.cos(azimuthalRad) * Math.sin(polarRad),
            Math.sin(azimuthalRad) * Math.sin(polarRad),
            0,
         ],
         [0, 0, 1],
         90
      );

      const azimuthalRotated: number[] = rotateAround(
         vertex,
         [0, 0, 1],
         azimuthal
      );

      const polarAzimuthalRotated: number[] = rotateAround(
         azimuthalRotated,
         polarAxis,
         polar
      );

      return rotateAround(polarAzimuthalRotated, [0, 1, 0], -azimuthal);
   }

   private getVertexIndex(pixelIndex: number): number {
      return this.pixelToVertexIndexMap[pixelIndex];
   }

   private calculateIndexMaps(): void {
      this.pixelToVertexIndexMap = new Array(this.width * this.height);
      this.vertexToPixelIndexMap = [];

      let vertexIndex: number = 0;
      for (let y = 0; y < this.height; y++) {
         for (let x = 0; x < this.width; x++) {
            const index = x + y * this.width;
            if (this.isPixelMaskedOut(index)) {
               this.pixelToVertexIndexMap[index] = null;
            } else {
               this.pixelToVertexIndexMap[index] = vertexIndex;
               this.vertexToPixelIndexMap.push(index);
               vertexIndex++;
            }
         }
      }
   }

   private edgeFramePixels: { x: number; y: number }[];
   private getEdgeFramePixels(): { x: number; y: number }[] {
      if (this.edgeFramePixels === undefined) {
         this.edgeFramePixels = [];

         const topY: number = -1;
         const bottomY: number = this.height;
         const leftX: number = -1;
         const rightX: number = this.width;

         for (let x: number = 0; x < this.width; x++) {
            this.edgeFramePixels.push({ x: x, y: topY });
            this.edgeFramePixels.push({ x: x, y: bottomY });
         }
         for (let y: number = 0; y < this.height; y++) {
            this.edgeFramePixels.push({ x: leftX, y: y });
            this.edgeFramePixels.push({ x: rightX, y: y });
         }
      }
      return this.edgeFramePixels;
   }

   private isInDimensions(pixel: { x: number; y: number }): boolean {
      return (
         pixel.x < this.width &&
         pixel.y < this.height &&
         pixel.x >= 0 &&
         pixel.y >= 0
      );
   }

   private getPixelLine(
      startPixel: { x: number; y: number },
      stepVector: { x: number; y: number },
      gradientPixelArray: Uint8Array
   ): { x: number; y: number; slope: number }[] {
      const pixelLine: { x: number; y: number; slope: number }[] = [];

      const stepOffset: { x: number; y: number } = {
         x: startPixel.x,
         y: startPixel.y,
      };
      const pixel: { x: number; y: number } = {
         x: startPixel.x,
         y: startPixel.y,
      };
      const nextPixel: { x: number; y: number } = { x: pixel.x, y: pixel.y };

      let inDimensions: boolean;

      do {
         do {
            stepOffset.x += stepVector.x;
            stepOffset.y += stepVector.y;

            nextPixel.x = Math.round(stepOffset.x);
            nextPixel.y = Math.round(stepOffset.y);
         } while (nextPixel.x === pixel.x && nextPixel.y === pixel.y);

         pixel.x = nextPixel.x;
         pixel.y = nextPixel.y;
         inDimensions = this.isInDimensions(pixel);

         if (inDimensions) {
            const pixelSlope: number = this.getPixelSlope(
               pixel,
               stepVector,
               gradientPixelArray
            );

            pixelLine.push({ x: pixel.x, y: pixel.y, slope: pixelSlope });
         }
      } while (inDimensions);

      return pixelLine;
   }

   private getPixelLinesFromAzimuthalAngle(
      azimuthalAngle: number,
      gradientPixelArray: Uint8Array
   ): { x: number; y: number; slope: number }[][] {
      const pixelLines: { x: number; y: number; slope: number }[][] = [];

      // Inverse and thus, line FROM and NOT TO azimuthal angle.
      azimuthalAngle += 180;

      const azimuthalAngleInRadians: number =
         azimuthalAngle * DEGREE_TO_RADIAN_FACTOR;

      const stepVector: { x: number; y: number } = {
         x: Math.cos(azimuthalAngleInRadians),
         y: Math.sin(azimuthalAngleInRadians),
      };
      const minimumStep: number = 0.00000001;
      if (stepVector.x < minimumStep && stepVector.x > -minimumStep) {
         stepVector.x = 0;
      }
      if (stepVector.y < minimumStep && stepVector.y > -minimumStep) {
         stepVector.y = 0;
      }

      for (let i = 0; i < this.getEdgeFramePixels().length; i++) {
         const startPixel: { x: number; y: number } = this.getEdgeFramePixels()[
            i
         ];
         const pixelLine: {
            x: number;
            y: number;
            slope: number;
         }[] = this.getPixelLine(startPixel, stepVector, gradientPixelArray);

         if (pixelLine.length > 1) {
            pixelLines.push(pixelLine);
         }
      }
      return pixelLines;
   }

   private isPixelMaskedOut(pixelIndex: number): boolean {
      pixelIndex *= 4;
      return (
         this.mask[pixelIndex + GLSL_CHANNEL.RED] +
            this.mask[pixelIndex + GLSL_CHANNEL.GREEN] +
            this.mask[pixelIndex + GLSL_CHANNEL.BLUE] ===
         0
      );
   }

   private getPixelSlope(
      pixel: { x: number; y: number },
      stepVector: { x: number; y: number },
      gradientPixelArray: Uint8Array
   ): number {
      const index = pixel.x + pixel.y * this.width;
      if (this.isPixelMaskedOut(index)) {
         return null;
      }
      const colorIndex: number = index * 4;

      const rightSlope: number =
         gradientPixelArray[colorIndex + GLSL_CHANNEL.RED] + SLOPE_SHIFT;
      const topSlope: number =
         gradientPixelArray[colorIndex + GLSL_CHANNEL.GREEN] + SLOPE_SHIFT;

      return stepVector.x * rightSlope + stepVector.y * topSlope;
   }

   private async getLocalGradientFactor(): Promise<Uint8Array> {
      let pointCloudShader = new Shader(this.normalMap.getDimensions());
      pointCloudShader.bind();

      const normal: GlslVector3 = this.normalMap.getGlslNormal();

      const rightNormal: GlslVector3 = new GlslVector3([
         new GlslFloat(1),
         new GlslFloat(0),
         new GlslFloat(0),
      ]);

      const topNormal: GlslVector3 = new GlslVector3([
         new GlslFloat(0),
         new GlslFloat(1),
         new GlslFloat(0),
      ]);

      const frontNormal: GlslVector3 = new GlslVector3([
         new GlslFloat(0),
         new GlslFloat(0),
         new GlslFloat(1),
      ]);

      const frontSlope: GlslFloat = new GlslFloat(1).subtractFloat(
         normal.dot(frontNormal)
      );

      const result = new GlslVector3([
         normal.dot(rightNormal),
         normal.dot(topNormal),
         new GlslFloat(0),
      ]);

      /*const result = new GlslVector3([
         normal.channel(GLSL_CHANNEL.BLUE),
         normal.channel(GLSL_CHANNEL.BLUE),
         normal.channel(GLSL_CHANNEL.BLUE),
      ]);*/

      const rendering = GlslRendering.render(result.getVector4());

      const gradientPixelArray = rendering.getPixelArray();

      pointCloudShader.purge();

      return gradientPixelArray;
   }

   private calculateAnisotropicIntegral(
      azimuthalAngle: number,
      gradientPixelArray: Uint8Array
   ): number[] {
      const integral: number[] = new Array(this.width * this.height);

      let pixelLines: {
         x: number;
         y: number;
         slope: number;
      }[][] = this.getPixelLinesFromAzimuthalAngle(
         azimuthalAngle,
         gradientPixelArray
      );

      /*console.log(
         "Calculating " +
            pixelLines.length +
            " integrals from azimuthal angle " +
            azimuthalAngle +
            ".",
         3
      );*/

      for (let j = 0; j < pixelLines.length; j++) {
         let lineOffset: number = 0;

         for (let k = 0; k < pixelLines[j].length; k++) {
            const index: number =
               pixelLines[j][k].x + pixelLines[j][k].y * this.width;

            if (pixelLines[j][k].slope) {
               integral[index] = lineOffset;
               lineOffset += pixelLines[j][k].slope * -this.depthFactor;
            } else {
               integral[index] = null;
               lineOffset = 0;
            }
         }
      }

      return integral;
   }

   private summarizeHorizontalImageLine(
      y: number,
      samplingRateStepX: number,
      resolution: number
   ): { averageError: number; highestError: number; zErrors: number[] } {
      const result: {
         averageError: number;
         highestError: number;
         zErrors: number[];
      } = { averageError: 0, highestError: 0, zErrors: new Array(this.width) };

      for (let x: number = 0; x < this.width; x += samplingRateStepX) {
         const index: number = x + y * this.width;
         let vectorIndex: number = this.getVertexIndex(index);

         if (vectorIndex) {
            vectorIndex *= 3;
            let zAverage: number = 0;
            let zError: number = 0;
            let averageDivisor: number = this.integrals.length;

            for (let i = 0; i < this.integrals.length; i++) {
               const currentZ: number = this.integrals[i][index];
               if (!isNaN(currentZ)) {
                  zAverage += currentZ;
                  if (i !== 0) {
                     zError += Math.abs(this.integrals[0][index] - currentZ);
                  }
               }
            }
            zAverage /= averageDivisor;
            zError /= averageDivisor;
            result.averageError += zError / resolution;
            result.highestError = Math.max(result.highestError, zError);
            result.zErrors[x] = zError;

            const gpuVertex: number[] = this.getRotatedVertex([
               x / this.width - 0.5,
               y / this.width - 0.5,
               zAverage / this.width,
            ]);

            this.gpuVertices[vectorIndex + GLSL_CHANNEL.X] = gpuVertex[0];
            this.gpuVertices[vectorIndex + GLSL_CHANNEL.Y] = gpuVertex[1];
            this.gpuVertices[vectorIndex + GLSL_CHANNEL.Z] = gpuVertex[2];

            this.objString += "v " + x + " " + y + " " + zAverage + "\n";
         }
      }

      return result;
   }

   private integrals: number[][];
   public async calculate() {
      const gradientDOMStatus: DOMStatusElement = new DOMStatusElement(
         "Calculating slopes."
      );
      const integralDOMStatus: DOMStatusElement = new DOMStatusElement(
         "Integrating normal mapping."
      );
      const summarizeDOMStatus: DOMStatusElement = new DOMStatusElement(
         "Summarizing data."
      );

      const gradientThreadPool: ThreadPool = new ThreadPool(gradientDOMStatus);
      gradientThreadPool.add(this.getLocalGradientFactor.bind(this));

      const gradientPixelArrayPromise = await gradientThreadPool.run();
      const gradientPixelArray: Uint8Array = gradientPixelArrayPromise[0];

      const integralThreadPool: ThreadPool = new ThreadPool(integralDOMStatus);

      for (let i = 0, length = this.azimuthalAngles.length; i < length; i++) {
         const integralMethod: Function = this.calculateAnisotropicIntegral.bind(
            this,
            this.azimuthalAngles[i],
            gradientPixelArray
         );
         integralThreadPool.add(integralMethod);
      }

      this.integrals = await integralThreadPool.run();

      this.objString = "";

      let resolution: number = this.width * this.height;
      let samplingRateStep: { x: number; y: number } = { x: 1, y: 1 };

      /* TODO: Fix point cloud sampling.
      while (resolution > this.maxVertexCount) {
         samplingRateStep.x += 0.01 * (this.width / this.height);
         samplingRateStep.y += 0.01 * (this.height / this.width);

         resolution =
            (this.width / samplingRateStep.x) *
            (this.height / samplingRateStep.y);
      }
      */

      const zErrors: number[] = new Array(this.vertexToPixelIndexMap.length);
      this.gpuVertices = new Array(this.vertexToPixelIndexMap.length * 3);

      const summerizeThreadPool: ThreadPool = new ThreadPool(
         summarizeDOMStatus
      );

      for (let y = 0; y < this.height; y += samplingRateStep.y) {
         const summerizeMethod: Function = this.summarizeHorizontalImageLine.bind(
            this,
            y,
            samplingRateStep.x,
            resolution
         );
         summerizeThreadPool.add(summerizeMethod);
      }

      const results: {
         averageError: number;
         highestError: number;
         zErrors: number[];
      }[] = await summerizeThreadPool.run();

      let highestError: number = 0;
      let averageError: number = 0;
      for (let j = 0, length = results.length; j < length; j++) {
         highestError = Math.max(...results[j].zErrors, highestError);
         averageError += results[j].averageError;
      }

      for (let j = 0, length = results.length; j < length; j++) {
         const zErrorsLine: number[] = results[j].zErrors;
         for (let i = 0, length = zErrorsLine.length; i < length; i++) {
            zErrors.push(zErrorsLine[i]);
         }
      }

      console.log("Average error of z values: " + averageError, 1);

      /*console.log(
         "Reduced point cloud resolution by around " +
            Math.round(100 - (resolution / (this.width * this.height)) * 100) +
            " percent. Currently " +
            this.gpuVertices.length / 3 +
            " vertices."
      );*/
   }

   public getAnglesZValues(): number[][] {
      return this.integrals;
   }

   public getObjString(): string {
      return this.objString;
   }

   public getGpuVertices(): number[] {
      return this.gpuVertices;
   }
}
