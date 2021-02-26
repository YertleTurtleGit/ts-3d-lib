"use strict";

const enum VERTEX_COLOR {
   ALBEDO = "albedo",
   NORMAL_MAPPING = "normal_mapping",
   ERROR_PRONENESS = "error-proneness",
}

class PointCloudRenderer {
   private pointCloud: PointCloud;
   private vertexCount: number;
   private vertexSize: number = 2;

   private rotationSpeed: number = 0.001;
   private rotation: number = 0;
   private deltaTime: number = 0;
   private then: number = 0;

   private div: HTMLElement;

   private gl: WebGL2RenderingContext;
   private canvas: HTMLCanvasElement;
   private rotationUniform: WebGLUniformLocation;
   private vertexColorBuffer: WebGLBuffer;

   private verticalOrientation: boolean;

   constructor(
      pointCloud: PointCloud,
      div: HTMLElement,
      verticalOrientation: boolean
   ) {
      this.pointCloud = pointCloud;
      this.div = div;
      this.verticalOrientation = verticalOrientation;
      this.vertexCount = this.pointCloud.getGpuVertices().length / 3;
   }

   public updateVertexColor(newColor: VERTEX_COLOR): void {
      let colors: number[];

      switch (newColor) {
         case VERTEX_COLOR.ALBEDO: {
            colors = this.pointCloud.getGpuVertexAlbedoColors();
            break;
         }
         case VERTEX_COLOR.NORMAL_MAPPING: {
            colors = this.pointCloud.getGpuVertexNormalColors();
            break;
         }
         case VERTEX_COLOR.ERROR_PRONENESS: {
            colors = this.pointCloud.getGpuVertexErrorColors();
            break;
         }
      }

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexColorBuffer);
      this.gl.bufferData(
         this.gl.ARRAY_BUFFER,
         new Float32Array(colors),
         this.gl.STATIC_DRAW
      );
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
   }

   private initializeContext(): void {
      this.canvas = document.createElement("canvas");
      this.canvas.style.transition = "all 1s";
      this.div.appendChild(this.canvas);
      this.gl = this.canvas.getContext("webgl2");

      let vertices = this.pointCloud.getGpuVertices();
      let colors = this.pointCloud.getGpuVertexAlbedoColors();

      let vertex_buffer = this.gl.createBuffer();

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertex_buffer);

      this.gl.bufferData(
         this.gl.ARRAY_BUFFER,
         new Float32Array(vertices),
         this.gl.STATIC_DRAW
      );

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

      this.vertexColorBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexColorBuffer);
      this.gl.bufferData(
         this.gl.ARRAY_BUFFER,
         new Float32Array(colors),
         this.gl.STATIC_DRAW
      );
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

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
         "uniform float rot;",
         "out vec3 f_color;",
         "",
         "void main() {",
         " f_color = v_color;",
         "",
         " float sinRotY = sin(rot);",
         " float cosRotY = cos(rot);",
         " ",
         " float sinRotX = " +
            GlslFloat.getJsNumberAsString(Math.sin(xRot)) +
            ";",
         " float cosRotX = " +
            GlslFloat.getJsNumberAsString(Math.cos(xRot)) +
            ";",
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
         " gl_Position = vec4(pos.x *2.0, (pos.y + 0.5) *2.0, pos.z *2.0, 1.0);",
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
         " fragColor = vec4(f_color, 1.0);",
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
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertex_buffer);

      let coordinates = this.gl.getAttribLocation(shaderProgram, "coordinates");
      this.gl.vertexAttribPointer(coordinates, 3, this.gl.FLOAT, false, 0, 0);
      this.gl.enableVertexAttribArray(coordinates);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexColorBuffer);
      let color = this.gl.getAttribLocation(shaderProgram, "v_color");
      this.gl.vertexAttribPointer(color, 3, this.gl.FLOAT, false, 0, 0);
      this.gl.enableVertexAttribArray(color);

      this.rotationUniform = this.gl.getUniformLocation(shaderProgram, "rot");

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

      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
   }

   public startRendering(): void {
      console.log("Loading rendered point cloud preview.");
      this.initializeContext();
      this.render(0);
   }

   private render(now: number): void {
      now *= 1.001;
      this.deltaTime = now - this.then;
      this.then = now;

      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

      this.rotation += this.deltaTime * this.rotationSpeed;

      this.gl.uniform1f(this.rotationUniform, this.rotation);

      this.gl.drawArrays(this.gl.POINTS, 0, this.vertexCount);
      window.requestAnimationFrame(this.render.bind(this));
   }
}
