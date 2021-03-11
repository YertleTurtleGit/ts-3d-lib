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
      focalLength = SCAN_CAMERA_FOCAL_LENGTH,
      sensorWidth = SCAN_CAMERA_SENSOR_WIDTH,
      sphericalPosition: {
         azimuthalDeg: number;
         polarDeg: number;
         radius: number;
      },
      resolution: { width: number; height: number }
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

   public getDepthPixelInMillimeter(pixel: {
      x: number;
      y: number;
      z: number;
   }): { x: number; y: number; z: number } {
      const topLeft: { x: number; y: number; z: number } = this.addVectors(
         this.left,
         this.up
      );
      const pixelMillimeter: { x: number; y: number; z: number } = {
         x: this.singlePixelDimension.width * pixel.x,
         y: this.singlePixelDimension.height * pixel.y,
         z: this.singlePixelDimension.width * pixel.z,
      };

      return this.multiplyVectors(
         this.multiplyVectors(pixelMillimeter, this.right),
         this.down
      );
   }

   private getPointCoordinatesInMillimeter(pixelCoordinate: {
      x: number;
      y: number;
   }): { x: number; y: number } {
      return {
         x: pixelCoordinate.x * this.singlePixelDimension.width,
         y: pixelCoordinate.y * this.singlePixelDimension.height,
      };
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
