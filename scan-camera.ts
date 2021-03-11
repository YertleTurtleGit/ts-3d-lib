"use strict";

// https://webglfundamentals.org/webgl/lessons/webgl-3d-camera.html

const SCAN_CAMERA_FOCAL_LENGTH: number = 50; // in millimeter
const SCAN_CAMERA_SENSOR_WIDTH: number = 36; // in millimeter

class ScanCamera {
   private focalLength: number;
   private sensorSize: { width: number; height: number };
   private sphericalPosition: {
      azimuthalDeg: number;
      polarDeg: number;
      radius: number;
   };
   private eulerPosition: { x: number; y: number; z: number };
   private resolution: { width: number; height: number };
   private singlePixelDimension: { width: number; height: number };
   private lookAt: { x: number; y: number; z: number };
   private up: { x: number; y: number; z: number };
   private down: { x: number; y: number; z: number };
   private right: { x: number; y: number; z: number };
   private left: { x: number; y: number; z: number };

   constructor(
      sphericalPosition: {
         azimuthalDeg: number;
         polarDeg: number;
         radius: number;
      },
      resolution: { width: number; height: number },
      focalLength = SCAN_CAMERA_FOCAL_LENGTH,
      sensorWidth = SCAN_CAMERA_SENSOR_WIDTH
   ) {
      this.focalLength = focalLength;
      this.sensorSize = {
         width: sensorWidth,
         height: (resolution.height * sensorWidth) / resolution.width,
      };
      this.sphericalPosition = sphericalPosition;
      this.resolution = resolution;
      this.eulerPosition = this.getEulerPosition();
      this.singlePixelDimension = this.getSinglePixelSizeInMillimeter();
      this.lookAt = this.getLookAtVector();
      this.up = this.getUpVector();
      this.down = { x: -this.up.x, y: -this.up.y, z: -this.up.z };
      this.right = this.getRightVector();
      this.left = { x: -this.right.x, y: -this.right.y, z: -this.right.z };
   }

   public getGuiLines(): number[] {
      const size: number = 0.1;

      const origin: number[] = [
         this.eulerPosition.x / 2,
         this.eulerPosition.y / 2,
         this.eulerPosition.z / 2,
      ];

      const topLeft: number[] = [
         this.eulerPosition.x + this.lookAt.x - this.left.x / 2 - this.up.x / 2,
         this.eulerPosition.y + this.lookAt.y - this.left.y / 2 - this.up.y / 2,
         this.eulerPosition.z + this.lookAt.z - this.left.z / 2 - this.up.z / 2,
      ];
      topLeft[0] *= size;
      topLeft[1] *= size;
      topLeft[2] *= size;

      const topRight: number[] = [
         this.eulerPosition.x +
            this.lookAt.x -
            this.right.x / 2 -
            this.up.x / 2,
         this.eulerPosition.y +
            this.lookAt.y -
            this.right.y / 2 -
            this.up.y / 2,
         this.eulerPosition.z +
            this.lookAt.z -
            this.right.z / 2 -
            this.up.z / 2,
      ];
      topRight[0] *= size;
      topRight[1] *= size;
      topRight[2] *= size;

      const bottomLeft: number[] = [
         this.eulerPosition.x +
            this.lookAt.x -
            this.left.x / 2 -
            this.down.x / 2,
         this.eulerPosition.y +
            this.lookAt.y -
            this.left.y / 2 -
            this.down.y / 2,
         this.eulerPosition.z +
            this.lookAt.z -
            this.left.z / 2 -
            this.down.z / 2,
      ];
      bottomLeft[0] *= size;
      bottomLeft[1] *= size;
      bottomLeft[2] *= size;

      const bottomRight: number[] = [
         this.eulerPosition.x +
            this.lookAt.x -
            this.right.x / 2 -
            this.down.x / 2,
         this.eulerPosition.y +
            this.lookAt.y -
            this.right.y / 2 -
            this.down.y / 2,
         this.eulerPosition.z +
            this.lookAt.z -
            this.right.z / 2 -
            this.down.z / 2,
      ];
      bottomRight[0] *= size;
      bottomRight[1] *= size;
      bottomRight[2] *= size;

      return [
         ...origin,
         ...topLeft,

         ...origin,
         ...topRight,

         ...origin,
         ...bottomLeft,

         ...origin,
         ...bottomRight,

         ...topLeft,
         ...topRight,

         ...bottomLeft,
         ...bottomRight,

         ...topRight,
         ...bottomRight,

         ...topLeft,
         ...bottomLeft,
      ];
   }

