/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { minimize_Powell } from 'optimization-js';
import { Matrix, addMatrix, determinant, dot, identity, inverse } from './matrix';
import {
  ensureMultidimensionalZetaNumericValues,
  multidimensionalFisherInformation,
  multidimensionalItemResponseFunction,
  validateMultidimensionalZeta,
} from './multidimensional-utils';
import { MultidimensionalStimulus, MultidimensionalZeta } from './type';
import seedrandom from 'seedrandom';
import _clamp from 'lodash/clamp';
import _cloneDeep from 'lodash/cloneDeep';

export interface MultidimensionalCatInput {
  nDims: number;
  method?: string;
  itemSelect?: string;
  nStartItems?: number;
  startSelect?: string;
  theta?: number[];
  minTheta?: number | number[];
  maxTheta?: number | number[];
  priorMean?: number[];
  priorCovariance?: Matrix;
  randomSeed?: string | null;
}

/**
 * A Cat that estimates a vector of latent abilities (theta) jointly from a
 * compensatory multidimensional IRT model, e.g. a bifactor model with a
 * general factor and several specific factors. This is distinct from
 * `Clowder`, which runs several independent *unidimensional* Cats in
 * parallel: here a single item can inform multiple dimensions at once (e.g.
 * an item that loads on both a general and a specific factor), and item
 * selection accounts for the full information matrix rather than one
 * dimension at a time.
 *
 * Item parameters follow mirt's own convention (see MultidimensionalZeta),
 * so item banks fit with mirt/mirtCAT in R can be used directly.
 */
export class MultidimensionalCat {
  public readonly nDims: number;
  public method: string;
  public itemSelect: string;
  public nStartItems: number;
  public startSelect: string;
  public minTheta: number[];
  public maxTheta: number[];
  private readonly _priorMean: number[];
  private readonly _priorPrecision: Matrix;
  private readonly _zetas: MultidimensionalZeta[];
  private readonly _resps: (0 | 1)[];
  private _theta: number[];
  private _seMeasurement: number[];
  private readonly _rng: ReturnType<seedrandom>;

  /**
   * Create a MultidimensionalCat object.
   * @param {{nDims: number, method: string, itemSelect: string, nStartItems: number, startSelect: string, theta: number[], minTheta: number, maxTheta: number, priorMean: number[], priorCovariance: Matrix, randomSeed: string | null}} destructuredParam
   *     nDims: the number of latent dimensions to estimate jointly
   *     method: ability estimator, "MAP" or "MLE", default = 'MAP'
   *     itemSelect: the method of item selection, "Drule" or "random", default = 'Drule'
   *     nStartItems: first n trials to keep non-adaptive selection
   *     startSelect: rule to select first n trials, default = itemSelect
   *     theta: initial theta estimate vector, default = a vector of zeros
   *     minTheta: lower bound on theta -- a single number applied to every dimension,
   *       or an array giving a separate lower bound per dimension
   *     maxTheta: upper bound on theta -- a single number applied to every dimension,
   *       or an array giving a separate upper bound per dimension
   *     priorMean: the mean vector of the (multivariate normal) prior, default = zeros
   *     priorCovariance: the covariance matrix of the prior, default = the identity matrix
   *       (i.e. independent, unit-variance dimensions -- the usual assumption for an
   *       orthogonal bifactor model)
   *     randomSeed: set a random seed to trace the simulation
   */
  constructor({
    nDims,
    method = 'MAP',
    itemSelect = 'Drule',
    nStartItems = 0,
    startSelect,
    theta,
    minTheta = -6,
    maxTheta = 6,
    priorMean,
    priorCovariance,
    randomSeed = null,
  }: MultidimensionalCatInput) {
    if (!Number.isInteger(nDims) || nDims < 2) {
      throw new Error(
        `nDims must be an integer of at least 2 (use Cat for a single dimension). Received ${nDims}.`,
      );
    }
    this.nDims = nDims;

    this.method = MultidimensionalCat.validateMethod(method);
    this.itemSelect = MultidimensionalCat.validateItemSelect(itemSelect);
    this.startSelect = MultidimensionalCat.validateItemSelect(startSelect ?? itemSelect);
    this.nStartItems = nStartItems;
    this.minTheta = MultidimensionalCat.normalizeBounds(minTheta, nDims, 'minTheta');
    this.maxTheta = MultidimensionalCat.normalizeBounds(maxTheta, nDims, 'maxTheta');
    this.minTheta.forEach((min, i) => {
      if (min >= this.maxTheta[i]) {
        throw new Error(
          `minTheta must be less than maxTheta on every dimension. On dimension ${i}, received minTheta=${min}, maxTheta=${this.maxTheta[i]}.`,
        );
      }
    });

    this._zetas = [];
    this._resps = [];

    if (theta !== undefined && theta.length !== nDims) {
      throw new Error(`theta must have length nDims (${nDims}). Received length ${theta.length}.`);
    }
    this._theta = theta ? [...theta] : new Array(nDims).fill(0);
    this._seMeasurement = new Array(nDims).fill(Number.MAX_VALUE);

    if (priorMean !== undefined && priorMean.length !== nDims) {
      throw new Error(`priorMean must have length nDims (${nDims}). Received length ${priorMean.length}.`);
    }
    this._priorMean = priorMean ? [...priorMean] : new Array(nDims).fill(0);

    const covariance = priorCovariance ?? identity(nDims);
    const precision = inverse(covariance);
    if (precision === null) {
      throw new Error('priorCovariance must be invertible.');
    }
    this._priorPrecision = precision;

    this._rng = randomSeed === null ? seedrandom() : seedrandom(randomSeed);
  }

