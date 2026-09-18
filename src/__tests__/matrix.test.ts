/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { addMatrix, determinant, dot, identity, inverse, outerProduct, scaleMatrix } from '../matrix';

describe('identity', () => {
  it('builds an n x n identity matrix', () => {
    expect(identity(1)).toEqual([[1]]);
    expect(identity(2)).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(identity(3)).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });
});

describe('addMatrix', () => {
  it('adds two matrices element-wise', () => {
    const a = [
      [1, 2],
      [3, 4],
    ];
    const b = [
      [10, 20],
      [30, 40],
    ];
    expect(addMatrix(a, b)).toEqual([
      [11, 22],
      [33, 44],
    ]);
  });
});

describe('scaleMatrix', () => {
  it('multiplies every element by a scalar', () => {
    const a = [
      [1, -2],
      [3, 4],
    ];
    expect(scaleMatrix(a, 2)).toEqual([
      [2, -4],
      [6, 8],
    ]);
  });
});

describe('outerProduct', () => {
  it('computes a * b^T', () => {
    expect(outerProduct([1, 2], [3, 4])).toEqual([
      [3, 4],
      [6, 8],
    ]);
  });

  it('produces a rank-1 matrix (zero determinant) for dimension > 1', () => {
    const m = outerProduct([1.5, -0.7, 2.2], [1.5, -0.7, 2.2]);
    expect(determinant(m)).toBeCloseTo(0, 8);
  });
});

describe('dot', () => {
  it('computes the dot product of two vectors', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });
});

describe('determinant', () => {
  it('returns the single entry for a 1x1 matrix', () => {
    expect(determinant([[5]])).toBe(5);
  });

  it('computes a 2x2 determinant', () => {
    expect(
      determinant([
        [1, 2],
        [3, 4],
      ]),
    ).toBe(1 * 4 - 2 * 3);
  });

  it('computes a 3x3 determinant', () => {
    const m = [
      [6, 1, 1],
      [4, -2, 5],
      [2, 8, 7],
    ];
    // Known determinant of this matrix is -306
    expect(determinant(m)).toBeCloseTo(-306, 8);
  });

  it('returns 1 for the identity matrix, for several sizes', () => {
    expect(determinant(identity(2))).toBe(1);
    expect(determinant(identity(3))).toBe(1);
    expect(determinant(identity(4))).toBe(1);
  });
});

describe('inverse', () => {
  it('returns the identity as its own inverse', () => {
    expect(inverse(identity(3))).toEqual(identity(3));
  });

  it('computes the inverse of a 2x2 matrix', () => {
    const m = [
      [4, 7],
      [2, 6],
    ];
    const inv = inverse(m)!;
    // Known inverse: 1/10 * [[6, -7], [-2, 4]]
    expect(inv[0][0]).toBeCloseTo(0.6, 8);
    expect(inv[0][1]).toBeCloseTo(-0.7, 8);
    expect(inv[1][0]).toBeCloseTo(-0.2, 8);
    expect(inv[1][1]).toBeCloseTo(0.4, 8);
  });

  it('returns null for a singular matrix', () => {
    const singular = [
      [1, 2],
      [2, 4],
    ];
    expect(inverse(singular)).toBeNull();
  });

  it('satisfies A * A^-1 ~= I for a random-ish 3x3 matrix', () => {
    const a = [
      [2, 0, 1],
      [1, 3, 2],
      [1, 0, 0],
    ];
    const inv = inverse(a)!;
    expect(inv).not.toBeNull();

    // Manually multiply a * inv and check it's close to the identity
    const product = a.map((row) =>
      inv[0].map((_, colIdx) => row.reduce((sum, val, k) => sum + val * inv[k][colIdx], 0)),
    );
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(product[i][j]).toBeCloseTo(i === j ? 1 : 0, 8);
      }
    }
  });

  it('requires pivoting to invert correctly (a matrix with a zero on the diagonal)', () => {
    const m = [
      [0, 1],
      [1, 0],
    ];
    const inv = inverse(m)!;
    expect(inv).toEqual([
      [0, 1],
      [1, 0],
    ]);
  });
});