   public getDepthPixelInMillimeter(pixel: {
      x: number;
      y: number;
      z: number;
   }): { x: number; y: number; z: number } {
      const topLeft: { x: number; y: number; z: number } = this.addVectors(
         this.left,
         this.up
      );

      const leftShift: {
         x: number;
         y: number;
         z: number;
      } = this.multiplyVectors(
         {
            x: this.singlePixelDimension.width * pixel.x,
            y: this.singlePixelDimension.width * pixel.x,
            z: this.singlePixelDimension.width * pixel.x,
         },
         this.left
      );
      const downShift: {
         x: number;
         y: number;
         z: number;
      } = this.multiplyVectors(
         {
            x: this.singlePixelDimension.height * pixel.y,
            y: this.singlePixelDimension.height * pixel.y,
            z: this.singlePixelDimension.height * pixel.y,
         },
         this.up
      );

      const relative: { x: number; y: number; z: number } = this.addVectors(
         leftShift,
         downShift
      );

      return this.addVectors(topLeft, relative);
   }

   private getSinglePixelSizeInMillimeter(): {
      width: number;
      height: number;
   } {
      return {
         width:
            this.getImageDimensionsInMillimeter().width / this.resolution.width,
         height:
            this.getImageDimensionsInMillimeter().height /
            this.resolution.height,
      };
   }

   private getImageDimensionsInMillimeter(): { width: number; height: number } {
      const fieldOfViewAngle: {
         horizontal: number;
         vertical: number;
      } = this.getFieldOfViewAngle();

      return {
         width:
            2 *
            this.sphericalPosition.radius *
            Math.tan(fieldOfViewAngle.horizontal / 2),

         height:
            2 *
            this.sphericalPosition.radius *
            Math.tan(fieldOfViewAngle.vertical / 2),
      };
   }

   private getLookAtVector(): { x: number; y: number; z: number } {
      return this.getUnitVector({
         x: -this.eulerPosition.x,
         y: -this.eulerPosition.y,
         z: -this.eulerPosition.z,
      });
   }

   private getUpVector(): { x: number; y: number; z: number } {
      return this.getCrossProduct(this.lookAt, { x: 0, y: 0, z: 1 });
   }

   private getRightVector(): { x: number; y: number; z: number } {
      return this.getCrossProduct(this.lookAt, this.up);
   }

   private getEulerPosition(): { x: number; y: number; z: number } {
      const azimuthal: number =
         this.sphericalPosition.azimuthalDeg * DEGREE_TO_RADIAN_FACTOR;
      const polar: number =
         this.sphericalPosition.polarDeg * DEGREE_TO_RADIAN_FACTOR;
      return {
         x:
            this.sphericalPosition.radius *
            Math.cos(azimuthal) *
            Math.sin(polar),
         y:
            this.sphericalPosition.radius *
            Math.sin(azimuthal) *
            Math.sin(polar),
         z: this.sphericalPosition.radius * Math.cos(polar),
      };
   }

   private getFieldOfViewAngle(): { horizontal: number; vertical: number } {
      return {
         horizontal:
            2 * Math.atan(this.sensorSize.width / 2 / this.focalLength),
         vertical: 2 * Math.atan(this.sensorSize.height / 2 / this.focalLength),
      };
   }

   private getCrossProduct(
      vectorA: { x: number; y: number; z: number },
      vectorB: { x: number; y: number; z: number }
   ) {
      return {
         x: vectorA.y * vectorB.z - vectorA.z * vectorB.y,
         y: vectorA.z * vectorB.x - vectorA.x * vectorB.z,
         z: vectorA.x * vectorB.y - vectorA.y * vectorB.x,
      };
   }

   private getUnitVector(vector: {
      x: number;
      y: number;
      z: number;
   }): { x: number; y: number; z: number } {
      const length: number = this.getVectorLength(vector);
      if (length === 0) {
         return { x: 0, y: 0, z: 0 };
      }
      return {
         x: vector.x / length,
         y: vector.y / length,
         z: vector.z / length,
      };
   }

   private getVectorLength(vector: {
      x: number;
      y: number;
      z: number;
   }): number {
      return Math.sqrt(
         vector.x * vector.x + vector.y * vector.y + vector.z * vector.z
      );
   }

   private addVectors(
      vectorA: { x: number; y: number; z: number },
      vectorB: { x: number; y: number; z: number }
   ): { x: number; y: number; z: number } {
      return {
         x: vectorA.x + vectorB.x,
         y: vectorA.y + vectorB.y,
         z: vectorA.z + vectorB.z,
      };
   }

   private multiplyVectors(
      vectorA: { x: number; y: number; z: number },
      vectorB: { x: number; y: number; z: number }
   ): { x: number; y: number; z: number } {
      return {
         x: vectorA.x * vectorB.x,
         y: vectorA.y * vectorB.y,
         z: vectorA.z * vectorB.z,
      };
   }
}
