import { Matrix, dot, outerProduct, scaleMatrix } from './matrix';
import { MultidimensionalZeta } from './type';

/**
 * Fill in default values (d=0, g=0, u=1) for any missing optional keys of a
 * multidimensional zeta object. `a` has no default since its length defines
 * the dimensionality of the item.
 */
export const fillMultidimensionalZetaDefaults = (zeta: MultidimensionalZeta): Required<MultidimensionalZeta> => ({
  a: zeta.a,
  d: zeta.d ?? 0,
  g: zeta.g ?? 0,
  u: zeta.u ?? 1,
});

/**
 * Converts multidimensional zeta parameter values to numbers, ensuring they
 * are not strings. Mirrors `ensureZetaNumericValues` in corpus.ts for the
 * unidimensional case. Filters out undefined, null, empty, 'NA', and
 * non-finite values for the optional (d, g, u) keys.
 *
 * @param {MultidimensionalZeta} zeta - The zeta parameters to convert.
 * @returns {MultidimensionalZeta} A new zeta object with numeric values.
 */
export const ensureMultidimensionalZetaNumericValues = (zeta: MultidimensionalZeta): MultidimensionalZeta => {
  if (!Array.isArray(zeta.a)) {
    throw new Error(`Expected zeta.a to be an array of discrimination values. Received ${JSON.stringify(zeta.a)}.`);
  }

  const a = zeta.a.map((value) => Number(value));
  if (a.some((value) => !Number.isFinite(value))) {
    throw new Error(
      `All values in the discrimination vector "a" must be finite numbers. Received ${JSON.stringify(zeta.a)}.`,
    );
  }

  const result: MultidimensionalZeta = { a };

  (['d', 'g', 'u'] as const).forEach((key) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = zeta[key] as any;
    if (value !== undefined && value !== null && value !== '' && String(value).toUpperCase() !== 'NA') {
      const numValue = Number(value);
      if (Number.isFinite(numValue)) {
        result[key] = numValue;
      }
    }
  });

  return result;
};

/**
 * Validates multidimensional zeta parameters against the number of latent
 * dimensions a Cat is estimating.
 *
 * @param {MultidimensionalZeta} zeta - The zeta parameters to validate.
 * @param {number} nDims - The expected length of the discrimination vector.
 *
 * @throws {Error} Will throw if `a` is missing, has the wrong length, or if
 *   the guessing parameter is not less than the upper asymptote.
 */
export const validateMultidimensionalZeta = (zeta: MultidimensionalZeta, nDims: number): void => {
  if (!Array.isArray(zeta.a)) {
    throw new Error(`Expected zeta.a to be an array of length ${nDims}. Received ${JSON.stringify(zeta.a)}.`);
  }
  if (zeta.a.length !== nDims) {
    throw new Error(`Expected zeta.a to have length ${nDims} (nDims). Received length ${zeta.a.length}.`);
  }
  if (zeta.g !== undefined && zeta.u !== undefined && zeta.g >= zeta.u) {
    throw new Error(
      `Expected the guessing parameter g to be less than the upper asymptote u. Received g=${zeta.g}, u=${zeta.u}.`,
    );
  }
};

/**
 * Calculates the probability that someone with a given multidimensional
 * ability vector theta will answer an item correctly, under a compensatory
 * multidimensional 3PL/4PL model: P(theta) = g + (u - g) / (1 + exp(-(a . theta + d))).
 *
 * @param {number[]} theta - ability estimate vector
 * @param {MultidimensionalZeta} zeta - item params
 * @returns {number} the probability
 */
export const multidimensionalItemResponseFunction = (theta: number[], zeta: MultidimensionalZeta): number => {
  const { a, d, g, u } = fillMultidimensionalZetaDefaults(zeta);
  const linearPredictor = dot(a, theta) + d;
  const sigma = 1 / (1 + Math.exp(-linearPredictor));
  return g + (u - g) * sigma;
};

/**
 * The multidimensional Fisher information matrix for a single item at a
 * given ability vector theta, under the compensatory model above. For the
 * compensatory model the gradient of P with respect to theta is a scalar
 * multiple of the discrimination vector `a`, so the information matrix is a
 * scalar multiple of the rank-1 outer product a * a^T. This reduces exactly
 * to the unidimensional 3PL Fisher information (utils.ts) when nDims=1.
 *
 * @param {number[]} theta - ability estimate vector
 * @param {MultidimensionalZeta} zeta - item params
 * @returns {Matrix} the information matrix contributed by this item
 */
export const multidimensionalFisherInformation = (theta: number[], zeta: MultidimensionalZeta): Matrix => {
  const { a, d, g, u } = fillMultidimensionalZetaDefaults(zeta);
  const linearPredictor = dot(a, theta) + d;
  const sigma = 1 / (1 + Math.exp(-linearPredictor));
  const p = g + (u - g) * sigma;

  const epsilon = 1e-12;
  const pClamped = Math.min(Math.max(p, epsilon), 1 - epsilon);
  const qClamped = 1 - pClamped;

  const scalarFactor = (Math.pow(u - g, 2) * Math.pow(sigma * (1 - sigma), 2)) / (pClamped * qClamped);
  return scaleMatrix(outerProduct(a, a), scalarFactor);
};
