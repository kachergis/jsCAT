import {
  ensureMultidimensionalZetaNumericValues,
  multidimensionalFisherInformation,
  multidimensionalItemResponseFunction,
  validateMultidimensionalZeta,
} from '../multidimensional-utils';
import { fisherInformation, itemResponseFunction } from '../utils';

describe('multidimensionalItemResponseFunction', () => {
  it('matches the unidimensional item response function when nDims=1', () => {
    const theta = 0.7;
    const a = 1.3;
    const b = -0.4;
    const c = 0.15;
    const d = 0.95;

    const p1D = itemResponseFunction(theta, { a, b, c, d });
    // The unidimensional model is a . (theta - b) = a . theta + (-a . b); c/d become g/u.
    const pMulti = multidimensionalItemResponseFunction([theta], { a: [a], d: -a * b, g: c, u: d });

    expect(pMulti).toBeCloseTo(p1D, 10);
  });

  it('defaults to a standard 2PL-like item (g=0, u=1) when only a and d are given', () => {
    const p = multidimensionalItemResponseFunction([0, 0], { a: [1, 1], d: 0 });
    expect(p).toBeCloseTo(0.5, 10);
  });

  it('is monotonically increasing in each dimension the item loads on', () => {
    const zeta = { a: [1.5, 0.8], d: 0 };
    const pLow = multidimensionalItemResponseFunction([-1, -1], zeta);
    const pHigh = multidimensionalItemResponseFunction([1, 1], zeta);
    expect(pHigh).toBeGreaterThan(pLow);
  });

  it('is unaffected by a dimension the item does not load on (a=0)', () => {
    const zeta = { a: [1.2, 0], d: 0.3 };
    const p1 = multidimensionalItemResponseFunction([0.5, -3], zeta);
    const p2 = multidimensionalItemResponseFunction([0.5, 8], zeta);
    expect(p1).toBeCloseTo(p2, 10);
  });

  it('respects custom guessing (g) and upper asymptote (u) bounds', () => {
    const zeta = { a: [1, 1], d: -100, g: 0.25, u: 0.9 };
    const pFloor = multidimensionalItemResponseFunction([-10, -10], zeta);
    expect(pFloor).toBeCloseTo(0.25, 6);

    const zetaCeil = { a: [1, 1], d: 100, g: 0.25, u: 0.9 };
    const pCeil = multidimensionalItemResponseFunction([10, 10], zetaCeil);
    expect(pCeil).toBeCloseTo(0.9, 6);
  });
});

describe('multidimensionalFisherInformation', () => {
  it('matches the unidimensional Fisher information when nDims=1', () => {
    // Note: jsCAT's unidimensional fisherInformation (utils.ts) uses the
    // standard 3PL formula a^2(q/p)(p-c)^2/(1-c)^2, which is only exact when
    // the upper asymptote is 1 (i.e. symbolic `d`/semantic `slipping` = 1,
    // no slipping). The multidimensional formula generalizes it correctly to
    // any upper asymptote (`u`), so the two are compared here in the regime
    // where the unidimensional formula is exact.
    const theta = 0.7;
    const a = 1.3;
    const b = -0.4;
    const c = 0.15;
    const d = 1;

    const info1D = fisherInformation(theta, { a, b, c, d });
    const infoMatrix = multidimensionalFisherInformation([theta], { a: [a], d: -a * b, g: c, u: 1 });

    expect(infoMatrix.length).toBe(1);
    expect(infoMatrix[0].length).toBe(1);
    expect(infoMatrix[0][0]).toBeCloseTo(info1D, 8);
  });

  it('produces a rank-1 (zero determinant) matrix for a 2+ dimensional item', () => {
    const infoMatrix = multidimensionalFisherInformation([0.2, -0.3], { a: [1.4, 0.9], d: 0.1 });
    const det = infoMatrix[0][0] * infoMatrix[1][1] - infoMatrix[0][1] * infoMatrix[1][0];
    expect(det).toBeCloseTo(0, 8);
  });

  it('is zero for dimensions the item does not load on', () => {
    const infoMatrix = multidimensionalFisherInformation([0.2, -0.3], { a: [1.4, 0], d: 0.1 });
    expect(infoMatrix[0][1]).toBeCloseTo(0, 10);
    expect(infoMatrix[1][0]).toBeCloseTo(0, 10);
    expect(infoMatrix[1][1]).toBeCloseTo(0, 10);
    expect(infoMatrix[0][0]).toBeGreaterThan(0);
  });

  it('is symmetric', () => {
    const infoMatrix = multidimensionalFisherInformation([0.4, 0.1, -0.6], { a: [1.1, 0.7, 1.3], d: -0.2 });
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(infoMatrix[i][j]).toBeCloseTo(infoMatrix[j][i], 10);
      }
    }
  });
});

describe('ensureMultidimensionalZetaNumericValues', () => {
  it('converts string values to numbers', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zeta = { a: ['1.5', '0'] as any, d: '0.2' as any, g: '0.1' as any };
    const result = ensureMultidimensionalZetaNumericValues(zeta);
    expect(result).toEqual({ a: [1.5, 0], d: 0.2, g: 0.1 });
  });

  it('omits NA/empty/undefined optional values instead of coercing them to numbers', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zeta = { a: [1, 0], d: 'NA' as any, g: '' as any, u: undefined };
    const result = ensureMultidimensionalZetaNumericValues(zeta);
    expect(result).toEqual({ a: [1, 0] });
  });

  it('throws if any value in a is not a finite number', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => ensureMultidimensionalZetaNumericValues({ a: [1, 'oops'] as any })).toThrow();
  });

  it('throws if a is not an array', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => ensureMultidimensionalZetaNumericValues({ a: 1.5 as any })).toThrow();
  });
});

describe('validateMultidimensionalZeta', () => {
  it('throws if a is not an array', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => validateMultidimensionalZeta({ a: 1.5 as any }, 1)).toThrow();
  });

  it('throws if a has the wrong length for nDims', () => {
    expect(() => validateMultidimensionalZeta({ a: [1, 2] }, 3)).toThrow();
  });

  it('does not throw for a correctly-shaped zeta', () => {
    expect(() => validateMultidimensionalZeta({ a: [1, 2, 3] }, 3)).not.toThrow();
  });

  it('throws if guessing (g) is not less than the upper asymptote (u)', () => {
    expect(() => validateMultidimensionalZeta({ a: [1], g: 0.5, u: 0.5 }, 1)).toThrow();
    expect(() => validateMultidimensionalZeta({ a: [1], g: 0.6, u: 0.5 }, 1)).toThrow();
  });

  it('does not throw when g < u', () => {
    expect(() => validateMultidimensionalZeta({ a: [1], g: 0.2, u: 0.9 }, 1)).not.toThrow();
  });
});
