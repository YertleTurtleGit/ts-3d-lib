"use strict";

const SCAN_CAMERA_FOCAL_LENGTH: number = 50; // in millimeter
const SCAN_CAMERA_SENSOR_SIZE: number = 36; // in millimeter

class ScanCamera {
   private focalLength: number;
   private sensorSize: number;
   private sphericalPosition: {
      azimuthalDeg: number;
      polarDeg: number;
      radius: number;
   };
   private resolution: { width: number; height: number };

   constructor(
      focalLength = SCAN_CAMERA_FOCAL_LENGTH,
      sensorSize = SCAN_CAMERA_SENSOR_SIZE,
      sphericalPosition: {
         azimuthalDeg: number;
         polarDeg: number;
         radius: number;
      },
      resolution: { width: number; height: number }
   ) {
      this.focalLength = focalLength;
      this.sensorSize = sensorSize;
      this.sphericalPosition = sphericalPosition;
      this.resolution = resolution;
   }

   private getFieldOfViewAngle(): number {
      return 2 * Math.atan(this.sensorSize / 2 / this.focalLength);
   }
}