  public get theta() {
    return this._theta;
  }

  public get seMeasurement() {
    return this._seMeasurement;
  }

  public get nItems() {
    return this._resps.length;
  }

  public get resps() {
    return this._resps;
  }

  public get zetas() {
    return this._zetas;
  }

  public get priorMean() {
    return this._priorMean;
  }

  public get priorPrecision() {
    return this._priorPrecision;
  }

  /**
   * The cumulative Fisher information matrix: the prior precision plus the
   * information contributed by every item administered so far, evaluated at
   * the current theta estimate.
   */
  public get infoMatrix(): Matrix {
    return this._zetas.reduce(
      (acc, zeta) => addMatrix(acc, multidimensionalFisherInformation(this._theta, zeta)),
      this._priorPrecision,
    );
  }

  private static validateMethod(method: string) {
    const lowerMethod = method.toLowerCase();
    const validMethods: Array<string> = ['map', 'mle'];
    if (!validMethods.includes(lowerMethod)) {
      throw new Error('The abilityEstimator you provided is not in the list of valid methods');
    }
    return lowerMethod;
  }

  private static validateItemSelect(itemSelect: string) {
    const lowerItemSelect = itemSelect.toLowerCase();
    const validItemSelect: Array<string> = ['drule', 'random'];
    if (!validItemSelect.includes(lowerItemSelect)) {
      throw new Error('The itemSelector you provided is not in the list of valid methods');
    }
    return lowerItemSelect;
  }

  /**
   * Normalize a minTheta/maxTheta constructor input -- either a single number
   * (applied to every dimension) or an array of per-dimension bounds -- into
   * an array of length nDims.
   */
  private static normalizeBounds(value: number | number[], nDims: number, paramName: string): number[] {
    if (Array.isArray(value)) {
      if (value.length !== nDims) {
        throw new Error(`${paramName} must have length nDims (${nDims}) when given as an array. Received length ${value.length}.`);
      }
      return [...value];
    }
    return new Array(nDims).fill(value);
  }

  /**
   * Use previous response patterns and item params to update the joint
   * ability estimate (theta vector) based on a defined method.
   * @param zeta - last item param(s)
   * @param answer - last response pattern(s)
   * @param method
   */
  public updateAbilityEstimate(
    zeta: MultidimensionalZeta | MultidimensionalZeta[],
    answer: (0 | 1) | (0 | 1)[],
    method: string = this.method,
  ) {
    method = MultidimensionalCat.validateMethod(method);

    let zetaArr = Array.isArray(zeta) ? zeta : [zeta];
    const answerArr = Array.isArray(answer) ? answer : [answer];

    zetaArr = zetaArr.map((z) => ensureMultidimensionalZetaNumericValues(z));
    zetaArr.forEach((z) => validateMultidimensionalZeta(z, this.nDims));

    if (zetaArr.length !== answerArr.length) {
      throw new Error('Unmatched length between answers and item params');
    }
    this._zetas.push(...zetaArr);
    this._resps.push(...answerArr);

    const estimate = method === 'map' ? this.estimateAbilityMAP() : this.estimateAbilityMLE();
    this._theta = estimate.map((value, i) => _clamp(value, this.minTheta[i], this.maxTheta[i]));
    this.calculateSE();
  }

