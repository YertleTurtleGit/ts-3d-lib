"use strict";

const enum DATATYPE {
   WEBCAM = "webcam",
   DROP = "drop",
   TEST = "test",
}

class Dataset {
   private lightingAzimuthalAngles: number[];
   private lightingCoordinates: SphericalCoordinate[];
   private dataLoadedCallback: TimerHandler;
   private jsImageObjects: HTMLImageElement[];
   private noLightImageObject: HTMLImageElement;
   private normalMapImageObject: HTMLImageElement;
   private dataInput: DataInput;
   private type: DATATYPE;
   private onlyNormalMap: boolean;

   private testPolarAngle: number;
   private webcamPolarAngle: number;
   private loadingArea: HTMLElement;
   private testObjectName: string;
   private testFileExtension: string;
   private inputDropArea: HTMLElement;
   private testDatasetFolder: string;

   constructor(
      lightingAzimuthalAngles: number[],
      testPolarAngle: number,
      webcamPolarAngle: number,
      dataLoadedCallback: TimerHandler,
      loadingArea: HTMLElement,
      testObjectName: string,
      testFileExtension: string,
      inputDropArea: HTMLElement,
      testDatasetFolder: string
   ) {
      this.lightingAzimuthalAngles = lightingAzimuthalAngles;
      this.testPolarAngle = testPolarAngle;
      this.webcamPolarAngle = webcamPolarAngle;
      this.loadingArea = loadingArea;
      this.dataLoadedCallback = dataLoadedCallback;
      this.testObjectName = testObjectName;
      this.testFileExtension = testFileExtension;
      this.inputDropArea = inputDropArea;
      this.testDatasetFolder = testDatasetFolder;

      this.lightingCoordinates = null;
      this.jsImageObjects = new Array(lightingAzimuthalAngles.length).fill(
         null
      );
      this.noLightImageObject = null;
      this.dataInput = null;
      this.type = null;
   }

   public getLightingCoordinates(polarAngle: number) {
      if (this.lightingCoordinates === null) {
         this.lightingCoordinates = [];
         for (let i = 0; i < this.lightingAzimuthalAngles.length; i++) {
            this.lightingCoordinates.push(
               new SphericalCoordinate(
                  this.lightingAzimuthalAngles[i],
                  polarAngle
               )
            );
         }
      }
      return this.lightingCoordinates;
   }

   public getImageDimensions(): [number, number] {
      if (this.isOnlyNormalMap()) {
         return [
            this.normalMapImageObject.width,
            this.normalMapImageObject.height,
         ];
      } else {
         return [this.jsImageObjects[0].width, this.jsImageObjects[0].height];
      }
   }

   public getType() {
      return this.type;
   }

   public listenForDrop(dropArea: HTMLElement) {
      dropArea.addEventListener(
         "dragover",
         function (eventObject: DragEvent) {
            eventObject.preventDefault();
         },
         false
      );
      dropArea.addEventListener(
         "drop",
         this.dataDropped.bind(this, dropArea),
         false
      );
   }

   private dataDropped(dropArea: HTMLDivElement, eventObject: DragEvent) {
      eventObject.preventDefault();

      this.type = DATATYPE.DROP;
      this.dataInput = new DataInput(this);

      const dropInput: DropInput = new DropInput(
         this.dataInput,
         eventObject.dataTransfer.files,
         this.dataLoaded.bind(this),
         this
      );

      this.dataInput.setInputClass(dropInput);
      this.onlyNormalMap = dropInput.isOnlyNormalMap();

      dropArea.style.display = "none";
      this.showLoadingArea();
   }

   private showLoadingArea() {
      this.loadingArea.style.display = "block";
   }

   public listenForTestButtonClick(testButton: HTMLElement) {
      testButton.addEventListener("click", this.testButtonClicked.bind(this));
   }

   private testButtonClicked() {
      this.type = DATATYPE.TEST;
      this.dataInput = new DataInput(this);
      this.getLightingCoordinates(this.testPolarAngle);

      this.dataInput.setInputClass(
         new TestInput(
            this.dataInput,
            this.testPolarAngle,
            this.testObjectName,
            this.testFileExtension,
            this.inputDropArea,
            this.loadingArea,
            this.testDatasetFolder,
            this.dataLoaded.bind(this)
         )
      );
   }

   public listenForWebcamButtonClick(
      webcamButton: HTMLElement,
      webcamResolution: number[]
   ) {
      webcamButton.addEventListener(
         "click",
         this.webcamButtonClicked.bind(this, webcamResolution),
         false
      );
   }

