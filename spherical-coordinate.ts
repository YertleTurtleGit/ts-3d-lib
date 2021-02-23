"use strict";

class SphericalCoordinate {
   private azimuthalAngle: number;
   private polarAngle: number;

   constructor(azimuthalAngleDegree: number, polarAngleDegree: number) {
      this.azimuthalAngle = azimuthalAngleDegree;
      this.polarAngle = polarAngleDegree;
   }

   public getAzimuthalAngle(): number {
      return this.azimuthalAngle;
   }

   public getPolarAngle(): number {
      return this.polarAngle;
   }

   public getDisplayString(): string {
      this.normalize();
      return "[φ: " + this.azimuthalAngle + ", θ: " + this.polarAngle + "]";
   }

   private normalize(): void {
      this.azimuthalAngle = this.normalizeAngle(this.azimuthalAngle);
      this.polarAngle = this.normalizeAngle(this.polarAngle);
   }

   private normalizeAngle(angle: number): number {
      while (angle >= 360) {
         angle -= 360;
      }
      while (angle < 0) {
         angle += 360;
      }
      return angle;
   }

   private oppositeAngle(angle: number): number {
      return this.normalizeAngle(angle + 180);
   }

   public getOppositeAzimuthalSphericalCoordinate(): SphericalCoordinate {
      return new SphericalCoordinate(
         this.oppositeAngle(this.azimuthalAngle),
         this.polarAngle
      );
   }
}
