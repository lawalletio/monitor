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
