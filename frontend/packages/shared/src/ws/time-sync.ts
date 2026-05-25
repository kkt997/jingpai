export class TimeSync {
  private offset = 0;
  private samples: number[] = [];

  calibrate(serverTs: number, rtt: number): void {
    const newOffset = serverTs + rtt / 2 - Date.now();
    this.samples.push(newOffset);
    if (this.samples.length > 10) {
      this.samples.shift();
    }
    // Use median to filter outliers
    const sorted = [...this.samples].sort((a, b) => a - b);
    this.offset = sorted[Math.floor(sorted.length / 2)];
  }

  now(): number {
    return Date.now() + this.offset;
  }

  remaining(endTime: number): number {
    return Math.max(0, endTime - this.now());
  }

  getOffset(): number {
    return this.offset;
  }
}

export const timeSync = new TimeSync();
