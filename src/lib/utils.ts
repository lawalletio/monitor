export function wAvg(data: number[], w: number[]): number {
  if (data.length !== w.length) {
    throw new Error('Data and weights must be of same length');
  }
  let dSum = 0;
  let wSum = 0;
  for (let i = 0; i < data.length; ++i) {
    dSum += data[i] * w[i];
    wSum += w[i];
  }
  return dSum / wSum;
}

export class Queue<T> {
  private readonly queue: Record<string, T>;

  private start: bigint;

  private end: bigint;

  constructor() {
    this.queue = {};
    this.start = 0n;
    this.end = 0n;
  }

  get size(): bigint {
    return this.end - this.start;
  }

  isEmpty(): boolean {
    return this.end === this.start;
  }

  toArray(): T[] {
    return [...this];
  }

  dequeue(): T | null {
    if (this.isEmpty()) {
      return null;
    } else {
      const value: T = this.queue[this.start.toString()];
      delete this.queue[this.start.toString()];
      ++this.start;
      return value;
    }
  }

  enqueue(value: T): void {
    this.queue[this.end.toString()] = value;
    ++this.end;
  }

  toString(): string {
    return this.queue.toString();
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (let i = this.start; i < this.end; ++i) {
      yield this.queue[i.toString()];
    }
  }
}

export class LimitedQueue<T> extends Queue<T> {
  private readonly limit: bigint;

  constructor(limit: number) {
    super();
    this.limit = BigInt(limit);
  }

  enqueue(value: T): void {
    if (this.size === this.limit) {
      super.dequeue();
    }
    super.enqueue(value);
  }
}
