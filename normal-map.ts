"use strict";

/*
Spherical Coordinates

The azimuthal angle is denoted by φ (phi).
The polar angle is denoted by θ (theta).

In the following, the notation [φ, θ] is used.

https://www.geogebra.org/m/FzkZPN3K
*/

const enum NORMAL_CALCULATION_METHOD {
   RAPID_GRADIENT,
   PHOTOMETRIC_STEREO,
}

const EAST = 0;
const NORTH_EAST = 45;
const NORTH = 90;
const NORTH_WEST = 135;
const WEST = 180;
const SOUTH_WEST = 225;
const SOUTH = 270;
const SOUTH_EAST = 315;

/*
The lighting degrees array describes all spherical degrees.
*/
const LIGHTING_AZIMUTHAL_ANGLES = [
   EAST,
   NORTH_EAST,
   NORTH,
   NORTH_WEST,
   WEST,
   SOUTH_WEST,
   SOUTH,
   SOUTH_EAST,
];

class NormalMap {
   private dataset: Dataset;
   private calculationMethod: NORMAL_CALCULATION_METHOD;
   private jsImageObject: HTMLImageElement;
   private pixelArray: Uint8Array;
   private dataUrl: string;

   public static getFromJsImageObject(
      jsImageObject: HTMLImageElement
   ): NormalMap {
      const normalMap: NormalMap = new NormalMap(null, null);
      normalMap.jsImageObject = jsImageObject;

      const shader: Shader = new Shader(
         jsImageObject.width,
         jsImageObject.height
      );
      shader.bind();

      const render: GlslRendering = GlslRendering.render(
         GlslImage.load(jsImageObject)
      );

      normalMap.pixelArray = render.getPixelArray();
      normalMap.dataUrl = render.getDataUrl();
      shader.purge();

      return normalMap;
   }

   constructor(dataset: Dataset, calculationMethod: NORMAL_CALCULATION_METHOD) {
      this.dataset = dataset;
      this.calculationMethod = calculationMethod;
      this.jsImageObject = null;
      this.pixelArray = null;
      this.dataUrl = null;
   }

