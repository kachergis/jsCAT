import { MultidimensionalCat } from '../multidimensional-cat';
import { checkMultidimensionalStopping } from '../stopping';
import { multidimensionalItemResponseFunction } from '../multidimensional-utils';
import { MultidimensionalStimulus, MultidimensionalZeta } from '../type';

describe('MultidimensionalCat constructor', () => {
  it('defaults to method=map, itemSelect=drule, and a zero theta vector', () => {
    const cat = new MultidimensionalCat({ nDims: 3 });
    expect(cat.method).toBe('map');
    expect(cat.itemSelect).toBe('drule');
    expect(cat.startSelect).toBe('drule');
    expect(cat.theta).toEqual([0, 0, 0]);
    expect(cat.nItems).toBe(0);
  });

  it('throws if nDims is less than 2', () => {
    expect(() => new MultidimensionalCat({ nDims: 1 })).toThrow();
    expect(() => new MultidimensionalCat({ nDims: 0 })).toThrow();
  });

  it('throws if nDims is not an integer', () => {
    expect(() => new MultidimensionalCat({ nDims: 2.5 })).toThrow();
  });

  it('throws if the initial theta vector length does not match nDims', () => {
    expect(() => new MultidimensionalCat({ nDims: 2, theta: [0, 0, 0] })).toThrow();
  });

  it('throws if priorMean length does not match nDims', () => {
    expect(() => new MultidimensionalCat({ nDims: 2, priorMean: [0] })).toThrow();
  });

  it('throws if priorCovariance is singular', () => {
    expect(
      () =>
        new MultidimensionalCat({
          nDims: 2,
          priorCovariance: [
            [1, 1],
            [1, 1],
          ],
        }),
    ).toThrow();
  });

  it('throws for an invalid method or itemSelect', () => {
    expect(() => new MultidimensionalCat({ nDims: 2, method: 'staircase' })).toThrow();
    expect(() => new MultidimensionalCat({ nDims: 2, itemSelect: 'mfi' })).toThrow();
  });

  it('accepts method="eap"', () => {
    const cat = new MultidimensionalCat({ nDims: 2, method: 'eap' });
    expect(cat.method).toBe('eap');
  });

  it('defaults minTheta/maxTheta to -6/6 on every dimension', () => {
    const cat = new MultidimensionalCat({ nDims: 3 });
    expect(cat.minTheta).toEqual([-6, -6, -6]);
    expect(cat.maxTheta).toEqual([6, 6, 6]);
  });

  it('applies a scalar minTheta/maxTheta to every dimension', () => {
    const cat = new MultidimensionalCat({ nDims: 3, minTheta: -3, maxTheta: 3 });
    expect(cat.minTheta).toEqual([-3, -3, -3]);
    expect(cat.maxTheta).toEqual([3, 3, 3]);
  });

  it('accepts an array of per-dimension minTheta/maxTheta bounds', () => {
    const cat = new MultidimensionalCat({ nDims: 3, minTheta: [-1, -2, -3], maxTheta: [1, 2, 3] });
    expect(cat.minTheta).toEqual([-1, -2, -3]);
    expect(cat.maxTheta).toEqual([1, 2, 3]);
  });

  it('throws if a per-dimension minTheta/maxTheta array has the wrong length', () => {
    expect(() => new MultidimensionalCat({ nDims: 3, minTheta: [-1, -2] })).toThrow();
    expect(() => new MultidimensionalCat({ nDims: 3, maxTheta: [1, 2, 3, 4] })).toThrow();
  });

  it('throws if minTheta is not less than maxTheta on every dimension', () => {
    expect(() => new MultidimensionalCat({ nDims: 2, minTheta: [1, -1], maxTheta: [2, -2] })).toThrow();
    expect(() => new MultidimensionalCat({ nDims: 2, minTheta: 3, maxTheta: 3 })).toThrow();
  });

  it('accepts a custom starting theta and prior', () => {
    const cat = new MultidimensionalCat({
      nDims: 2,
      theta: [0.5, -0.5],
      priorMean: [0.1, 0.2],
    });
    expect(cat.theta).toEqual([0.5, -0.5]);
    expect(cat.priorMean).toEqual([0.1, 0.2]);
  });

  it('exposes the prior precision (inverse of the prior covariance)', () => {
    const cat = new MultidimensionalCat({
      nDims: 2,
      priorCovariance: [
        [1, 0],
        [0, 4],
      ],
    });
    expect(cat.priorPrecision).toEqual([
      [1, 0],
      [0, 0.25],
    ]);
  });
});

