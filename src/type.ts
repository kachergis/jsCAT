export type ZetaSymbolic = {
  // Symbolic parameter names
  a: number; // Discrimination (slope of the curve)
  b: number; // Difficulty (location of the curve)
  c: number; // Guessing (lower asymptote)
  d: number; // Slipping (upper asymptote)
};

export interface Zeta {
  // Symbolic parameter names
  a?: number; // Discrimination (slope of the curve)
  b?: number; // Difficulty (location of the curve)
  c?: number; // Guessing (lower asymptote)
  d?: number; // Slipping (upper asymptote)
  // Semantic parameter names
  discrimination?: number;
  difficulty?: number;
  guessing?: number;
  slipping?: number;
}

export interface Stimulus extends Zeta {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export type ZetaCatMap = {
  cats: string[];
  zeta: Zeta;
};

export interface MultiZetaStimulus {
  zetas: ZetaCatMap[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export type CatMap<T> = {
  [name: string]: T;
};

/**
 * Item parameters for a compensatory multidimensional IRT model (M2PL/M3PL,
 * including bifactor models as a special case where `a` is sparse). Follows
 * mirt's own parameterization directly, i.e. P(theta) = g + (u - g) / (1 +
 * exp(-(a . theta + d))), so item banks exported from `coef(mod)` in mirt/
 * mirtCAT map over without reparameterization. Note that `d` here is the
 * linear predictor intercept (mirt's convention), not the unidimensional
 * `Zeta.d` (slipping) used elsewhere in this library.
 */
export interface MultidimensionalZeta {
  a: number[]; // discrimination/slope on each dimension (0 for dimensions the item doesn't load on)
  d?: number; // intercept of the linear predictor a . theta + d; default 0
  g?: number; // guessing / lower asymptote; default 0
  u?: number; // upper asymptote (slipping complement); default 1
}

export interface MultidimensionalStimulus extends MultidimensionalZeta {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
