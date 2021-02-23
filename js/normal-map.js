"use strict";
class NormalMap {
    constructor(dataset) {
        this.dataset = dataset;
        this.jsImageObject = null;
        this.pixelArray = null;
        this.dataUrl = null;
    }
    static getFromJsImageObject(jsImageObject) {
        const normalMap = new NormalMap(null);
        normalMap.jsImageObject = jsImageObject;
        const shader = new Shader();
        shader.bind();
        const render = GlslRendering.render(GlslImage.load(jsImageObject));
        normalMap.pixelArray = render.getPixelArray();
        normalMap.dataUrl = render.getDataUrl();
        shader.purge();
        return normalMap;
    }
    downloadAsImage(fileName) {
        fileName += ".png";
        let element = document.createElement("a");
        element.setAttribute("href", this.getAsDataUrl());
        element.setAttribute("download", fileName);
        element.style.display = "none";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }
    getAsDataUrl() {
        if (this.dataUrl !== null) {
            return this.dataUrl;
        }
        console.warn("Call calculate first.");
        return null;
    }
    getAsPixelArray() {
        if (this.pixelArray !== null) {
            return this.pixelArray;
        }
        console.warn("Call calculate first.");
        return null;
    }
    getAsJsImageObject() {
        if (this.jsImageObject !== null) {
            return this.jsImageObject;
        }
        console.warn("Call calculate first.");
        return null;
    }
    calculate(onloadCallback) {
        let normalMapShader = new Shader();
        normalMapShader.bind();
        let images = [];
        for (let i = 0; i < LIGHTING_AZIMUTHAL_ANGLES.length; i++) {
            images.push(GlslImage.load(dataset.getImage(LIGHTING_AZIMUTHAL_ANGLES[i])));
        }
        const maxImage = images[0].maximum(...images);
        const minImage = images[0].minimum(...images);
        let all = maxImage.getLuminanceFloat();
        //let front =ic.divide(minImage, all);
        let north = images[LIGHTING_AZIMUTHAL_ANGLES.indexOf(NORTH)].getLuminanceFloat();
        let northeast = images[LIGHTING_AZIMUTHAL_ANGLES.indexOf(NORTH_EAST)].getLuminanceFloat();
        let east = images[LIGHTING_AZIMUTHAL_ANGLES.indexOf(EAST)].getLuminanceFloat();
        let southeast = images[LIGHTING_AZIMUTHAL_ANGLES.indexOf(SOUTH_EAST)].getLuminanceFloat();
        let south = images[LIGHTING_AZIMUTHAL_ANGLES.indexOf(SOUTH)].getLuminanceFloat();
        let southwest = images[LIGHTING_AZIMUTHAL_ANGLES.indexOf(SOUTH_WEST)].getLuminanceFloat();
        let west = images[LIGHTING_AZIMUTHAL_ANGLES.indexOf(WEST)].getLuminanceFloat();
        let northwest = images[LIGHTING_AZIMUTHAL_ANGLES.indexOf(NORTH_WEST)].getLuminanceFloat();
        const hasNoLightImage = this.dataset.getImage(null) !== null;
        if (hasNoLightImage) {
            console.log("HAS NO LIGHT IMAGE!");
            const noLightImage = GlslImage.load(this.dataset.getImage(null)).getLuminanceFloat();
            all = all.subtractFloat(noLightImage);
            //front = front.substractFloat(noLightImage);
            north = north.subtractFloat(noLightImage);
            northeast = north.subtractFloat(noLightImage);
            east = north.subtractFloat(noLightImage);
            southeast = north.subtractFloat(noLightImage);
            south = north.subtractFloat(noLightImage);
            southwest = north.subtractFloat(noLightImage);
            west = north.subtractFloat(noLightImage);
            northwest = north.subtractFloat(noLightImage);
        }
        north = north.divideFloat(all);
        northeast = northeast.divideFloat(all);
        east = east.divideFloat(all);
        southeast = southeast.divideFloat(all);
        south = south.divideFloat(all);
        southwest = southwest.divideFloat(all);
        west = west.divideFloat(all);
        northwest = northwest.divideFloat(all);
        const imageLuminances = [
            north,
            northeast,
            east,
            southeast,
            south,
            southwest,
            west,
            northwest,
        ];
        const COMBINATIONS = [
            [WEST, NORTH, EAST],
            [WEST, SOUTH, EAST],
            [SOUTH, WEST, NORTH],
            [SOUTH, EAST, NORTH],
            [NORTH_WEST, NORTH_EAST, SOUTH_EAST],
            [NORTH_WEST, SOUTH_WEST, SOUTH_EAST],
            [NORTH_EAST, SOUTH_EAST, SOUTH_WEST],
            [NORTH_EAST, NORTH_WEST, SOUTH_WEST],
        ];
        uiBaseLayer++;
        uiLog("Calculating anisotropic reflection matrices.");
        uiBaseLayer--;
        let normalVectors = [];
        for (let i = 0; i < COMBINATIONS.length; i++) {
            normalVectors.push(this.getAnisotropicNormalVector(imageLuminances, ...COMBINATIONS[i]));
        }
        let normalVector = new GlslVector3([
            new GlslFloat(0),
            new GlslFloat(0),
            new GlslFloat(0),
        ])
            .addVector3(...normalVectors)
            .divideFloat(new GlslFloat(normalVectors.length));
        /*
           TODO:
           Somewhere and somehow the red and green channels are swapped.
           Thus, there are swapped here again.
        */
        let result = new GlslVector3([
            normalVector.channel(1 /* GREEN */),
            normalVector.channel(0 /* RED */),
            normalVector.channel(2 /* BLUE */),
        ]).getVector4();
        const rendering = GlslRendering.render(result);
        this.pixelArray = rendering.getPixelArray();
        this.dataUrl = rendering.getDataUrl();
        this.jsImageObject = rendering.getJsImage(onloadCallback);
        normalMapShader.purge();
    }
    getAnisotropicNormalVector(imageLuminances, originAzimuthalAngle, orthogonalAzimuthalAngle, oppositeAzimuthalAngle) {
        const lights = this.getLights(originAzimuthalAngle, orthogonalAzimuthalAngle, oppositeAzimuthalAngle);
        const reflectionR = imageLuminances[LIGHTING_AZIMUTHAL_ANGLES.indexOf(originAzimuthalAngle)];
        const reflectionG = imageLuminances[LIGHTING_AZIMUTHAL_ANGLES.indexOf(orthogonalAzimuthalAngle)];
        const reflectionB = imageLuminances[LIGHTING_AZIMUTHAL_ANGLES.indexOf(oppositeAzimuthalAngle)];
        const reflection = new GlslVector3([
            reflectionR,
            reflectionG,
            reflectionB,
        ]);
        return lights
            .multiplyVector3(reflection)
            .normalize()
            .addFloat(new GlslFloat(1))
            .divideFloat(new GlslFloat(2));
    }
    getLights(originAzimuthalAngle, orthogonalAzimuthalAngle, oppositeAzimuthalAngle) {
        const originLightDir = this.getLightDirectionVector(originAzimuthalAngle);
        const orthogonalLightDir = this.getLightDirectionVector(orthogonalAzimuthalAngle);
        const oppositeLightDir = this.getLightDirectionVector(oppositeAzimuthalAngle);
        return new GlslMatrix3([
            [
                originLightDir.channel(0 /* X */),
                originLightDir.channel(1 /* Y */),
                originLightDir.channel(2 /* Z */),
            ],
            [
                orthogonalLightDir.channel(0 /* X */),
                orthogonalLightDir.channel(1 /* Y */),
                orthogonalLightDir.channel(2 /* Z */),
            ],
            [
                oppositeLightDir.channel(0 /* X */),
                oppositeLightDir.channel(1 /* Y */),
                oppositeLightDir.channel(2 /* Z */),
            ],
        ]).inverse();
    }
    getLightDirectionVector(azimuthalAngle) {
        let polarAngle = this.dataset.getPolarAngle(azimuthalAngle);
        let glslPolar = new GlslFloat(polarAngle).radians();
        let glslAzimuthal = new GlslFloat(azimuthalAngle).radians();
        let sinPolar = glslPolar.sin();
        let cosPolar = glslPolar.cos();
        let sinAzimuthal = glslAzimuthal.sin();
        let cosAzimuthal = glslAzimuthal.cos();
        let light = new GlslVector3([
            sinPolar.multiplyFloat(cosAzimuthal),
            sinPolar.multiplyFloat(sinAzimuthal),
            cosPolar,
        ]);
        return light.normalize();
    }
}