describe('updateAbilityEstimate', () => {
  it('accumulates zetas and responses', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    cat.updateAbilityEstimate({ a: [1.5, 0], d: 0.2 }, 1);
    cat.updateAbilityEstimate({ a: [0, 1.2], d: -0.1 }, 0);
    expect(cat.nItems).toBe(2);
    expect(cat.resps).toEqual([1, 0]);
    expect(cat.zetas).toEqual([
      { a: [1.5, 0], d: 0.2 },
      { a: [0, 1.2], d: -0.1 },
    ]);
  });

  it('throws if zeta and answer arrays have different lengths', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    expect(() => cat.updateAbilityEstimate([{ a: [1, 0] }, { a: [0, 1] }], [1])).toThrow();
  });

  it('throws if a zeta has the wrong dimensionality', () => {
    const cat = new MultidimensionalCat({ nDims: 3 });
    expect(() => cat.updateAbilityEstimate({ a: [1, 0] }, 1)).toThrow();
  });

  it('clamps theta to [minTheta, maxTheta] on every dimension', () => {
    const cat = new MultidimensionalCat({ nDims: 2, minTheta: -2, maxTheta: 2 });
    // A long run of very easy, highly discriminating correct answers pushes theta up against the ceiling
    const items: MultidimensionalZeta[] = Array.from({ length: 15 }, () => ({ a: [3, 3], d: 5 }));
    cat.updateAbilityEstimate(items, items.map(() => 1 as const));
    expect(cat.theta[0]).toBeLessThanOrEqual(2);
    expect(cat.theta[1]).toBeLessThanOrEqual(2);
  });

  it('clamps each dimension to its own bound when given per-dimension minTheta/maxTheta', () => {
    // Items alternate which single dimension they load on (d=0, so each is genuinely informative
    // rather than already-near-certain), so each dimension's evidence is independent. With no
    // bounds, 20 such items with all-correct answers push both dimensions to ~1.09 (verified
    // separately); a maxTheta of 0.5 on dimension 0 only should clamp dimension 0 there while
    // leaving dimension 1 free to reach its own (higher, unclamped) MAP estimate.
    const cat = new MultidimensionalCat({ nDims: 2, minTheta: [-6, -6], maxTheta: [0.5, 6] });
    const items: MultidimensionalZeta[] = Array.from({ length: 20 }, (_, i) => ({
      a: i % 2 === 0 ? [3, 0] : [0, 3],
      d: 0,
    }));
    cat.updateAbilityEstimate(items, items.map(() => 1 as const));
    expect(cat.theta[0]).toBeCloseTo(0.5, 6);
    expect(cat.theta[1]).toBeGreaterThan(0.5); // dimension 1's ceiling (6) shouldn't constrain it the same way
  });

  it('coerces string-valued zeta parameters to numbers', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cat.updateAbilityEstimate({ a: ['1.5', '0'] as any, d: '0.1' as any }, 1);
    expect(cat.zetas[0]).toEqual({ a: [1.5, 0], d: 0.1 });
  });
});

describe('estimateAbilityMAP', () => {
  it('finds the posterior mode, verified against an independent grid search', () => {
    const cat = new MultidimensionalCat({ nDims: 2, randomSeed: 'map-test' });
    const items: MultidimensionalZeta[] = [
      { a: [1.8, 0], d: 0.3 },
      { a: [0, 1.5], d: -0.2 },
      { a: [1.2, 1.0], d: 0.1 },
      { a: [2.0, 0.5], d: -0.4 },
    ];
    const answers: (0 | 1)[] = [1, 0, 1, 1];
    cat.updateAbilityEstimate(items, answers);

    // Brute-force grid search over the posterior, independent of the library's own optimizer,
    // assuming the same N(0, I) default prior.
    let bestTheta = [0, 0];
    let bestLogPosterior = -Infinity;
    for (let t0 = -4; t0 <= 4; t0 += 0.05) {
      for (let t1 = -4; t1 <= 4; t1 += 0.05) {
        const logLik = items.reduce((acc, zeta, i) => {
          const p = multidimensionalItemResponseFunction([t0, t1], zeta);
          return acc + (answers[i] === 1 ? Math.log(p) : Math.log(1 - p));
        }, 0);
        const logPrior = -0.5 * (t0 * t0 + t1 * t1);
        const logPosterior = logLik + logPrior;
        if (logPosterior > bestLogPosterior) {
          bestLogPosterior = logPosterior;
          bestTheta = [t0, t1];
        }
      }
    }

    expect(cat.theta[0]).toBeCloseTo(bestTheta[0], 0);
    expect(cat.theta[1]).toBeCloseTo(bestTheta[1], 0);
  });

  it('moves theta toward the dimension(s) an item loads on, in the direction of the response', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    cat.updateAbilityEstimate({ a: [2, 0], d: 0 }, 1);
    expect(cat.theta[0]).toBeGreaterThan(0);
    expect(cat.theta[1]).toBeCloseTo(0, 6); // no information on dimension 1 -> stays at the prior mean
  });
});