   private webcamButtonClicked(webcamResolution: number[]) {
      this.type = DATATYPE.WEBCAM;
      this.getLightingCoordinates(this.webcamPolarAngle);
      this.dataInput = new DataInput(this);

      this.dataInput.setInputClass(
         new WebcamInput(
            this.dataInput,
            webcamResolution,
            this.lightingCoordinates,
            this.dataLoaded.bind(this)
         )
      );
   }

   public isOnlyNormalMap(): boolean {
      return this.onlyNormalMap;
   }

   public getNormalMapImage(): HTMLImageElement {
      if (this.onlyNormalMap) {
         return this.normalMapImageObject;
      } else {
         throw new Error("Dataset: Normal mapping was not found in input.");
      }
   }

   public setNormalMapImage(normalMapImageObject: HTMLImageElement) {
      this.normalMapImageObject = normalMapImageObject;
   }

   public setImage(
      lightingCoordinate: SphericalCoordinate,
      jsImageObject: HTMLImageElement
   ) {
      for (let i = 0; i < this.lightingAzimuthalAngles.length; i++) {
         if (
            this.lightingAzimuthalAngles[i] ===
            lightingCoordinate.getAzimuthalAngle()
         ) {
            this.jsImageObjects[i] = jsImageObject;
            return;
         }
      }
      if (lightingCoordinate.getAzimuthalAngle() === null) {
         this.noLightImageObject = jsImageObject;
      }
      console.warn("Not found lighting angle in dataset to set image.");
   }

   public getImage(lightingAngle: number): HTMLImageElement {
      for (let i = 0; i < this.lightingAzimuthalAngles.length; i++) {
         if (
            this.lightingCoordinates[i].getAzimuthalAngle() === lightingAngle
         ) {
            return this.jsImageObjects[i];
         }
      }
      if (lightingAngle === null) {
         return this.noLightImageObject;
      }

      console.warn("Not found lighting angle in dataset to get image.");
      return null;
   }

   public getPolarAngle(lightingAngle: number) {
      for (let i = 0; i < this.lightingAzimuthalAngles.length; i++) {
         if (
            this.lightingCoordinates[i].getAzimuthalAngle() === lightingAngle
         ) {
            return this.lightingCoordinates[i].getPolarAngle();
         }
      }

      console.warn("Not found lighting angle in dataset to get image.");
      return null;
   }

   public getObjectName() {
      return this.dataInput.getObjectName();
   }

   private dataLoaded() {
      setTimeout(this.dataLoadedCallback, 0);
   }
}

class DataInput {
   dataset: Dataset;
   type: DATATYPE;
   inputClass: any;

   constructor(dataset: Dataset) {
      this.dataset = dataset;
      this.type = dataset.getType();
      this.inputClass = null;
   }

   public getObjectName() {
      return this.inputClass.getObjectName();
   }

   public getInputClass(): DropInput | WebcamInput | TestInput {
      return this.inputClass;
   }

   public setInputClass(inputClass: DropInput | WebcamInput | TestInput) {
      this.inputClass = inputClass;
   }

   public inputImage(
      lightingCoordinate: SphericalCoordinate,
      image: HTMLImageElement
   ) {
      this.dataset.setImage(lightingCoordinate, image);
   }
}

class TestInput {
   private testDataLoadedCallback: TimerHandler;
   private loadedImages: number = 0;
   private dataInput: DataInput;

   private testPolarAngle: number;
   private testObjectName: string;
   private testFileExtension: string;
   private loadingArea: HTMLElement;
   private testDatasetFolder: string;

   constructor(
      dataInput: DataInput,
      testPolarAngle: number,
      testObjectName: string,
      testFileExtension: string,
      inputDropArea: HTMLElement,
      loadingArea: HTMLElement,
      testDatasetFolder: string,
      testDataLoadedCallback: TimerHandler
   ) {
      this.dataInput = dataInput;
      this.testPolarAngle = testPolarAngle;
      this.testDataLoadedCallback = testDataLoadedCallback;
      this.testObjectName = testObjectName;
      this.testFileExtension = testFileExtension;
      this.loadingArea = loadingArea;
      this.testDatasetFolder = testDatasetFolder;

      inputDropArea.remove();
      this.loadingArea.style.display = "block";
      this.loadAllImages();
   }

   public getObjectName() {
      return this.testObjectName;
   }

   private singleImageLoaded(
      image: HTMLImageElement,
      imageDegree: SphericalCoordinate
   ) {
      this.loadedImages++;
      this.dataInput.inputImage(imageDegree, image);
      if (this.loadedImages === LIGHTING_AZIMUTHAL_ANGLES.length) {
         setTimeout(this.testDataLoadedCallback, 0);
      }
   }

