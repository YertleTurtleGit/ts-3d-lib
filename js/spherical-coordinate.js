"use strict";
class SphericalCoordinate {
    constructor(azimuthalAngleDegree, polarAngleDegree) {
        this.azimuthalAngle = azimuthalAngleDegree;
        this.polarAngle = polarAngleDegree;
    }
    getAzimuthalAngle() {
        return this.azimuthalAngle;
    }
    getPolarAngle() {
        return this.polarAngle;
    }
    getDisplayString() {
        this.normalize();
        return "[φ: " + this.azimuthalAngle + ", θ: " + this.polarAngle + "]";
    }
    normalize() {
        this.azimuthalAngle = this.normalizeAngle(this.azimuthalAngle);
        this.polarAngle = this.normalizeAngle(this.polarAngle);
    }
    normalizeAngle(angle) {
        while (angle >= 360) {
            angle -= 360;
        }
        while (angle < 0) {
            angle += 360;
        }
        return angle;
    }
    oppositeAngle(angle) {
        return this.normalizeAngle(angle + 180);
    }
    getOppositeAzimuthalSphericalCoordinate() {
        return new SphericalCoordinate(this.oppositeAngle(this.azimuthalAngle), this.polarAngle);
    }
}