   downloadAsImage(fileName: string) {
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

   calculate(onloadCallback: TimerHandler) {
      const dimensionReferenceImage: HTMLImageElement = this.dataset.getImage(
         LIGHTING_AZIMUTHAL_ANGLES[0]
      );
      const width: number = dimensionReferenceImage.width;
      const height: number = dimensionReferenceImage.height;

      let normalMapShader = new Shader(width, height);
      normalMapShader.bind();

      let images: GlslVector4[] = [];
      for (let i = 0; i < LIGHTING_AZIMUTHAL_ANGLES.length; i++) {
         images.push(
            GlslImage.load(this.dataset.getImage(LIGHTING_AZIMUTHAL_ANGLES[i]))
         );
      }

      const maxImage = images[0].maximum(...images);

      let all = maxImage.getLuminanceFloat();

      let north = images[
         LIGHTING_AZIMUTHAL_ANGLES.indexOf(NORTH)
      ].getLuminanceFloat();
      let east = images[
         LIGHTING_AZIMUTHAL_ANGLES.indexOf(EAST)
      ].getLuminanceFloat();
      let south = images[
         LIGHTING_AZIMUTHAL_ANGLES.indexOf(SOUTH)
      ].getLuminanceFloat();
      let west = images[
         LIGHTING_AZIMUTHAL_ANGLES.indexOf(WEST)
      ].getLuminanceFloat();

      const noLightImage = this.dataset.getImage(null);
      const hasNoLightImage = noLightImage !== null;

      let noLight: GlslFloat;

      if (hasNoLightImage) {
         noLight = GlslImage.load(noLightImage).getLuminanceFloat();
         all = all.subtractFloat(noLight);
         north = north.subtractFloat(noLight);
         east = north.subtractFloat(noLight);
         south = north.subtractFloat(noLight);
         west = north.subtractFloat(noLight);
      }

      north = north.divideFloat(all);
      east = east.divideFloat(all);
      south = south.divideFloat(all);
      west = west.divideFloat(all);

      let result: GlslVector4;

      if (this.calculationMethod === NORMAL_CALCULATION_METHOD.RAPID_GRADIENT) {
         const minImage = images[0].minimum(...images);
         let front: GlslFloat = minImage.divideFloat(all).getLuminanceFloat();

         if (hasNoLightImage) {
            front = front.subtractFloat(noLight);
         }

         result = new GlslVector3([east, north, front]).getVector4();
      }

      if (
         this.calculationMethod === NORMAL_CALCULATION_METHOD.PHOTOMETRIC_STEREO
      ) {
         let northeast = images[
            LIGHTING_AZIMUTHAL_ANGLES.indexOf(NORTH_EAST)
         ].getLuminanceFloat();
         let southeast = images[
            LIGHTING_AZIMUTHAL_ANGLES.indexOf(SOUTH_EAST)
         ].getLuminanceFloat();
         let southwest = images[
            LIGHTING_AZIMUTHAL_ANGLES.indexOf(SOUTH_WEST)
         ].getLuminanceFloat();
         let northwest = images[
            LIGHTING_AZIMUTHAL_ANGLES.indexOf(NORTH_WEST)
         ].getLuminanceFloat();

         if (hasNoLightImage) {
            northeast = north.subtractFloat(noLight);
            southeast = north.subtractFloat(noLight);
            southwest = north.subtractFloat(noLight);
            northwest = north.subtractFloat(noLight);
         }

         northeast = northeast.divideFloat(all);
         southeast = southeast.divideFloat(all);
         southwest = southwest.divideFloat(all);
         northwest = northwest.divideFloat(all);

         const imageLuminances: GlslFloat[] = [
            north,
            northeast,
            east,
            southeast,
            south,
            southwest,
            west,
            northwest,
         ];

         const COMBINATIONS: [number, number, number][] = [
            [WEST, NORTH, EAST],
            [WEST, SOUTH, EAST],
            [SOUTH, WEST, NORTH],
            [SOUTH, EAST, NORTH],
            [NORTH_WEST, NORTH_EAST, SOUTH_EAST],
            [NORTH_WEST, SOUTH_WEST, SOUTH_EAST],
            [NORTH_EAST, SOUTH_EAST, SOUTH_WEST],
            [NORTH_EAST, NORTH_WEST, SOUTH_WEST],
         ];

         console.log("Calculating anisotropic reflection matrices.");

         let normalVectors: GlslVector3[] = [];
         for (let i = 0; i < COMBINATIONS.length; i++) {
            normalVectors.push(
               this.getAnisotropicNormalVector(
                  imageLuminances,
                  ...COMBINATIONS[i]
               )
            );
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
         result = new GlslVector3([
            normalVector.channel(GLSL_CHANNEL.GREEN),
            normalVector.channel(GLSL_CHANNEL.RED),
            normalVector.channel(GLSL_CHANNEL.BLUE),
         ]).getVector4();
      }

      const rendering = GlslRendering.render(result);
      this.pixelArray = rendering.getPixelArray();
      this.dataUrl = rendering.getDataUrl();
      this.jsImageObject = rendering.getJsImage(onloadCallback);

      normalMapShader.purge();
   }

   private getAnisotropicNormalVector(
      imageLuminances: GlslFloat[],
      originAzimuthalAngle: number,
      orthogonalAzimuthalAngle: number,
      oppositeAzimuthalAngle: number
   ) {
      const lights: GlslMatrix3 = this.getLights(
         originAzimuthalAngle,
         orthogonalAzimuthalAngle,
         oppositeAzimuthalAngle
      );

      const reflectionR =
         imageLuminances[
            LIGHTING_AZIMUTHAL_ANGLES.indexOf(originAzimuthalAngle)
         ];
      const reflectionG =
         imageLuminances[
            LIGHTING_AZIMUTHAL_ANGLES.indexOf(orthogonalAzimuthalAngle)
         ];
      const reflectionB =
         imageLuminances[
            LIGHTING_AZIMUTHAL_ANGLES.indexOf(oppositeAzimuthalAngle)
         ];

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

   private getLights(
      originAzimuthalAngle: number,
      orthogonalAzimuthalAngle: number,
      oppositeAzimuthalAngle: number
   ): GlslMatrix3 {
      const originLightDir = this.getLightDirectionVector(originAzimuthalAngle);
      const orthogonalLightDir = this.getLightDirectionVector(
         orthogonalAzimuthalAngle
      );
      const oppositeLightDir = this.getLightDirectionVector(
         oppositeAzimuthalAngle
      );

      return new GlslMatrix3([
         [
            originLightDir.channel(GLSL_CHANNEL.X),
            originLightDir.channel(GLSL_CHANNEL.Y),
            originLightDir.channel(GLSL_CHANNEL.Z),
         ],
         [
            orthogonalLightDir.channel(GLSL_CHANNEL.X),
            orthogonalLightDir.channel(GLSL_CHANNEL.Y),
            orthogonalLightDir.channel(GLSL_CHANNEL.Z),
         ],
         [
            oppositeLightDir.channel(GLSL_CHANNEL.X),
            oppositeLightDir.channel(GLSL_CHANNEL.Y),
            oppositeLightDir.channel(GLSL_CHANNEL.Z),
         ],
      ]).inverse();
   }

   private getLightDirectionVector(azimuthalAngle: number): GlslVector3 {
      let polarAngle = this.dataset.getPolarAngle(azimuthalAngle);

      let glslPolar: GlslFloat = new GlslFloat(polarAngle).radians();
      let glslAzimuthal: GlslFloat = new GlslFloat(azimuthalAngle).radians();

      let sinPolar: GlslFloat = glslPolar.sin();
      let cosPolar: GlslFloat = glslPolar.cos();
      let sinAzimuthal: GlslFloat = glslAzimuthal.sin();
      let cosAzimuthal: GlslFloat = glslAzimuthal.cos();

      let light: GlslVector3 = new GlslVector3([
         sinPolar.multiplyFloat(cosAzimuthal),
         sinPolar.multiplyFloat(sinAzimuthal),
         cosPolar,
      ]);

      return light.normalize();
   }
}