describe('estimateAbilityMLE', () => {
  it('is available as an alternative to MAP', () => {
    const cat = new MultidimensionalCat({ nDims: 2, method: 'mle' });
    cat.updateAbilityEstimate(
      [
        { a: [1.5, 0], d: 0 },
        { a: [0, 1.5], d: 0 },
      ],
      [1, 0],
    );
    expect(cat.theta[0]).toBeGreaterThan(0);
    expect(cat.theta[1]).toBeLessThan(0);
  });
});

describe('estimateAbilityEAP', () => {
  it('computes the posterior mean and SD, verified against an independent finer grid', () => {
    const cat = new MultidimensionalCat({ nDims: 2, method: 'eap', randomSeed: 'eap-test' });
    const items: MultidimensionalZeta[] = [
      { a: [1.8, 0], d: 0.3 },
      { a: [0, 1.5], d: -0.2 },
      { a: [1.2, 1.0], d: 0.1 },
      { a: [2.0, 0.5], d: -0.4 },
    ];
    const answers: (0 | 1)[] = [1, 0, 1, 1];
    cat.updateAbilityEstimate(items, answers);

    // Independent (finer, separately implemented) grid computation of the same
    // posterior mean/SD under the default N(0, I) prior, truncated to [-6, 6].
    const step = 0.05;
    let sumW = 0;
    let sumT0 = 0;
    let sumT1 = 0;
    const grid: { t0: number; t1: number; w: number }[] = [];
    for (let t0 = -6; t0 <= 6; t0 += step) {
      for (let t1 = -6; t1 <= 6; t1 += step) {
        const logLik = items.reduce((acc, zeta, i) => {
          const p = multidimensionalItemResponseFunction([t0, t1], zeta);
          return acc + (answers[i] === 1 ? Math.log(p) : Math.log(1 - p));
        }, 0);
        const logPrior = -0.5 * (t0 * t0 + t1 * t1);
        const w = Math.exp(logLik + logPrior);
        grid.push({ t0, t1, w });
        sumW += w;
        sumT0 += t0 * w;
        sumT1 += t1 * w;
      }
    }
    const meanT0 = sumT0 / sumW;
    const meanT1 = sumT1 / sumW;
    const varT0 = grid.reduce((acc, g) => acc + Math.pow(g.t0 - meanT0, 2) * g.w, 0) / sumW;
    const varT1 = grid.reduce((acc, g) => acc + Math.pow(g.t1 - meanT1, 2) * g.w, 0) / sumW;

    expect(cat.theta[0]).toBeCloseTo(meanT0, 1);
    expect(cat.theta[1]).toBeCloseTo(meanT1, 1);
    expect(cat.seMeasurement[0]).toBeCloseTo(Math.sqrt(varT0), 1);
    expect(cat.seMeasurement[1]).toBeCloseTo(Math.sqrt(varT1), 1);
  });

  it('equals the prior mean and SD before any items are administered', () => {
    const cat = new MultidimensionalCat({ nDims: 2, method: 'eap' });
    cat.updateAbilityEstimate([], []);
    expect(cat.theta[0]).toBeCloseTo(0, 1);
    expect(cat.theta[1]).toBeCloseTo(0, 1);
    expect(cat.seMeasurement[0]).toBeCloseTo(1, 1);
    expect(cat.seMeasurement[1]).toBeCloseTo(1, 1);
  });

  it('moves theta toward the dimension(s) an item loads on, in the direction of the response', () => {
    const cat = new MultidimensionalCat({ nDims: 2, method: 'eap' });
    cat.updateAbilityEstimate({ a: [2, 0], d: 0 }, 1);
    expect(cat.theta[0]).toBeGreaterThan(0);
    expect(cat.theta[1]).toBeCloseTo(0, 1); // no information on dimension 1 -> stays at the prior mean
  });

  it('respects a custom quadPoints setting', () => {
    const cat = new MultidimensionalCat({ nDims: 2, method: 'eap', quadPoints: 11 });
    expect(cat.quadPoints).toBe(11);
    cat.updateAbilityEstimate({ a: [2, 0], d: 0 }, 1);
    expect(cat.theta[0]).toBeGreaterThan(0);
  });

  it('throws for an invalid quadPoints', () => {
    expect(() => new MultidimensionalCat({ nDims: 2, quadPoints: 1 })).toThrow();
    expect(() => new MultidimensionalCat({ nDims: 2, quadPoints: 4.5 })).toThrow();
  });

  it('defaults quadPoints so the total grid size stays roughly constant across nDims', () => {
    const cat2 = new MultidimensionalCat({ nDims: 2 });
    const cat3 = new MultidimensionalCat({ nDims: 3 });
    expect(cat2.quadPoints).toBeGreaterThan(cat3.quadPoints);
    expect(Math.pow(cat2.quadPoints, 2)).toBeGreaterThan(1000);
    expect(Math.pow(cat3.quadPoints, 3)).toBeGreaterThan(1000);
  });
});

