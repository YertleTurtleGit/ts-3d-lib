"use strict";

class DOMStatusElement {
   public static setParentDiv(parentDiv: HTMLDivElement) {
      DOMStatusElement.parentDiv = parentDiv;
   }
   public static setCssClass(cssClass: string) {
      DOMStatusElement.cssClass = cssClass;
   }

   private static parentDiv: HTMLDivElement;
   private static cssClass: string;
   private static statusElements: DOMStatusElement[] = [];

   private description: string;

   private divDOM: HTMLDivElement;
   private paragraphDOM: HTMLParagraphElement;
   private progressDOM: HTMLProgressElement;

   constructor(description: string) {
      this.description = description;
      DOMStatusElement.statusElements.push(this);
      this.createDOM();
      console.log(this.description);
   }

   public updateProgress(progressPercent: number): void {
      if (progressPercent > 0) {
         this.progressDOM.value = progressPercent;
      } else {
         // indeterminate progress bar style
         this.progressDOM.value = -1;
      }
   }

   public setFinish(): void {
      this.progressDOM.value = 100;

      const divToRemove: HTMLDivElement = this.divDOM;
      divToRemove.style.transition = "all 0.5s";
      divToRemove.style.transform += "translateY(-50%)";
      divToRemove.style.opacity = "0";
      setTimeout(() => {
         divToRemove.remove();
      }, 250);
   }

   private createDOM(): void {
      if (DOMStatusElement.parentDiv) {
         this.divDOM = document.createElement("div");
         this.paragraphDOM = document.createElement("p");
         this.progressDOM = document.createElement("progress");

         this.paragraphDOM.innerText = this.description;

         this.progressDOM.max = 100;
         this.progressDOM.value = -1;

         this.divDOM.appendChild(this.paragraphDOM);
         this.divDOM.appendChild(this.progressDOM);

         this.divDOM.classList.add(DOMStatusElement.cssClass);

         DOMStatusElement.parentDiv.appendChild(this.divDOM);
      }
   }
}
