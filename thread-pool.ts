"use strict";

const MAX_RUNNING_THREADS_IN_POOL: number = 32;
const POOL_STATUS_REFRESH_INTERVAL_PERCENT: number = 5;

class ThreadPool {
   private threads: Thread[] = [];
   private maxRunningThreadCount: number;
   private statusRefreshIntervalPercent: number;
   private startTime: number;
   private results: any[] = [];

   private statusRefreshInterval: number = 1;
   private lastStatusRefresh: number = 0;

   private finishedThreadsCount: number = 0;

   private domStatusElement: DOMStatusElement;
   private statusProgressPercent: number = 0;

   constructor(
      domStatusElement: DOMStatusElement,
      maxRunningThreadCount: number = MAX_RUNNING_THREADS_IN_POOL,
      statusRefreshIntervalPercent: number = POOL_STATUS_REFRESH_INTERVAL_PERCENT
   ) {
      this.domStatusElement = domStatusElement;
      this.maxRunningThreadCount = maxRunningThreadCount;
      this.statusRefreshIntervalPercent = statusRefreshIntervalPercent;
   }

   public add(...methods: Function[]): void {
      for (let i = 0, length = methods.length; i < length; i++) {
         this.addThread(new Thread(methods[i]));
      }
      this.statusRefreshInterval =
         (this.threads.length / 100) * this.statusRefreshIntervalPercent;
   }

   private addThread(thread: Thread): void {
      thread.setCallback(this.threadCallback.bind(this));
      this.threads.push(thread);
   }

   public async run(): Promise<any[]> {
      this.startTime = performance.now();
      const threadPool: ThreadPool = this;

      return new Promise(async (resolve) => {
         threadPool.startNextThreads(threadPool.maxRunningThreadCount);

         // TODO: Make better.
         while (!threadPool.isFinished()) {
            await new Promise((r) => setTimeout(r, 500));
         }
         this.domStatusElement.setFinish();
         resolve(threadPool.results);
      });
   }

   public threadCallback(): void {
      this.finishedThreadsCount++;
      if (
         this.finishedThreadsCount - this.lastStatusRefresh >=
         this.statusRefreshInterval
      ) {
         this.updateStatus();
         this.lastStatusRefresh = this.finishedThreadsCount;
      }

      if (this.isFinished()) {
         for (let i = 0, length = this.threads.length; i < length; i++) {
            this.results.push(this.threads[i].getResult());
         }
         const durationInSeconds: number = Math.round(
            performance.now() - this.startTime
         );
         // TODO: Display duration.
         this.updateStatus();
      } else {
         this.startNextThreads();
      }
   }

   private startNextThreads(count: number = 1): void {
      if (count > 0) {
         let startedThreadsCount: number = 0;
         for (let i = 0, length = this.threads.length; i < length; i++) {
            if (!this.threads[i].isStarted()) {
               this.threads[i].run();
               startedThreadsCount++;
               if (startedThreadsCount >= count) {
                  break;
               }
            }
         }
      }
   }

   private isFinished(): boolean {
      for (let i = 0, length = this.threads.length; i < length; i++) {
         if (!this.threads[i].isFinished()) {
            return false;
         }
      }
      return true;
   }

   private updateStatus(): void {
      this.statusProgressPercent =
         (this.finishedThreadsCount / this.threads.length) * 100;

      this.domStatusElement.updateProgress(this.statusProgressPercent);
   }
}

class Thread {
   private method: Function;
   private callback: Function;
   private finished: boolean = false;
   private started: boolean = false;
   private result: any;

   constructor(method: Function) {
      this.method = method;
   }

   public setCallback(callback: Function): void {
      this.callback = callback;
   }

   public isFinished(): boolean {
      return this.finished;
   }

   private setStarted(): void {
      this.started = true;
   }

   public isStarted(): boolean {
      return this.started;
   }

   public getResult(): any {
      return this.result;
   }

   private setFinished(result: any): void {
      this.result = result;
      this.finished = true;
      this.callback();
   }

   public run(): void {
      this.setStarted();

      const thisMethod: Function = this.method;
      const thenCall: Function = this.setFinished.bind(this);

      setTimeout(() => {
         const promise: Promise<any> = new Promise((resolve) => {
            const result: any = thisMethod();
            resolve(result);
         });

         promise.then(
            (result) => {
               thenCall(result);
            },
            (reason) => {
               console.error(reason);
            }
         );
      });
   }
}
