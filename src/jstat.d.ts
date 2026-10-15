declare module 'jstat' {
  interface Dist2 {
    cdf(x: number, a: number, b: number): number;
    inv(p: number, a: number, b: number): number;
    pdf(x: number, a: number, b: number): number;
  }
  interface Dist1 {
    cdf(x: number, a: number): number;
    inv(p: number, a: number): number;
    pdf(x: number, a: number): number;
  }
  interface Tukey {
    cdf(q: number, nmeans: number, df: number): number;
    inv(p: number, nmeans: number, df: number): number;
  }
  export const jStat: {
    normal: Dist2;
    studentt: Dist1;
    centralF: Dist2;
    chisquare: Dist1;
    tukey: Tukey;
    ibeta(x: number, a: number, b: number): number;
    gammaln(x: number): number;
  };
}
