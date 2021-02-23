"use strict";
class PointCloudChart {
    constructor(pointCloud, div) {
        this.vertexSize = 1;
        this.pointCloud = pointCloud;
        this.div = div;
    }
    refreshViewportSize() {
        this.canvas.width = this.div.clientWidth;
        this.canvas.height = this.div.clientHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    load() {
        this.canvas = document.createElement("canvas");
        this.canvas.style.transition = "all 1s";
        this.div.appendChild(this.canvas);
        this.gl = this.canvas.getContext("webgl2");
        const vertices = [];
        const colors = [];
        const width = this.pointCloud.getWidth();
        const height = this.pointCloud.getHeight();
        const y = Math.round(height / 2);
        const baseIndex = y * width;
        const alpha = 1;
        let highestDepth = this.pointCloud.getAnglesZValues()[0][0];
        let lowestDepth = this.pointCloud.getAnglesZValues()[0][0];
        for (let i = 0; i < this.pointCloud.getAzimuthalAngles().length; i++) {
            for (let x = 0; x < width; x++) {
                const index = x + baseIndex;
                const gpuY = this.pointCloud.getAnglesZValues()[i][index];
                if (!isNaN(gpuY)) {
                    const gpuX = (x / width - 0.5) * 2;
                    highestDepth = Math.max(gpuY, highestDepth);
                    lowestDepth = Math.min(gpuY, lowestDepth);
                    vertices.push(gpuX, gpuY, 0);
                }
                const color = this.wheelColorFromAngle(this.pointCloud.getAzimuthalAngles()[i]);
                colors.push(color.red, color.green, color.blue);
            }
        }
        for (let i = 1; i < vertices.length; i += 3) {
            vertices[i] += Math.abs(lowestDepth);
            vertices[i] /= highestDepth + Math.abs(lowestDepth);
            vertices[i] *= 2;
            vertices[i] -= 1;
        }
        this.vertexCount = vertices.length / 3;
        let vertex_buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertex_buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        let vertexColorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexColorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        let vertCode = [
            "#version 300 es",
            "",
            "in vec3 coordinates;",
            "in vec3 v_color;",
            "out vec3 f_color;",
            "",
            "void main() {",
            " f_color = v_color;",
            "",
            " gl_Position = vec4(coordinates.x, coordinates.y, coordinates.z, 1.0);",
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
            "precision " + "mediump" /* MEDIUM */ + " float;",
            "",
            "in vec3 f_color;",
            "out vec4 fragColor;",
            "",
            "void main() {",
            " fragColor = vec4(f_color, " +
                GlslFloat.getJsNumberAsString(alpha) +
                ");",
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
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexColorBuffer);
        let color = this.gl.getAttribLocation(shaderProgram, "v_color");
        this.gl.vertexAttribPointer(color, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(color);
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.refreshViewportSize();
        window.addEventListener("resize", this.refreshViewportSize.bind(this));
        this.render();
        uiLog("Graph rendered.");
    }
    render() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.drawArrays(this.gl.POINTS, 0, this.vertexCount);
    }
    wheelColorFromAngle(angle) {
        let h = angle / 360;
        let s = 1;
        let v = 1;
        let r, g, b, i, f, p, q, t;
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0:
                (r = v), (g = t), (b = p);
                break;
            case 1:
                (r = q), (g = v), (b = p);
                break;
            case 2:
                (r = p), (g = v), (b = t);
                break;
            case 3:
                (r = p), (g = q), (b = v);
                break;
            case 4:
                (r = t), (g = p), (b = v);
                break;
            case 5:
                (r = v), (g = p), (b = q);
                break;
        }
        return {
            red: r,
            green: g,
            blue: b,
        };
    }
}