describe('seMeasurement', () => {
  it('starts at Number.MAX_VALUE before any items are administered', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    expect(cat.seMeasurement).toEqual([Number.MAX_VALUE, Number.MAX_VALUE]);
  });

  it('decreases on a dimension as more items loading on it are administered', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    cat.updateAbilityEstimate({ a: [1.5, 0], d: 0 }, 1);
    const seAfterOne = cat.seMeasurement[0];
    expect(seAfterOne).toBeLessThan(1); // prior-only se would be 1 (prior covariance = identity)

    cat.updateAbilityEstimate({ a: [1.5, 0], d: 0 }, 0);
    const seAfterTwo = cat.seMeasurement[0];
    expect(seAfterTwo).toBeLessThan(seAfterOne);
  });

  it('leaves a dimension at prior-only precision if no administered item loads on it', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    cat.updateAbilityEstimate(
      [
        { a: [1.5, 0], d: 0 },
        { a: [2, 0], d: 0.2 },
      ],
      [1, 1],
    );
    expect(cat.seMeasurement[1]).toBeCloseTo(1, 6);
  });
});

describe('findNextItem (Drule)', () => {
  it('selects the item that maximizes the determinant of the resulting information matrix', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    const itemA: MultidimensionalStimulus = { a: [2, 0], d: 0, word: 'A' };
    const itemB: MultidimensionalStimulus = { a: [0, 2], d: 0, word: 'B' };
    const itemC: MultidimensionalStimulus = { a: [1.5, 1.5], d: 0, word: 'C' };
    const itemD: MultidimensionalStimulus = { a: [3, 3], d: 0, word: 'D' };

    // Hand-derived determinants at theta=[0,0] with identity prior precision:
    //   A, B -> det([[2,0],[0,1]]) = det([[1,0],[0,2]]) = 2
    //   C    -> det([[1.5625, 0.5625],[0.5625, 1.5625]]) = 2.125
    //   D    -> det([[3.25, 2.25],[2.25, 3.25]]) = 5.5
    const { nextStimulus, remainingStimuli } = cat.findNextItem([itemA, itemB, itemC, itemD]);

    expect(nextStimulus?.word).toBe('D');
    expect(remainingStimuli.map((s) => s.word)).toEqual(['C', 'A', 'B']);
  });

  it('is well-defined for the very first item selection (relies on prior precision, not administered items)', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    expect(cat.nItems).toBe(0);
    const { nextStimulus } = cat.findNextItem([
      { a: [1, 0], d: 0 },
      { a: [0, 1], d: 0 },
    ]);
    expect(nextStimulus).toBeDefined();
  });

  it('throws if a candidate stimulus has the wrong dimensionality', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    expect(() => cat.findNextItem([{ a: [1, 0, 0] }])).toThrow();
  });

  it('supports deepCopy=false, returning the same stimulus objects rather than clones', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    const itemA: MultidimensionalStimulus = { a: [3, 3], d: 0, word: 'A' };
    const itemB: MultidimensionalStimulus = { a: [1, 0], d: 0, word: 'B' };
    const pool = [itemA, itemB];
    const { nextStimulus, remainingStimuli } = cat.findNextItem(pool, undefined, false);
    expect(nextStimulus).toBe(itemA); // same object reference, not a deep clone
    expect(remainingStimuli[0]).toBe(itemB);
  });

  it('returns an undefined nextStimulus for an empty stimulus array', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    const { nextStimulus, remainingStimuli } = cat.findNextItem([]);
    expect(nextStimulus).toBeUndefined();
    expect(remainingStimuli).toEqual([]);
  });
});

