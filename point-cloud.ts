"use strict";

const DEGREE_TO_RADIAN_FACTOR: number = Math.PI / 180;

const SLOPE_SHIFT = -(255 / 2);

class PointCloud {
   private normalMap: NormalMap;
   private depthFactor: number;
   private azimuthalAngles: number[];

   private width: number;
   private height: number;
   private objString: string;

   private maxVertexCount: number;

   private gpuVertices: number[];
   private vertexAlbedoColors: Uint8Array;
   private gpuVertexAlbedoColors: number[] = [];
   private gpuVertexNormalColors: number[] = [];
   private gpuVertexErrorColors: number[];

   constructor(
      normalMap: NormalMap,
      width: number,
      height: number,
      depthFactor: number,
      maxVertexCount: number,
      azimuthalAngles: number[],
      vertexAlbedoColors: Uint8Array
   ) {
      this.normalMap = normalMap;
      this.depthFactor = depthFactor;
      this.width = width;
      this.height = height;
      this.maxVertexCount = maxVertexCount;
      this.azimuthalAngles = azimuthalAngles;
      this.vertexAlbedoColors = vertexAlbedoColors;
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

   public downloadObj(filename: string, vertexColorArray: Uint8Array) {
      filename += ".obj";

      let element = document.createElement("a");
      element.style.display = "none";

      let blob = new Blob([this.getObjString()], {
         type: "text/plain; charset = utf-8",
      });

      let url = window.URL.createObjectURL(blob);
      element.setAttribute("href", window.URL.createObjectURL(blob));
      element.setAttribute("download", filename);

      document.body.appendChild(element);

      element.click();

      window.URL.revokeObjectURL(url);
      element.remove();
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
      let normal: { red: number; green: number; blue: number } = {
         red: this.normalMap.getAsPixelArray()[pixelIndex + GLSL_CHANNEL.RED],
         green: this.normalMap.getAsPixelArray()[
            pixelIndex + GLSL_CHANNEL.GREEN
         ],
         blue: this.normalMap.getAsPixelArray()[pixelIndex + GLSL_CHANNEL.BLUE],
      };

      if (normal.blue >= 255 * 0.9) {
         return true;
      }
      return false;
   }

   private getPixelSlope(
      pixel: { x: number; y: number },
      stepVector: { x: number; y: number },
      gradientPixelArray: Uint8Array
   ): number {
      const index = (pixel.x + pixel.y * this.width) * 4;

      const rightSlope: number =
         gradientPixelArray[index + GLSL_CHANNEL.RED] + SLOPE_SHIFT;
      const topSlope: number =
         gradientPixelArray[index + GLSL_CHANNEL.GREEN] + SLOPE_SHIFT;

      return stepVector.x * rightSlope + stepVector.y * topSlope;
   }

   private anglesZValues: number[][];
   public getAnglesZValues(): number[][] {
      if (this.anglesZValues === undefined) {
         this.calculate();
      }
      return this.anglesZValues;
   }

   public async calculate() {
      console.log("Integrating normal map.");
      console.log("Applying local gradient factor.");

      const normalMapImage: HTMLImageElement = this.normalMap.getAsJsImageObject();
      const width: number = normalMapImage.width;
      const height: number = normalMapImage.height;

      let pointCloudShader = new Shader(width, height);
      pointCloudShader.bind();

      const glslNormalMap = GlslImage.load(normalMapImage);

      const red = glslNormalMap.channel(GLSL_CHANNEL.RED);
      const green = glslNormalMap.channel(GLSL_CHANNEL.GREEN);
      const blue = glslNormalMap.channel(GLSL_CHANNEL.BLUE);

      const result = new GlslVector3([
         red.divideFloat(blue),
         green.divideFloat(blue),
         blue,
      ]);

      const gradientPixelArray = GlslRendering.render(
         result.getVector4()
      ).getPixelArray();

      pointCloudShader.purge();

      console.log("Calculating anisotropic integrals.");

      this.anglesZValues = Array<Array<number>>(this.azimuthalAngles.length);

      for (let i = 0; i < this.anglesZValues.length; i++) {
         let pixelLines: {
            x: number;
            y: number;
            slope: number;
         }[][] = this.getPixelLinesFromAzimuthalAngle(
            this.azimuthalAngles[i],
            gradientPixelArray
         );

         console.log(
            "Calculating " +
               pixelLines.length +
               " integrals from azimuthal angle " +
               this.azimuthalAngles[i] +
               "."
         );

         this.anglesZValues[i] = [];
         this.anglesZValues[i].fill(null, 0, this.width * this.height);

         for (let j = 0; j < pixelLines.length; j++) {
            let lineOffset: number = 0;

            for (let k = 0; k < pixelLines[j].length; k++) {
               const index: number =
                  pixelLines[j][k].x + pixelLines[j][k].y * this.width;

               this.anglesZValues[i][index] = lineOffset;
               lineOffset += pixelLines[j][k].slope * -this.depthFactor;
            }
         }
      }

      this.objString = "";
      this.gpuVertices = [];
      this.gpuVertexErrorColors = [];

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

      console.log("Summarizing data.");

      let highestError: number = 0;
      let averageError: number = 0;
      let zErrors: number[] = [];

      const normalMapPixelArray: Uint8Array = this.normalMap.getAsPixelArray();

      for (let x = 0; x < this.width; x += samplingRateStep.x) {
         for (let y = 0; y < this.height; y += samplingRateStep.y) {
            const index: number = x + y * this.width;
            const colorIndex: number = index * 4;
            let zAverage: number = 0;
            let zError: number = 0;
            let averageDivisor: number = this.anglesZValues.length;

            for (let i = 0; i < this.anglesZValues.length; i++) {
               const currentZ: number = this.anglesZValues[i][index];
               if (!isNaN(currentZ)) {
                  zAverage += currentZ;
                  if (i !== 0) {
                     zError += Math.abs(
                        this.anglesZValues[0][index] - currentZ
                     );
                  }
               }
            }
            zAverage /= averageDivisor;
            zError /= averageDivisor;
            averageError += zError / resolution;
            highestError = Math.max(highestError, zError);
            zErrors.push(zError);

            this.gpuVertices.push(
               x / this.width - 0.5,
               y / this.width - 0.5,
               zAverage / this.width - 0.5
            );
            const red: number =
               this.vertexAlbedoColors[colorIndex + GLSL_CHANNEL.RED] / 255;
            const green: number =
               this.vertexAlbedoColors[colorIndex + GLSL_CHANNEL.GREEN] / 255;
            const blue: number =
               this.vertexAlbedoColors[colorIndex + GLSL_CHANNEL.BLUE] / 255;
            this.gpuVertexAlbedoColors.push(red, green, blue);

            const normalRed: number =
               normalMapPixelArray[colorIndex + GLSL_CHANNEL.RED] / 255;
            const normalGreen: number =
               normalMapPixelArray[colorIndex + GLSL_CHANNEL.GREEN] / 255;
            const normalBlue: number =
               normalMapPixelArray[colorIndex + GLSL_CHANNEL.BLUE] / 255;
            this.gpuVertexNormalColors.push(normalRed, normalGreen, normalBlue);

            this.objString +=
               "v " +
               x +
               " " +
               y +
               " " +
               zAverage +
               " " +
               red +
               " " +
               green +
               " " +
               blue +
               "\n";
         }
      }

      for (let i = 0; i < zErrors.length; i++) {
         this.gpuVertexErrorColors.push(
            zErrors[i] / highestError,
            1 - zErrors[i] / highestError,
            0
         );
      }

      console.log("Average error of z values: " + averageError);

      /*uiLog(
         "Reduced point cloud resolution by around " +
            Math.round(100 - (resolution / (this.width * this.height)) * 100) +
            " percent. Currently " +
            this.gpuVertices.length / 3 +
            " vertices."
      );*/
   }

   public getObjString(): string {
      if (this.objString === undefined) {
         this.calculate();
      }
      return this.objString;
   }

   public getGpuVertices(): number[] {
      if (this.gpuVertices === undefined) {
         this.calculate();
      }
      return this.gpuVertices;
   }

   public getGpuVertexAlbedoColors(): number[] {
      if (this.gpuVertexAlbedoColors === undefined) {
         this.calculate();
      }
      return this.gpuVertexAlbedoColors;
   }

   public getGpuVertexNormalColors(): number[] {
      if (this.gpuVertexNormalColors === undefined) {
         this.calculate();
      }
      return this.gpuVertexNormalColors;
   }

   public getGpuVertexErrorColors(): number[] {
      if (this.gpuVertexErrorColors === undefined) {
         this.calculate();
      }
      return this.gpuVertexErrorColors;
   }
}
