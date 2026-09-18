[![Test and lint](https://github.com/yeatmanlab/jsCAT/actions/workflows/ci.yml/badge.svg)](https://github.com/yeatmanlab/jsCAT/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/yeatmanlab/jsCAT/badge.svg?branch=main)](https://coveralls.io/github/yeatmanlab/jsCAT?branch=main)
[![npm version](https://badge.fury.io/js/@bdelab%2Fjscat.svg)](https://badge.fury.io/js/@bdelab%2Fjscat)

# jsCAT: Computer Adaptive Testing in JavaScript

A library to support IRT-based computer adaptive testing in JavaScript

## Installation

You can install jsCAT from npm with

```bash
npm i @bdelab/jscat
```

## Usage

For existing jsCAT users: to make your applications compatible to the updated jsCAT version, you will need to pass the stimuli in the following way:

```js
// import jsCAT
import { Cat } from '@bdelab/jscat';

// create a Cat object with MLE estimator
const cat1 = new CAT({method: 'MLE', itemSelect: 'MFI', nStartItems: 0, theta: 0, minTheta: -6, maxTheta: 6})

// create a Cat object with EAP estimator with normal distribution
const cat2 = new CAT({method: 'eap', itemSelect: 'MFI', nStartItems: 0, theta: 0, minTheta: -6, maxTheta: 6, priorDist: 'norm', priorPar: [0, 1]})

// create a Cat object with EAP estimator with unirform distribution
const cat3 = new CAT({method: 'eap', itemSelect: 'MFI', nStartItems: 0, theta: 0, minTheta: -6, maxTheta: 6, priorDist: 'unif', priorPar: [-4, 4]})

// option 1 to input stimuli:
const zeta = {[{discrimination: 1, difficulty: 0, guessing: 0, slipping: 1}, {discrimination: 1, difficulty: 0.5, guessing: 0, slipping: 1}]}

// option 2 to input stimuli:
const zeta = {[{a: 1, b: 0, c: 0, d: 1}, {a: 1, b: 0.5, c: 0, d: 1}]}

const answer = {[1, 0]}

// update the ability estimate by adding test items 
cat.updateAbilityEstimate(zeta, answer);

const currentTheta = cat1.theta;

const currentSeMeasurement = cat1.seMeasurement;

const numItems = cat1.nItems;

// find the next available item from an input array of stimuli based on a selection method

> **Note:** For existing jsCAT users: To make your applications compatible with the updated jsCAT version, you will need to pass the stimuli in the following way:

const stimuli = [{  discrimination: 1, difficulty: -2, guessing: 0, slipping: 1, item = "item1" },{ discrimination: 1, difficulty: 3, guessing: 0, slipping: 1, item = "item2" }];

const nextItem = cat1.findNextItem(stimuli, 'MFI');
```


## Validation

### Validation of theta estimate and theta standard error

Reference software: mirt (Chalmers, 2012)
![img.png](validation/plots/jsCAT_validation_1.png)

### Validation of MFI algorithm 

Reference software: catR (Magis et al., 2017)
![img_1.png](validation/plots/jsCAT_validation_2.png)

# Clowder Usage Guide

The `Clowder` class is a powerful tool for managing multiple `Cat` instances and handling stimuli corpora in adaptive testing scenarios. This guide provides an overview of integrating `Clowder` into your application, with examples and explanations for key features.

---

## Key Changes from Single `Cat` to `Clowder`

### Why Use Clowder?

- **Multi-CAT Support**: Manage multiple `Cat` instances simultaneously.
- **Centralized Corpus Management**: Handle validated and unvalidated items across Cats.
- **Advanced Trial Management**: Dynamically update Cats and retrieve stimuli based on configurable rules.
- **Early Stopping Mechanisms**: Optimize testing by integrating conditions to stop trials automatically.

---

## Transitioning to Clowder

### 1. Replacing Single `Cat` Usage

#### Single `Cat` Example:
```typescript
const cat = new Cat({ method: 'MLE', theta: 0.5 });
const nextItem = cat.findNextItem(stimuli);
```

#### Clowder Equivalent:
```typescript
const clowder = new Clowder({
  cats: { cat1: { method: 'MLE', theta: 0.5 } },
  corpus: stimuli,
});
const nextItem = clowder.updateCatAndGetNextItem({
  catToSelect: 'cat1',
});
```

---

### 2. Using a Corpus with Multi-Zeta Stimuli

The `Clowder` corpus supports multi-zeta stimuli, allowing each stimulus to define parameters for multiple Cats. Use the following tools to prepare the corpus:

#### Fill Default Zeta Parameters:

```typescript
import { fillZetaDefaults } from './corpus';

const filledStimuli = stimuli.map((stim) => fillZetaDefaults(stim));

```

**What is `fillZetaDefaults`?**
The function `fillZetaDefaults` ensures that each stimulus in the corpus has Zeta parameters defined. If any parameters are missing, it fills them with the default Zeta values.

The default values are:

```typescript
export const defaultZeta = (desiredFormat: 'symbolic' | 'semantic' = 'symbolic'): Zeta => {
  const defaultZeta: Zeta = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
  };

  return convertZeta(defaultZeta, desiredFormat);
};

```
- If desiredFormat is not specified, it defaults to 'symbolic'.
- This ensures consistency across different stimuli and prevents errors from missing Zeta parameters.
- You can pass 'semantic' as an argument to convert the default Zeta values into a different representation.

#### Validate the Corpus:
```typescript
import { checkNoDuplicateCatNames } from './corpus';
checkNoDuplicateCatNames(corpus);
```

#### Filter Stimuli for a Specific Cat:
```typescript
import { filterItemsByCatParameterAvailability } from './corpus';
const { available, missing } = filterItemsByCatParameterAvailability(corpus, 'cat1');
```

---

### 3. Adding Early Stopping

Integrate early stopping mechanisms to optimize the testing process.

#### Example: Stop After N Items
```typescript
import { StopAfterNItems } from './stopping';

const earlyStopping = new StopAfterNItems({
  requiredItems: { cat1: 2 },
});

const clowder = new Clowder({
  cats: { cat1: { method: 'MLE', theta: 0.5 } },
  corpus: stimuli,
  earlyStopping: earlyStopping,
});
```

## Early Stopping Criteria Combinations

To clarify the available combinations for early stopping, here’s a breakdown of the options you can use:

### 1. Logical Operations

You can combine multiple stopping criteria using one of the following logical operations:

- **`and`**: All conditions need to be met to trigger early stopping.
- **`or`**: Any one condition being met will trigger early stopping.
- **`only`**: Only a specific condition is considered (you need to specify the cat to evaluate).

### 2. Stopping Criteria Classes

There are different types of stopping criteria you can configure:

- **`StopAfterNItems`**: Stops the process after a specified number of items.
- **`StopOnSEMeasurementPlateau`**: Stops if the standard error (SE) of measurement remains stable (within a defined tolerance) for a specified number of items.
- **`StopIfSEMeasurementBelowThreshold`**: Stops if the SE measurement drops below a set threshold.

### How Combinations Work

You can mix and match these criteria with different logical operations, giving you a range of configurations for early stopping. For example:

- Using **`and`** with both `StopAfterNItems` and `StopIfSEMeasurementBelowThreshold` means stopping will only occur if both conditions are satisfied.
- Using **`or`** with `StopOnSEMeasurementPlateau` and `StopAfterNItems` allows early stopping if either condition is met.

---

## Clowder Example

Here’s a complete example demonstrating how to configure and use `Clowder`:

```typescript
import { Clowder } from './clowder';
import { createMultiZetaStimulus, createZetaCatMap } from './utils';
import { StopAfterNItems } from './stopping';

// Define the Cats
const catConfigs = {
  cat1: { method: 'MLE', theta: 0.5 }, // Cat1 uses Maximum Likelihood Estimation
  cat2: { method: 'EAP', theta: -1.0 }, // Cat2 uses Expected A Posteriori
};

// Define the corpus
const corpus = [
  createMultiZetaStimulus('item1', [
    createZetaCatMap(['cat1'], { a: 1, b: 0.5, c: 0.2, d: 0.8 }),
    createZetaCatMap(['cat2'], { a: 2, b: 0.7, c: 0.3, d: 0.9 }),
  ]),
  createMultiZetaStimulus('item2', [createZetaCatMap(['cat1'], { a: 1.5, b: 0.4, c: 0.1, d: 0.85 })]),
  createMultiZetaStimulus('item3', [createZetaCatMap(['cat2'], { a: 2.5, b: 0.6, c: 0.25, d: 0.95 })]),
  createMultiZetaStimulus('item4', []), // Unvalidated item
];

// Optional: Add an early stopping strategy
const earlyStopping = new StopAfterNItems({
  requiredItems: { cat1: 2, cat2: 2 },
});

// Initialize the Clowder
const clowder = new Clowder({
  cats: catConfigs,
  corpus: corpus,
  earlyStopping: earlyStopping,
});

// Running Trials
const nextItem = clowder.updateCatAndGetNextItem({
  catToSelect: 'cat1',
  catsToUpdate: ['cat1', 'cat2'], // Update responses for both Cats
  items: [clowder.corpus[0]], // Previously seen item
  answers: [1], // Response for the previously seen item
  additionalItemsToRemove: [clowder.corpus[3]], // Optional: Remove items without updating ability estimates
});

console.log('Next item to present:', nextItem);

// Check stopping condition
if (clowder.earlyStopping?.earlyStop) {
  console.log('Early stopping triggered:', clowder.stoppingReason);
}
```

### 4. Managing Item Removal with `additionalItemsToRemove`

The `additionalItemsToRemove` parameter allows you to remove items from the remaining corpus without updating ability estimates. This is useful for excluding items that should not be presented again (e.g., items that were skipped, flagged, or excluded for other reasons).

#### Key Characteristics:

- **Does not affect ability estimates**: Items in `additionalItemsToRemove` are removed from the corpus but do not contribute to Cat ability updates.
- **Does not add to seenItems**: These items are not tracked in the `seenItems` array.
- **Cumulative removal**: Multiple calls to `updateCatAndGetNextItem` with `additionalItemsToRemove` will cumulatively remove items.

#### Example Usage:

```typescript
// Remove items that were skipped or flagged without updating ability estimates
const nextItem = clowder.updateCatAndGetNextItem({
  catToSelect: 'cat1',
  catsToUpdate: ['cat1'],
  items: [clowder.corpus[0]], // Item that was presented and answered
  answers: [1],
  additionalItemsToRemove: [clowder.corpus[2], clowder.corpus[3]], // Items to exclude without updating ability
});

// After this call:
// - clowder.corpus[0] is in seenItems and was used to update cat1's ability
// - clowder.corpus[2] and clowder.corpus[3] are removed from remainingItems but NOT in seenItems
// - Only clowder.corpus[1] and any other items remain available for selection
```

---

By integrating `Clowder`, your application can efficiently manage adaptive testing scenarios with robust trial and stimuli handling, multi-CAT configurations, and stopping conditions to ensure optimal performance.

# Multidimensional CAT Usage Guide

`Clowder` runs several independent *unidimensional* Cats side by side; each dimension is estimated on its own from its own items. `MultidimensionalCat` is different: it estimates a single vector of latent abilities (theta) **jointly** from a compensatory multidimensional IRT model, so a single item can inform several dimensions at once. This is the right tool for a fitted bifactor (or other compensatory MIRT) model, e.g. a general factor plus several specific factors.

Item parameters follow [mirt](https://cran.r-project.org/package=mirt)'s own convention directly:

```
P(theta) = g + (u - g) / (1 + exp(-(a . theta + d)))
```

where `a` is the item's discrimination vector (one slope per dimension; `0` for dimensions it doesn't load on), `d` is the linear predictor intercept, `g` is the guessing/lower asymptote, and `u` is the upper asymptote. Coefficients pulled from `coef(mod)` in mirt/mirtCAT can be used as-is, without reparameterizing.

## Example: bifactor CAT with a D-optimal item selection rule

This mirrors a `mirtCAT` run with `criteria = "Drule"`, `method = "MAP"`, and a `design` list of `min_items`/`max_items`/`min_SEM`:

```typescript
import { MultidimensionalCat, checkMultidimensionalStopping, MultidimensionalStimulus } from '@bdelab/jscat';

// Item bank fit as a bifactor model: each item loads on G plus exactly one
// specific factor (S1_noun or S2_predicate), matching coef(mod) from mirt.
const itemBank: MultidimensionalStimulus[] = [
  { item_id: 'noun_01', a: [1.1, 1.2, 0], d: 0.4, g: 0.1, u: 1 },
  { item_id: 'pred_01', a: [1.0, 0, 1.3], d: -0.2, g: 0.1, u: 1 },
  // ...
];

const cat = new MultidimensionalCat({
  nDims: 3, // [G, S1_noun, S2_predicate]
  method: 'MAP',
  itemSelect: 'Drule', // also used for start_item, since Drule is well-defined at 0 items
});

let remainingItems = itemBank;
while (true) {
  const { nextStimulus, remainingStimuli } = cat.findNextItem(remainingItems);
  if (!nextStimulus) break;
  remainingItems = remainingStimuli;

  const answer = getResponseFromParticipant(nextStimulus); // 0 or 1
  cat.updateAbilityEstimate(
    { a: nextStimulus.a, d: nextStimulus.d, g: nextStimulus.g, u: nextStimulus.u },
    answer,
  );

  const { stop } = checkMultidimensionalStopping(cat, {
    minItems: 150, // don't stop early just because minSEM was reached quickly
    maxItems: 200,
    minSEM: [0.3, 0.42, 0.41], // per-dimension SE threshold: [G, S1_noun, S2_predicate]
  });
  if (stop) break;
}

// cat.theta is [G, S1_noun, S2_predicate]; cat.seMeasurement holds the matching per-dimension SEs.
const biasScore = cat.theta[1] - cat.theta[2]; // S1_noun - S2_predicate
```

Notes on how this maps onto `mirtCAT`:

- **`criteria`/`start_item`** &rarr; `itemSelect`, one of:
  - `'Drule'` (default): maximizes the determinant of the resulting cumulative Fisher information matrix (prior precision + all administered items' information, evaluated at the current theta). Well-defined even for the very first item because the prior precision (default: the identity matrix, i.e. independent unit-variance dimensions -- the usual assumption for an orthogonal bifactor model) keeps the base information matrix non-singular.
  - `'Wrule'`: maximizes `weights^T * infoMatrix * weights` on that same cumulative information matrix. `weights` (default: a vector of ones) lets you emphasize some dimensions over others -- e.g. `weights: [0, 1, 1]` to prioritize resolving two specific factors and ignore a general one entirely.
  - `'KL'`: maximizes the pointwise Kullback-Leibler divergence between each candidate item's response distribution at `theta + klDelta` vs `theta - klDelta` (`klDelta` defaults to 0.1, mirroring mirtCAT's `KL_delta`). Unlike Drule/Wrule, this doesn't reference the cumulative information matrix at all.
  - `'random'`.
- **`method = "MAP"`** &rarr; `method: 'MAP'` (default). `'MLE'` is also available as a lower-overhead alternative once there's enough information to avoid divergence, but has no informative-prior regularization. `'EAP'` is also available: the posterior mean over a fixed rectangular quadrature grid (the Cartesian product of `quadPoints` points per dimension, spanning `[minTheta, maxTheta]`, built once at construction), rather than an optimizer search -- its `seMeasurement` is the actual posterior SD on that grid rather than the asymptotic (information-matrix-based) SE that MAP/MLE use. `quadPoints` defaults to keep the total grid size (`quadPoints ^ nDims`) roughly constant as `nDims` grows, since it's an exponential-in-`nDims` cost; override it for more/less precision.
- **`design = list(min_items, max_items, min_SEM)`** &rarr; `checkMultidimensionalStopping(cat, { minItems, maxItems, minSEM })`. Like `Cat`/`Clowder`, `MultidimensionalCat` doesn't run the test loop itself; call this after each update and stop once it returns `{ stop: true }`.
- **`local_pattern` / pre-collected response data** &rarr; not built in. Since this library doesn't run the loop for you, replaying a fixed response pattern is just a matter of driving `updateAbilityEstimate`/`findNextItem` from your own stored responses instead of live ones.

`minTheta`/`maxTheta` (default -6/6) can be a single number applied to every dimension, or an array giving a separate bound per dimension, e.g. `minTheta: [-6, -6, -6], maxTheta: [6, 6, 6]`.

Not yet supported (open areas for future work): `Trule`/`Arule`/`Erule` and their posterior-weighted (`...Prule`) variants, integrated/full-posterior KL (`IKL`), and correlated (non-orthogonal) prior covariance structures beyond what you supply directly via `priorCovariance`.

This has been validated against a real fitted bifactor model and real (imputed) response data, replaying each simulated person's actual recorded answers through `MultidimensionalCat`'s Drule+MAP pipeline with the same `min_items`/`max_items`/`min_SEM` design as an equivalent `mirtCAT` run: per-dimension SEs, bias-score recovery, and G-score recovery all closely tracked the reference `mirtCAT` run's own output (e.g. bias-score recovery correlation 0.89 vs mirtCAT's 0.88 on the same design).

## References

- Chalmers, R. P. (2012). mirt: A multidimensional item response theory package for the R environment. Journal of Statistical Software.

- Magis, D., & Barrada, J. R. (2017). Computerized adaptive testing with R: Recent updates of the package catR. Journal of Statistical Software, 76, 1-19.

- Lucas Duailibe, irt-js, (2019), GitHub repository, https://github.com/geekie/irt-js

## License

jsCAT is distributed under the [ISC license](LICENSE).

## Contributors
jsCAT is contributed by Wanjing Anya Ma, Emily Judith Arteaga Garcia, Jason D. Yeatman, and Adam Richie-Halford. 

## Citation 
If you are use jsCAT for your web applications, please cite us:
Ma, W. A., Richie-Halford, A., Burkhardt, A. K., Kanopka, K., Chou, C., Domingue, B. W., & Yeatman, J. D. (2025). ROAR-CAT: Rapid Online Assessment of Reading ability with Computerized Adaptive Testing. Behavior Research Methods, 57(1), 1-17. https://doi.org/10.3758/s13428-024-02578-y

@article{ma2025roar,
  title={ROAR-CAT: Rapid Online Assessment of Reading ability with Computerized Adaptive Testing},
  author={Ma, Wanjing Anya and Richie-Halford, Adam and Burkhardt, Amy K and Kanopka, Klint and Chou, Clementine and Domingue, Benjamin W and Yeatman, Jason D},
  journal={Behavior Research Methods},
  volume={57},
  number={1},
  pages={1--17},
  year={2025},
  publisher={Springer}
}