   private loadAllImages() {
      let polarString = "" + this.testPolarAngle;
      while (polarString.length < 3) {
         polarString = "0" + polarString;
      }

      for (let i = 0; i < LIGHTING_AZIMUTHAL_ANGLES.length; i++) {
         let azimuthalString = "" + LIGHTING_AZIMUTHAL_ANGLES[i];
         while (azimuthalString.length < 3) {
            azimuthalString = "0" + azimuthalString;
         }

         const fileName =
            this.testObjectName +
            "_" +
            azimuthalString +
            "_" +
            polarString +
            "." +
            this.testFileExtension;

         let image = new Image();
         image.addEventListener(
            "load",
            this.singleImageLoaded.bind(
               this,
               image,
               new SphericalCoordinate(
                  LIGHTING_AZIMUTHAL_ANGLES[i],
                  this.testPolarAngle
               )
            )
         );
         image.crossOrigin = "anonymous";
         image.src = this.testDatasetFolder + fileName;
      }
   }
}

class DropInput {
   private dataInput: DataInput;
   private lightingCoordinates: SphericalCoordinate[];
   private droppedDataLoadedCallback: TimerHandler;
   private droppedFiles: FileList;
   private imagesLoaded: number;
   private dataset: Dataset;
   private objectName: string;

   constructor(
      dataInput: DataInput,
      droppedFiles: FileList,
      droppedDataLoadedCallback: TimerHandler,
      dataset: Dataset
   ) {
      this.dataInput = dataInput;
      this.lightingCoordinates = null;

      this.droppedDataLoadedCallback = droppedDataLoadedCallback;
      this.droppedFiles = droppedFiles;
      this.dataset = dataset;
      this.objectName = null;

      this.imagesLoaded = 0;
      this.loadAllImages();
   }

   public isOnlyNormalMap(): boolean {
      return this.droppedFiles.length === 1;
   }

   public getObjectName(): string {
      return this.objectName;
   }

   private loadAllImages() {
      console.log("Loading " + this.droppedFiles.length + " images for cpu.");

      if (this.isOnlyNormalMap()) {
         if (!this.droppedFiles[0].type.startsWith("image")) {
            throw new Error("File is not of type image.");
         }
         const callback: TimerHandler = this.droppedDataLoadedCallback;
         const thisDataset: Dataset = this.dataset;
         const reader = new FileReader();
         reader.addEventListener("load", function () {
            let image = new Image();
            image.addEventListener("load", function () {
               setTimeout(callback, 0);
            });

            const readerResult = reader.result;
            image.src = String(readerResult);
            thisDataset.setNormalMapImage(image);
         });
         reader.readAsDataURL(this.droppedFiles[0]);
      } else {
         const fileNameGlobal: string = this.droppedFiles[0].name.split(".")[0];
         const polarAngleGlobal: number = Number(
            fileNameGlobal.split("_", 3)[2]
         );
         this.objectName = fileNameGlobal.split("_", 1)[0];

         this.lightingCoordinates = this.dataset.getLightingCoordinates(
            polarAngleGlobal
         );

         for (let i = 0; i < this.droppedFiles.length; i++) {
            const fileName: string = this.droppedFiles[i].name.split(".")[0];

            const azimuthalAngle: number = Number(fileName.split("_", 2)[1]);
            const polarAngle: number = Number(fileName.split("_", 3)[2]);

            const imageDegree = new SphericalCoordinate(
               azimuthalAngle,
               polarAngle
            );

            const fileType = this.droppedFiles[i].type;

            if (
               LIGHTING_AZIMUTHAL_ANGLES.includes(azimuthalAngle) &&
               fileType.startsWith("image")
            ) {
               let reader = new FileReader();
               reader.addEventListener(
                  "load",
                  this.readerLoaded.bind(this, reader, imageDegree)
               );
               reader.readAsDataURL(this.droppedFiles[i]);
            } else {
               this.imagesLoaded++;
            }
         }
      }
   }

   private readerLoaded(reader: FileReader, imageDegree: SphericalCoordinate) {
      //reader.removeEventListener("load", this.readerLoaded);
      let image = new Image();
      image.addEventListener(
         "load",
         this.imageLoaded.bind(this, image, imageDegree)
      );

      const readerResult = reader.result;
      image.src = String(readerResult);
   }

   private imageLoaded(
      image: HTMLImageElement,
      imageDegree: SphericalCoordinate
   ) {
      console.log(
         "Image with spherical degree " +
            imageDegree.getDisplayString() +
            " loaded.",
         1
      );
      this.imagesLoaded++;
      image.removeEventListener("load", this.imageLoaded.bind(this));
      this.dataInput.inputImage(imageDegree, image);
      if (this.imagesLoaded === this.lightingCoordinates.length) {
         setTimeout(this.droppedDataLoadedCallback, 0);
      }
   }
}

