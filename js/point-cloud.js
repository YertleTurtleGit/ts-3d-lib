"use strict";
const SLOPE_SHIFT = -(255 / 2);
class PointCloud {
    constructor(normalMap, width, height, depthFactor, maxVertexCount, azimuthalAngles, vertexAlbedoColors) {
        this.gpuVertexAlbedoColors = [];
        this.gpuVertexNormalColors = [];
        this.normalMap = normalMap;
        this.depthFactor = depthFactor;
        this.width = width;
        this.height = height;
        this.maxVertexCount = maxVertexCount;
        this.azimuthalAngles = azimuthalAngles;
        this.vertexAlbedoColors = vertexAlbedoColors;
    }
    getWidth() {
        return this.width;
    }
    getHeight() {
        return this.height;
    }
    getAzimuthalAngles() {
        return this.azimuthalAngles;
    }
    downloadObj(filename, vertexColorArray) {
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
    getEdgeFramePixels() {
        if (this.edgeFramePixels === undefined) {
            this.edgeFramePixels = [];
            const topY = -1;
            const bottomY = this.height;
            const leftX = -1;
            const rightX = this.width;
            for (let x = 0; x < this.width; x++) {
                this.edgeFramePixels.push({ x: x, y: topY });
                this.edgeFramePixels.push({ x: x, y: bottomY });
            }
            for (let y = 0; y < this.height; y++) {
                this.edgeFramePixels.push({ x: leftX, y: y });
                this.edgeFramePixels.push({ x: rightX, y: y });
            }
        }
        return this.edgeFramePixels;
    }
    isInDimensions(pixel) {
        return (pixel.x < this.width &&
            pixel.y < this.height &&
            pixel.x >= 0 &&
            pixel.y >= 0);
    }
    getPixelLine(startPixel, stepVector, gradientPixelArray) {
        const pixelLine = [];
        const stepOffset = {
            x: startPixel.x,
            y: startPixel.y,
        };
        const pixel = {
            x: startPixel.x,
            y: startPixel.y,
        };
        const nextPixel = { x: pixel.x, y: pixel.y };
        let inDimensions;
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
                const pixelSlope = this.getPixelSlope(pixel, stepVector, gradientPixelArray);
                pixelLine.push({ x: pixel.x, y: pixel.y, slope: pixelSlope });
            }
        } while (inDimensions);
        return pixelLine;
    }
    getPixelLinesFromAzimuthalAngle(azimuthalAngle, gradientPixelArray) {
        const pixelLines = [];
        // Inverse and thus, line FROM and NOT TO azimuthal angle.
        azimuthalAngle += 180;
        const azimuthalAngleInRadians = azimuthalAngle * DEGREE_TO_RADIAN_FACTOR;
        const stepVector = {
            x: Math.cos(azimuthalAngleInRadians),
            y: Math.sin(azimuthalAngleInRadians),
        };
        const minimumStep = 0.00000001;
        if (stepVector.x < minimumStep && stepVector.x > -minimumStep) {
            stepVector.x = 0;
        }
        if (stepVector.y < minimumStep && stepVector.y > -minimumStep) {
            stepVector.y = 0;
        }
        for (let i = 0; i < this.getEdgeFramePixels().length; i++) {
            const startPixel = this.getEdgeFramePixels()[i];
            const pixelLine = this.getPixelLine(startPixel, stepVector, gradientPixelArray);
            if (pixelLine.length > 1) {
                pixelLines.push(pixelLine);
            }
        }
        return pixelLines;
    }
    isPixelMaskedOut(pixelIndex) {
        let normal = {
            red: this.normalMap.getAsPixelArray()[pixelIndex + 0 /* RED */],
            green: this.normalMap.getAsPixelArray()[pixelIndex + 1 /* GREEN */],
            blue: this.normalMap.getAsPixelArray()[pixelIndex + 2 /* BLUE */],
        };
        if (normal.blue >= 255 * 0.9) {
            return true;
        }
        return false;
    }
    getPixelSlope(pixel, stepVector, gradientPixelArray) {
        const index = (pixel.x + pixel.y * this.width) * 4;
        const rightSlope = gradientPixelArray[index + 0 /* RED */] + SLOPE_SHIFT;
        const topSlope = gradientPixelArray[index + 1 /* GREEN */] + SLOPE_SHIFT;
        return stepVector.x * rightSlope + stepVector.y * topSlope;
    }
    getAnglesZValues() {
        if (this.anglesZValues === undefined) {
            this.calculate();
        }
        return this.anglesZValues;
    }
    async calculate() {
        uiBaseLayer--;
        uiLog("Integrating normal map.");
        uiBaseLayer++;
        uiLog("Applying local gradient factor.");
        uiBaseLayer++;
        let pointCloudShader = new Shader();
        pointCloudShader.bind();
        const glslNormalMap = GlslImage.load(this.normalMap.getAsJsImageObject());
        const red = glslNormalMap.channel(0 /* RED */);
        const green = glslNormalMap.channel(1 /* GREEN */);
        const blue = glslNormalMap.channel(2 /* BLUE */);
        const result = new GlslVector3([
            red.divideFloat(blue),
            green.divideFloat(blue),
            blue,
        ]);
        const gradientPixelArray = GlslRendering.render(result.getVector4()).getPixelArray();
        pointCloudShader.purge();
        uiBaseLayer--;
        uiLog("Calculating anisotropic integrals.");
        this.anglesZValues = Array(this.azimuthalAngles.length);
        for (let i = 0; i < this.anglesZValues.length; i++) {
            let pixelLines = this.getPixelLinesFromAzimuthalAngle(this.azimuthalAngles[i], gradientPixelArray);
            uiBaseLayer++;
            uiLog("Calculating " +
                pixelLines.length +
                " integrals from azimuthal angle " +
                this.azimuthalAngles[i] +
                ".");
            this.anglesZValues[i] = [];
            this.anglesZValues[i].fill(null, 0, this.width * this.height);
            for (let j = 0; j < pixelLines.length; j++) {
                let lineOffset = 0;
                for (let k = 0; k < pixelLines[j].length; k++) {
                    const index = pixelLines[j][k].x + pixelLines[j][k].y * this.width;
                    this.anglesZValues[i][index] = lineOffset;
                    lineOffset += pixelLines[j][k].slope * -this.depthFactor;
                }
            }
            uiBaseLayer--;
        }
        this.objString = "";
        this.gpuVertices = [];
        this.gpuVertexErrorColors = [];
        let resolution = this.width * this.height;
        let samplingRateStep = { x: 1, y: 1 };
        /* TODO: Fix point cloud sampling.
        while (resolution > this.maxVertexCount) {
           samplingRateStep.x += 0.01 * (this.width / this.height);
           samplingRateStep.y += 0.01 * (this.height / this.width);
  
           resolution =
              (this.width / samplingRateStep.x) *
              (this.height / samplingRateStep.y);
        }
        */
        uiLog("Summarizing data.");
        let highestError = 0;
        let averageError = 0;
        let zErrors = [];
        const normalMapPixelArray = this.normalMap.getAsPixelArray();
        for (let x = 0; x < this.width; x += samplingRateStep.x) {
            for (let y = 0; y < this.height; y += samplingRateStep.y) {
                const index = x + y * this.width;
                const colorIndex = index * 4;
                let zAverage = 0;
                let zError = 0;
                let averageDivisor = this.anglesZValues.length;
                for (let i = 0; i < this.anglesZValues.length; i++) {
                    const currentZ = this.anglesZValues[i][index];
                    if (!isNaN(currentZ)) {
                        zAverage += currentZ;
                        if (i !== 0) {
                            zError += Math.abs(this.anglesZValues[0][index] - currentZ);
                        }
                    }
                }
                zAverage /= averageDivisor;
                zError /= averageDivisor;
                averageError += zError / resolution;
                highestError = Math.max(highestError, zError);
                zErrors.push(zError);
                this.gpuVertices.push(x / this.width - 0.5, y / this.width - 0.5, zAverage / this.width - 0.5);
                const red = this.vertexAlbedoColors[colorIndex + 0 /* RED */] / 255;
                const green = this.vertexAlbedoColors[colorIndex + 1 /* GREEN */] / 255;
                const blue = this.vertexAlbedoColors[colorIndex + 2 /* BLUE */] / 255;
                this.gpuVertexAlbedoColors.push(red, green, blue);
                const normalRed = normalMapPixelArray[colorIndex + 0 /* RED */] / 255;
                const normalGreen = normalMapPixelArray[colorIndex + 1 /* GREEN */] / 255;
                const normalBlue = normalMapPixelArray[colorIndex + 2 /* BLUE */] / 255;
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
            this.gpuVertexErrorColors.push(zErrors[i] / highestError, 1 - zErrors[i] / highestError, 0);
        }
        uiLog("Average error of z values: " + averageError);
        /*uiLog(
           "Reduced point cloud resolution by around " +
              Math.round(100 - (resolution / (this.width * this.height)) * 100) +
              " percent. Currently " +
              this.gpuVertices.length / 3 +
              " vertices."
        );*/
    }
    getObjString() {
        if (this.objString === undefined) {
            this.calculate();
        }
        return this.objString;
    }
    getGpuVertices() {
        if (this.gpuVertices === undefined) {
            this.calculate();
        }
        return this.gpuVertices;
    }
    getGpuVertexAlbedoColors() {
        if (this.gpuVertexAlbedoColors === undefined) {
            this.calculate();
        }
        return this.gpuVertexAlbedoColors;
    }
    getGpuVertexNormalColors() {
        if (this.gpuVertexNormalColors === undefined) {
            this.calculate();
        }
        return this.gpuVertexNormalColors;
    }
    getGpuVertexErrorColors() {
        if (this.gpuVertexErrorColors === undefined) {
            this.calculate();
        }
        return this.gpuVertexErrorColors;
    }
}
