"use strict";

abstract class ScreenLighting {
   public abstract display(degree: number, callback: TimerHandler): void;
   public abstract hide(): void;
}

class GradientLighting extends ScreenLighting {
   private gradientCanvas: HTMLCanvasElement;
   private gradientCanvasContext: CanvasRenderingContext2D;

   constructor() {
      super();
      this.gradientCanvas = document.createElement("canvas");
      this.gradientCanvasContext = this.gradientCanvas.getContext("2d");
      this.gradientCanvas.style.position = "absolute";
      this.gradientCanvas.style.width = "100%";
      this.gradientCanvas.style.height = "100%";
      this.gradientCanvas.style.top = "0";
      this.gradientCanvas.style.left = "0";
      this.gradientCanvas.style.zIndex = "999";
      this.gradientCanvas.width = window.innerWidth;
      this.gradientCanvas.height = window.innerHeight;
      document.body.appendChild(this.gradientCanvas);
   }

   public display(degree: number, callback: TimerHandler): void {
      const width = this.gradientCanvas.width;
      const height = this.gradientCanvas.height;

      this.gradientCanvasContext.clearRect(0, 0, width, height);

      if (degree !== null) {
         const gradient = this.getBestFitGradient(
            this.gradientCanvas,
            this.gradientCanvasContext,
            degree,
            ["white", "black"]
         );
         this.gradientCanvasContext.fillStyle = gradient;
      } else {
         this.gradientCanvasContext.fillStyle = "black";
      }

      this.gradientCanvasContext.fillRect(0, 0, width, height);

      // TODO: Wait for buffer to display draw
      setTimeout(callback, 1000);
   }

   public hide() {
      this.removeGradientDivElements();
   }

   private getBestFitGradient(
      canvas: HTMLCanvasElement,
      context: CanvasRenderingContext2D,
      angleDegree: number,
      colors: string[]
   ) {
      const w = canvas.width;
      const h = canvas.height;
      const ctx = context;
      angleDegree = Math.abs(angleDegree - 360);
      const angle = angleDegree * (Math.PI / 180);

      let dist = Math.sqrt(w * w + h * h) / 2;
      let diagAngle = Math.asin(h / 2 / dist);

      let a1 = ((angle % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2);
      if (a1 > Math.PI) {
         a1 -= Math.PI;
      }
      if (a1 > Math.PI / 2 && a1 <= Math.PI) {
         a1 = Math.PI / 2 - (a1 - Math.PI / 2);
      }
      let ang1 = Math.PI / 2 - diagAngle - Math.abs(a1);
      let ang2 = Math.abs(diagAngle - Math.abs(a1));

      let dist1 = Math.cos(ang1) * h;
      let dist2 = Math.cos(ang2) * w;

      let scale = Math.max(dist2, dist1) / 2;

      let dx = Math.cos(angle) * scale;
      let dy = Math.sin(angle) * scale;

      const g = ctx.createLinearGradient(
         w / 2 + dx,
         h / 2 + dy,
         w / 2 - dx,
         h / 2 - dy
      );

      for (let i = 0; i < colors.length; i++) {
         g.addColorStop(i / (colors.length - 1), colors[i]);
      }
      return g;
   }

   private removeGradientDivElements() {
      this.gradientCanvas.remove();
   }
}
