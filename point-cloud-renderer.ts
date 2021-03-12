"use strict";

const enum VERTEX_COLOR {
   ALBEDO = "albedo",
   NORMAL_MAPPING = "normal_mapping",
   ERROR_PRONENESS = "error-proneness",
}

class PointCloudRenderer {
   private pointClouds: PointCloud[];

   private vertices: number[] = [];
   private vertexCount: number;
   private vertexSize: number = 1;
   private vertexBuffer: WebGLBuffer;

   private lineVertices: number[] = [];
   private lineVertexCount: number;
   private lineVertexBuffer: WebGLBuffer;

   private vertexAttribute: number;

   private div: HTMLElement;

   private gl: WebGL2RenderingContext;
   private canvas: HTMLCanvasElement;
   private rotationUniformX: WebGLUniformLocation;
   private rotationUniformY: WebGLUniformLocation;
   private vertexColorBuffer: WebGLBuffer;

   private verticalOrientation: boolean;

   constructor(
      pointClouds: PointCloud[],
      div: HTMLElement,
      verticalOrientation: boolean = false
   ) {
      this.pointClouds = pointClouds;
      this.div = div;
      this.verticalOrientation = verticalOrientation;
   }

   public updateVertexColor(newColor: VERTEX_COLOR): void {
      let colors: number[];

      // TODO: Set color.

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexColorBuffer);
      this.gl.bufferData(
         this.gl.ARRAY_BUFFER,
         new Float32Array(colors),
         this.gl.STATIC_DRAW
      );
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
   }

   private loadPointCloud(pointCloud: PointCloud): void {
      const scanCamera: ScanCamera = pointCloud.getScanCamera();
      const vertices: number[] = scanCamera.getGpuDepthPixelsInMillimeter(
         pointCloud.getGpuVertices()
      );
      const lineVertices: number[] = scanCamera.getGuiLineGpuVertices();

      this.vertices.push(...vertices);
      this.lineVertices.push(...lineVertices);
      this.vertexCount = this.vertices.length / 3;
      this.lineVertexCount = this.lineVertices.length / 3;

      this.vertexBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
      this.gl.bufferData(
         this.gl.ARRAY_BUFFER,
         new Float32Array(this.vertices),
         this.gl.STATIC_DRAW
      );
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

      this.lineVertexBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.lineVertexBuffer);
      this.gl.bufferData(
         this.gl.ARRAY_BUFFER,
         new Float32Array(this.lineVertices),
         this.gl.STATIC_DRAW
      );
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
   }

   private initializeContext(): void {
      this.canvas = document.createElement("canvas");
      this.canvas.style.transition = "all 1s";
      this.div.appendChild(this.canvas);
      this.gl = this.canvas.getContext("webgl2");

      for (let i = 0, length = this.pointClouds.length; i < length; i++) {
         this.loadPointCloud(this.pointClouds[i]);
      }

      let xRot = -90;
      if (this.verticalOrientation) {
         xRot = -45;
      }
      xRot *= DEGREE_TO_RADIAN_FACTOR;

      let vertCode = [
         "#version 300 es",
         "",
         "in vec3 coordinates;",
         "in vec3 v_color;",
         "uniform float xRot;",
         "uniform float yRot;",
         "out vec3 f_color;",
         "",
         "void main() {",
         "",
         " float sinRotX = sin(xRot);",
         " float cosRotX = cos(xRot);",
         " ",
         " float sinRotY = sin(yRot);",
         " float cosRotY = cos(yRot);",
         " ",
         " mat3 yRot;",
         " yRot[0] = vec3(cosRotY, 0.0, sinRotY);",
         " yRot[1] = vec3(0.0, 1.0, 0.0);",
         " yRot[2] = vec3(-sinRotY, 0.0, cosRotY);",
         " ",
         " mat3 xRot;",
         " xRot[0] = vec3(1.0, 0.0, 0.0);",
         " xRot[1] = vec3(0.0, cosRotX, -sinRotX);",
         " xRot[2] = vec3(0.0, sinRotX, cosRotX);",
         " vec3 pos = coordinates * xRot * yRot;",
         " gl_Position = vec4(pos, 1.0);",
         " gl_PointSize = " +
            GlslFloat.getJsNumberAsString(this.vertexSize) +
            ";",
         "}",
      ].join("\n");

      let vertShader = this.gl.createShader(this.gl.VERTEX_SHADER);

      this.gl.shaderSource(vertShader, vertCode);
      this.gl.compileShader(vertShader);

      let fragCode = [
         "#version 300 es",
         "precision " + GPU_GL_FLOAT_PRECISION.MEDIUM + " float;",
         "",
         "in vec3 f_color;",
         "out vec4 fragColor;",
         "",
         "void main() {",
         //" fragColor = vec4(f_color, 1.0);",
         " fragColor = vec4(1.0);",
         "}",
      ].join("\n");

      let fragShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
      this.gl.shaderSource(fragShader, fragCode);
      this.gl.compileShader(fragShader);

      let shaderProgram = this.gl.createProgram();
      this.gl.attachShader(shaderProgram, vertShader);
      this.gl.attachShader(shaderProgram, fragShader);
      this.gl.linkProgram(shaderProgram);
      this.gl.useProgram(shaderProgram);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

      this.vertexAttribute = this.gl.getAttribLocation(
         shaderProgram,
         "coordinates"
      );
      //let color = this.gl.getAttribLocation(shaderProgram, "v_color");

      this.rotationUniformX = this.gl.getUniformLocation(shaderProgram, "xRot");
      this.rotationUniformY = this.gl.getUniformLocation(shaderProgram, "yRot");

      this.gl.clearColor(0, 0, 0, 0);
      this.gl.enable(this.gl.DEPTH_TEST);
      this.refreshViewportSize();

      window.addEventListener("resize", this.refreshViewportSize.bind(this));
   }

   private refreshViewportSize(): void {
      if (this.canvas.width > this.canvas.height) {
         this.canvas.width = this.div.clientHeight;
         this.canvas.height = this.div.clientHeight;
      } else {
         this.canvas.width = this.div.clientWidth;
         this.canvas.height = this.div.clientWidth;
      }

      //this.canvas.width = this.div.clientWidth;
      //this.canvas.height = this.div.clientHeight;

      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
   }

   public startRendering(): void {
      console.log("Loading rendered point cloud preview.");
      this.initializeContext();

      const cThis: PointCloudRenderer = this;
      window.addEventListener("mousemove", (event: MouseEvent) => {
         const rotationX: number =
            (event.y / window.innerHeight) * Math.PI * 2 + Math.PI;
         const rotationY: number =
            (event.x / window.innerWidth) * Math.PI * 2 + Math.PI;
         setTimeout(cThis.render.bind(cThis, rotationY, rotationX));
      });
      setTimeout(this.render.bind(this, 0, 0));
   }

   private render(rotationY: number, rotationX: number): void {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

      this.gl.uniform1f(this.rotationUniformX, rotationX);
      this.gl.uniform1f(this.rotationUniformY, rotationY);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
      this.gl.vertexAttribPointer(
         this.vertexAttribute,
         3,
         this.gl.FLOAT,
         false,
         0,
         0
      );
      this.gl.enableVertexAttribArray(this.vertexAttribute);
      this.gl.drawArrays(this.gl.POINTS, 0, this.vertexCount);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.lineVertexBuffer);
      this.gl.vertexAttribPointer(
         this.vertexAttribute,
         3,
         this.gl.FLOAT,
         false,
         0,
         0
      );
      this.gl.enableVertexAttribArray(this.vertexAttribute);
      this.gl.drawArrays(this.gl.LINES, 0, this.lineVertexCount);
   }
}