  private estimateAbilityMAP(): number[] {
    const theta0 = [...this._theta];
    const solution = minimize_Powell(this.negLogPosterior.bind(this), theta0);
    return solution.argument;
  }

  private estimateAbilityMLE(): number[] {
    const theta0 = [...this._theta];
    const solution = minimize_Powell(this.negLogLikelihood.bind(this), theta0);
    return solution.argument;
  }

  private negLogLikelihood(thetaArr: number[]): number {
    return -this.logLikelihood(thetaArr);
  }

  private negLogPosterior(thetaArr: number[]): number {
    return -this.logLikelihood(thetaArr) + this.negLogPriorDensity(thetaArr);
  }

  private logLikelihood(thetaArr: number[]): number {
    return this._zetas.reduce((acc, zeta, i) => {
      const p = multidimensionalItemResponseFunction(thetaArr, zeta);
      return this._resps[i] === 1 ? acc + Math.log(p) : acc + Math.log(1 - p);
    }, 0);
  }

  /**
   * -log density (up to an additive constant) of a multivariate normal prior
   * N(priorMean, priorCovariance), i.e. the quadratic form 0.5 * (theta -
   * mean)^T * precision * (theta - mean). The additive normalizing constant
   * is dropped since it doesn't affect the location of the posterior mode.
   */
  private negLogPriorDensity(thetaArr: number[]): number {
    const diff = thetaArr.map((value, i) => value - this._priorMean[i]);
    const precisionDiff = this._priorPrecision.map((row) => dot(row, diff));
    return 0.5 * dot(diff, precisionDiff);
  }

  /**
   * Calculate the standard error of measurement for each dimension, as the
   * square root of the diagonal of the inverse of the cumulative information
   * matrix. Falls back to Number.MAX_VALUE for every dimension if the
   * information matrix isn't (yet) invertible.
   */
  private calculateSE() {
    const covariance = inverse(this.infoMatrix);
    this._seMeasurement = covariance
      ? covariance.map((row, i) => Math.sqrt(Math.max(row[i], 0)))
      : new Array(this.nDims).fill(Number.MAX_VALUE);
  }

  /**
   * Find the next available item from an input array of stimuli based on a
   * selection method.
   * @param stimuli - an array of multidimensional stimuli
   * @param itemSelect - the item selection method
   * @param deepCopy - default deepCopy = true
   * @returns {nextStimulus: MultidimensionalStimulus, remainingStimuli: Array<MultidimensionalStimulus>}
   */
  public findNextItem(
    stimuli: MultidimensionalStimulus[],
    itemSelect: string = this.itemSelect,
    deepCopy = true,
  ) {
    let selector = MultidimensionalCat.validateItemSelect(itemSelect);
    const arr: MultidimensionalStimulus[] = deepCopy ? _cloneDeep(stimuli) : stimuli;

    arr.forEach((stim) => validateMultidimensionalZeta(stim, this.nDims));

    if (this.nItems < this.nStartItems) {
      selector = this.startSelect;
    }

    if (selector === 'random') {
      return this.selectorRandom(arr);
    }
    return this.selectorDrule(arr);
  }

  /**
   * D-optimal item selection: pick the item that maximizes the determinant
   * of the information matrix that would result from administering it (the
   * cumulative information matrix, including the prior precision, plus the
   * candidate item's own information matrix at the current theta estimate).
   * This is well-defined even for the very first item, since the prior
   * precision keeps the base information matrix non-singular.
   */
  private selectorDrule(arr: MultidimensionalStimulus[]) {
    const currentInfo = this.infoMatrix;
    const withDeterminant = arr.map((stim) => ({
      stim,
      det: determinant(addMatrix(currentInfo, multidimensionalFisherInformation(this._theta, stim))),
    }));
    withDeterminant.sort((a, b) => b.det - a.det);

    const [chosen, ...rest] = withDeterminant;
    return {
      nextStimulus: chosen?.stim,
      remainingStimuli: rest.map((entry) => entry.stim),
    };
  }

  private selectorRandom(arr: MultidimensionalStimulus[]) {
    const index = this.randomInteger(0, arr.length - 1);
    const nextItem = arr.splice(index, 1)[0];
    return {
      nextStimulus: nextItem,
      remainingStimuli: arr,
    };
  }

  /**
   * return a random integer between min and max
   * @param min - The minimum of the random number range (include)
   * @param max - The maximum of the random number range (include)
   * @returns {number} - random integer within the range
   */
  private randomInteger(min: number, max: number) {
    return Math.floor(this._rng() * (max - min + 1)) + min;
  }
}