class WebcamInput {
   private dataInput: DataInput;
   private screenLighting: ScreenLighting;
   private webcam: Webcam;
   private dataLoadedCallback: TimerHandler;
   private imageDataList: string[];
   private jsImageObjectList: HTMLImageElement[];
   private lightingCoordinates: SphericalCoordinate[];
   private loadedImages: number;
   private noLightImageData: string = null;
   private noLightImageObject: HTMLImageElement = null;

   constructor(
      dataInput: DataInput,
      resolution: number[],
      lightingCoordinates: SphericalCoordinate[],

      dataLoadedCallback: TimerHandler
   ) {
      this.dataInput = dataInput;
      this.screenLighting = new GradientLighting();
      this.webcam = new Webcam(resolution, this.startCapture.bind(this));
      this.dataLoadedCallback = dataLoadedCallback;

      this.imageDataList = Array(lightingCoordinates.length).fill(null);
      this.jsImageObjectList = Array(lightingCoordinates.length).fill(null);
      this.lightingCoordinates = lightingCoordinates;
      this.loadedImages = 0;
      document.documentElement.requestFullscreen();
      this.webcam.startStreaming();
   }

   public getPolarAngle(): number {
      return this.lightingCoordinates[0].getPolarAngle();
   }

   public getObjectName() {
      return DATATYPE.WEBCAM;
   }

   private getNextLightingAngleIndex() {
      for (let i = 0; i < this.lightingCoordinates.length; i++) {
         if (this.imageDataList[i] == null) {
            return i;
         }
      }
      return null;
   }

   private setImageData(
      lightingCoordinate: SphericalCoordinate,
      imageData: string
   ) {
      for (let i = 0; i < this.lightingCoordinates.length; i++) {
         if (
            this.lightingCoordinates[i].getAzimuthalAngle() ===
            lightingCoordinate.getAzimuthalAngle()
         ) {
            this.imageDataList[i] = imageData;
            this.capture();
            return i;
         }
      }
      if (lightingCoordinate.getAzimuthalAngle() === null) {
         this.noLightImageData = imageData;
         this.capture();
         return null;
      }
   }

   public startCapture() {
      this.webcam.purgeDisplay();
      this.screenLighting.display(
         this.lightingCoordinates[0].getAzimuthalAngle(),
         this.singleCapture.bind(this, this.lightingCoordinates[0])
      );
   }

   private imageLoadedFromData(
      image: HTMLImageElement,
      lightingCoordinate: SphericalCoordinate
   ) {
      console.log(lightingCoordinate.getDisplayString() + " image loaded.");
      //image.removeEventListener("load", ev);
      this.loadedImages++;
      this.dataInput.inputImage(lightingCoordinate, image);
      if (this.loadedImages == this.lightingCoordinates.length) {
         console.log("All images from webcam loaded.");
         document.exitFullscreen();
         setTimeout(this.dataLoadedCallback, 0);
      }
   }

   private loadAllImagesFromData() {
      for (let i = 0; i < this.lightingCoordinates.length; i++) {
         const image = new Image();
         image.addEventListener(
            "load",
            this.imageLoadedFromData.bind(
               this,
               image,
               this.lightingCoordinates[i]
            )
         );
         image.src = this.imageDataList[i];
      }

      const image = new Image();
      image.addEventListener(
         "load",
         this.imageLoadedFromData.bind(
            this,
            image,
            new SphericalCoordinate(null, null)
         )
      );
      image.src = this.noLightImageData;
   }

   private capture() {
      let nextLightingAngleIndex = this.getNextLightingAngleIndex();

      if (nextLightingAngleIndex !== null) {
         let lightingAngle = this.lightingCoordinates[
            nextLightingAngleIndex
         ].getAzimuthalAngle();

         const webcamInput: WebcamInput = <WebcamInput>(
            this.dataInput.getInputClass()
         );

         this.screenLighting.display(
            lightingAngle,
            this.singleCapture.bind(
               this,
               new SphericalCoordinate(
                  lightingAngle,
                  webcamInput.getPolarAngle()
               )
            )
         );
      } else if (this.noLightImageData === null) {
         this.screenLighting.display(
            null,
            this.singleCapture.bind(this, new SphericalCoordinate(null, null))
         );
      } else {
         this.screenLighting.hide();
         this.webcam.purge();
         this.loadAllImagesFromData();
      }
   }

   private singleCapture(lightingCoordinate: SphericalCoordinate) {
      console.log(
         "capture " + lightingCoordinate.getDisplayString() + " degree image."
      );
      setTimeout(
         this.setImageData.bind(
            this,
            lightingCoordinate,
            this.webcam.takePicture()
         ),
         1000
      );
   }
}