describe('findNextItem (Wrule)', () => {
  const itemA: MultidimensionalStimulus = { a: [2, 0], d: 0, word: 'A' };
  const itemB: MultidimensionalStimulus = { a: [0, 2], d: 0, word: 'B' };
  const itemC: MultidimensionalStimulus = { a: [1.5, 1.5], d: 0, word: 'C' };

  it('selects the item that maximizes weights^T * infoMatrix * weights', () => {
    const cat = new MultidimensionalCat({ nDims: 2, itemSelect: 'wrule' });
    // Hand-derived at theta=[0,0] with identity prior precision and default weights=[1,1]:
    //   A -> M=[[2,0],[0,1]]         -> w^T M w = 3
    //   B -> M=[[1,0],[0,2]]         -> w^T M w = 3
    //   C -> M=[[1.5625,0.5625],[0.5625,1.5625]] -> w^T M w = 4.25
    const { nextStimulus } = cat.findNextItem([itemA, itemB, itemC]);
    expect(nextStimulus?.word).toBe('C');
  });

  it('excludes a dimension entirely when its weight is 0', () => {
    const cat = new MultidimensionalCat({ nDims: 2, itemSelect: 'wrule', weights: [0, 1] });
    // With weights=[0,1] (only dimension 1 counts): A -> 1, B -> 2, C -> 1.5625
    const { nextStimulus } = cat.findNextItem([itemA, itemB, itemC]);
    expect(nextStimulus?.word).toBe('B');
  });

  it('defaults weights to a vector of ones', () => {
    const cat = new MultidimensionalCat({ nDims: 3 });
    expect(cat.weights).toEqual([1, 1, 1]);
  });

  it('throws if weights has the wrong length', () => {
    expect(() => new MultidimensionalCat({ nDims: 2, weights: [1] })).toThrow();
  });
});

describe('findNextItem (KL)', () => {
  const klScore = (klDelta: number, zeta: MultidimensionalZeta) => {
    const p1 = multidimensionalItemResponseFunction([klDelta, klDelta], zeta);
    const p0 = multidimensionalItemResponseFunction([-klDelta, -klDelta], zeta);
    return p1 * Math.log(p1 / p0) + (1 - p1) * Math.log((1 - p1) / (1 - p0));
  };

  it('selects the item with the largest pointwise KL divergence around theta', () => {
    const cat = new MultidimensionalCat({ nDims: 2, itemSelect: 'kl' });
    const steepItem: MultidimensionalStimulus = { a: [3, 0], d: 0, word: 'steep' };
    const flatItem: MultidimensionalStimulus = { a: [0.1, 0], d: 0, word: 'flat' };

    expect(klScore(cat.klDelta, steepItem)).toBeGreaterThan(klScore(cat.klDelta, flatItem));

    const { nextStimulus } = cat.findNextItem([flatItem, steepItem]);
    expect(nextStimulus?.word).toBe('steep');
  });

  it('defaults klDelta to 0.1', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    expect(cat.klDelta).toBe(0.1);
  });

  it('respects a custom klDelta', () => {
    const cat = new MultidimensionalCat({ nDims: 2, itemSelect: 'kl', klDelta: 1.5 });
    expect(cat.klDelta).toBe(1.5);
  });

  it('throws for a non-positive klDelta', () => {
    expect(() => new MultidimensionalCat({ nDims: 2, klDelta: 0 })).toThrow();
    expect(() => new MultidimensionalCat({ nDims: 2, klDelta: -0.1 })).toThrow();
  });
});

