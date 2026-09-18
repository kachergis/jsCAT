/**
 * Small linear algebra helpers for multidimensional CAT.
 *
 * @remarks
 * Scope is intentionally minimal: square matrices of the size typical for
 * psychometric dimensionality (a handful of latent traits), not general
 * numerical linear algebra. Determinant uses cofactor expansion and inverse
 * uses Gauss-Jordan elimination with partial pivoting; both are O(n!) / O(n^3)
 * respectively, which is fine for the small n this library targets.
 */

export type Matrix = number[][];

/**
 * Build an n x n identity matrix.
 */
export const identity = (n: number): Matrix =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

/**
 * Element-wise addition of two same-shaped matrices.
 */
export const addMatrix = (a: Matrix, b: Matrix): Matrix => a.map((row, i) => row.map((value, j) => value + b[i][j]));

/**
 * Multiply every element of a matrix by a scalar.
 */
export const scaleMatrix = (a: Matrix, scalar: number): Matrix => a.map((row) => row.map((value) => value * scalar));

/**
 * The outer product of two vectors, i.e. a * b^T.
 */
export const outerProduct = (a: number[], b: number[]): Matrix => a.map((ai) => b.map((bj) => ai * bj));

/**
 * The dot (inner) product of two same-length vectors.
 */
export const dot = (a: number[], b: number[]): number => a.reduce((sum, ai, i) => sum + ai * b[i], 0);

/**
 * The determinant of a square matrix, via cofactor expansion along the first row.
 */
export const determinant = (m: Matrix): number => {
  const n = m.length;
  if (n === 1) {
    return m[0][0];
  }
  if (n === 2) {
    return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  }

  let det = 0;
  for (let col = 0; col < n; col++) {
    const minor = m.slice(1).map((row) => row.filter((_, j) => j !== col));
    det += (col % 2 === 0 ? 1 : -1) * m[0][col] * determinant(minor);
  }
  return det;
};

/**
 * The inverse of a square matrix, via Gauss-Jordan elimination with partial pivoting.
 * Returns `null` if the matrix is singular (or numerically indistinguishable from singular).
 */
export const inverse = (m: Matrix): Matrix | null => {
  const n = m.length;
  const identityRows = identity(n);
  const augmented: number[][] = m.map((row, i) => [...row, ...identityRows[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivotRow][col])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][col]) < 1e-12) {
      return null;
    }

    if (pivotRow !== col) {
      [augmented[col], augmented[pivotRow]] = [augmented[pivotRow], augmented[col]];
    }

    const pivotValue = augmented[col][col];
    for (let j = 0; j < 2 * n; j++) {
      augmented[col][j] /= pivotValue;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = 0; j < 2 * n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  return augmented.map((row) => row.slice(n));
};
