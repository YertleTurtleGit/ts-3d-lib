"use strict";

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
   }

   public getVertexInMillimeter(vector: {
      x: number;
      y: number;
      z: number;
   }): { x: number; y: number; z: number } {
      const pointCoordinate: {
         x: number;
         y: number;
      } = this.getPointCoordinatesInMillimeter({ x: vector.x, y: vector.y });

      const supportVector: { x: number; y: number; z: number } = {
         x: -this.eulerPosition.x,
         y: -this.eulerPosition.y,
         z: -this.eulerPosition.z,
      };

      const rightAngleToSupportAndXAxis: {
         x: number;
         y: number;
         z: number;
      } = {
         x: 0,
         y: -supportVector.z,
         z: 1 * supportVector.y,
      };
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
}
