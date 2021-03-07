"use strict";

/*
Spherical Coordinates
The azimuthal angle is denoted by φ (phi).
The polar angle is denoted by θ (theta).
In the following, the notation [φ, θ] is used.
https://www.geogebra.org/m/FzkZPN3K
*/

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

const enum NORMAL_CALCULATION_METHOD {
   RAPID_GRADIENT,
   PHOTOMETRIC_STEREO,
}

class NormalMap {
   private imageSet: {
      north: HTMLImageElement;
      northeast?: HTMLImageElement;
      east: HTMLImageElement;
      southeast?: HTMLImageElement;
      south: HTMLImageElement;
      southwest?: HTMLImageElement;
      west: HTMLImageElement;
      northwest?: HTMLImageElement;
      all?: HTMLImageElement;
      none?: HTMLImageElement;
      front?: HTMLImageElement;
   };
   private calculationMethod: NORMAL_CALCULATION_METHOD;
   private polarAngle: number;
   private dimensions: { width: number; height: number };

   constructor(
      imageSet: {
         north: HTMLImageElement;
         northeast?: HTMLImageElement;
         east: HTMLImageElement;
         southeast?: HTMLImageElement;
         south: HTMLImageElement;
         southwest?: HTMLImageElement;
         west: HTMLImageElement;
         northwest?: HTMLImageElement;
         all?: HTMLImageElement;
         none?: HTMLImageElement;
         front?: HTMLImageElement;
      },
      calculationMethod: NORMAL_CALCULATION_METHOD,
      polarAngle: number = 90
   ) {
      this.imageSet = imageSet;
      this.calculationMethod = calculationMethod;
      this.dimensions = {
         width: imageSet.north.width,
         height: imageSet.north.height,
      };
   }

   public getDimensions(): { width: number; height: number } {
      return this.dimensions;
   }

   private calculatePhotometricStereo(): GlslVector3 {
      const maxImage = GlslImage.load(this.imageSet.all);

      let all = maxImage.getLuminanceFloat();

      let north = GlslImage.load(this.imageSet.north).getLuminanceFloat();
      let east = GlslImage.load(this.imageSet.east).getLuminanceFloat();
      let south = GlslImage.load(this.imageSet.south).getLuminanceFloat();
      let west = GlslImage.load(this.imageSet.west).getLuminanceFloat();

      const noLightImage = this.imageSet.none;

      let noLight: GlslFloat;

      if (noLightImage) {
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
         let front: GlslFloat = GlslImage.load(
            this.imageSet.front
         ).getLuminanceFloat();

         if (noLightImage) {
            front = front.subtractFloat(noLight);
         }
         front = front.divideFloat(all);

         result = new GlslVector3([east, north, front]).getVector4();
      }

      if (
         this.calculationMethod === NORMAL_CALCULATION_METHOD.PHOTOMETRIC_STEREO
      ) {
         let northeast = GlslImage.load(
            this.imageSet.northeast
         ).getLuminanceFloat();
         let southeast = GlslImage.load(
            this.imageSet.southeast
         ).getLuminanceFloat();
         let southwest = GlslImage.load(
            this.imageSet.southwest
         ).getLuminanceFloat();
         let northwest = GlslImage.load(
            this.imageSet.northwest
         ).getLuminanceFloat();

         if (noLightImage) {
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
   }

   private calculateRapidGradient(): GlslVector3 {
      const all: GlslFloat = GlslImage.load(
         this.imageSet.all
      ).getLuminanceFloat();

      const north = GlslImage.load(this.imageSet.north)
         .getLuminanceFloat()
         .divideFloat(all);
      const east = GlslImage.load(this.imageSet.east)
         .getLuminanceFloat()
         .divideFloat(all);
      const south = GlslImage.load(this.imageSet.south)
         .getLuminanceFloat()
         .divideFloat(all);
      const west = GlslImage.load(this.imageSet.west)
         .getLuminanceFloat()
         .divideFloat(all);

      const front: GlslFloat = GlslImage.load(this.imageSet.front)
         .divideFloat(all)
         .getLuminanceFloat();

      let x: GlslFloat = east.subtractFloat(west);
      let y: GlslFloat = north.subtractFloat(south);

      x = x.addFloat(new GlslFloat(1));
      y = y.addFloat(new GlslFloat(1));
      x = x.divideFloat(new GlslFloat(2));
      y = y.divideFloat(new GlslFloat(2));

      return new GlslVector3([x, y, front]);
   }

   public getGlslNormal(): GlslVector3 {
      if (this.calculationMethod === NORMAL_CALCULATION_METHOD.RAPID_GRADIENT) {
         return this.calculateRapidGradient();
      }
      if (
         this.calculationMethod === NORMAL_CALCULATION_METHOD.PHOTOMETRIC_STEREO
      ) {
         return this.calculatePhotometricStereo();
      }
   }

   public render(): GlslRendering {
      const normalMapShader = new Shader(this.dimensions);
      normalMapShader.bind();

      const result: GlslVector4 = this.getGlslNormal().getVector4();

      const rendering = GlslRendering.render(result);
      normalMapShader.purge();

      return rendering;
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
      let glslPolar: GlslFloat = new GlslFloat(this.polarAngle).radians();
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