describe('findNextItem (random)', () => {
  it('selects an item via the seeded RNG and removes it from remainingStimuli', () => {
    const cat = new MultidimensionalCat({ nDims: 2, itemSelect: 'random', randomSeed: 'test-seed' });
    const items: MultidimensionalStimulus[] = Array.from({ length: 5 }, (_, i) => ({
      a: [1, 1],
      d: 0,
      word: `item-${i}`,
    }));
    const { nextStimulus, remainingStimuli } = cat.findNextItem(items);
    expect(items.map((s) => s.word)).toContain(nextStimulus?.word);
    expect(remainingStimuli.length).toBe(4);
    expect(remainingStimuli.map((s) => s.word)).not.toContain(nextStimulus?.word);
  });
});

describe('nStartItems / startSelect', () => {
  it('uses startSelect for the first nStartItems selections, then falls back to itemSelect', () => {
    const cat = new MultidimensionalCat({
      nDims: 2,
      itemSelect: 'drule',
      startSelect: 'random',
      nStartItems: 2,
      randomSeed: 'start-select-test',
    });
    const pool: MultidimensionalStimulus[] = Array.from({ length: 6 }, (_, i) => ({
      a: [1, 1],
      d: 0,
      word: `item-${i}`,
    }));

    // First two selections happen while nItems < nStartItems (still 0, since we haven't updated ability yet)
    const first = cat.findNextItem(pool);
    expect(first.nextStimulus).toBeDefined();

    cat.updateAbilityEstimate({ a: [1, 1], d: 0 }, 1);
    expect(cat.nItems).toBe(1);
    const second = cat.findNextItem(first.remainingStimuli);
    expect(second.nextStimulus).toBeDefined();

    cat.updateAbilityEstimate({ a: [1, 1], d: 0 }, 0);
    expect(cat.nItems).toBe(2);
    // Now nItems (2) >= nStartItems (2), so this should use the (deterministic) Drule selector
    const third = cat.findNextItem(second.remainingStimuli);
    expect(third.nextStimulus).toBeDefined();
  });
});

describe('checkMultidimensionalStopping', () => {
  it('stops once maxItems is reached, regardless of measurement precision', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    for (let i = 0; i < 5; i++) {
      cat.updateAbilityEstimate({ a: [1, 1], d: 0 }, 1);
    }
    expect(checkMultidimensionalStopping(cat, { maxItems: 5 })).toEqual({
      stop: true,
      reason: 'Reached maxItems',
    });
  });

  it('does not stop before minItems, even if minSEM would already be satisfied', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    for (let i = 0; i < 3; i++) {
      cat.updateAbilityEstimate({ a: [5, 5], d: 0 }, (i % 2) as 0 | 1);
    }
    const result = checkMultidimensionalStopping(cat, { minItems: 10, maxItems: 20, minSEM: [0.9, 0.9] });
    expect(result.stop).toBe(false);
  });

  it('stops once minItems is reached and every dimension is at or below its minSEM threshold', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    for (let i = 0; i < 8; i++) {
      cat.updateAbilityEstimate({ a: [5, 5], d: 0 }, (i % 2) as 0 | 1);
    }
    const result = checkMultidimensionalStopping(cat, { minItems: 3, maxItems: 20, minSEM: [0.9, 0.9] });
    expect(result.stop).toBe(true);
    expect(result.reason).toBe('All dimensions reached minSEM threshold');
  });

  it('throws if minSEM length does not match nDims', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    expect(() => checkMultidimensionalStopping(cat, { maxItems: 10, minSEM: [0.5] })).toThrow();
  });

  it('does not stop if minItems is reached but not every dimension meets minSEM', () => {
    const cat = new MultidimensionalCat({ nDims: 2 });
    // Only dimension 0 gets informative items -- dimension 1 stays at prior-only precision (se=1)
    for (let i = 0; i < 5; i++) {
      cat.updateAbilityEstimate({ a: [5, 0], d: 0 }, (i % 2) as 0 | 1);
    }
    const result = checkMultidimensionalStopping(cat, { minItems: 3, maxItems: 20, minSEM: [0.1, 0.1] });
    expect(result).toEqual({ stop: false, reason: null });
  });
});
