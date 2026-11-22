// Calendar Stage 1 EXPERIMENT (Step 48E): the Stage 2 sticky-split experiment
// ../calendar-sticky-split/ (C, baseline: dynamic title release, Step 48C) vs
// this folder (B, Stage 1). Same matrix as calendar-stage1.config.mjs.
// Every differing frame shows what Stage 2 adds or changes beyond Stage 1;
// identical frames are kept only as the first static capture per run.
//
//   node ../../consolidation-pilot/tools/visual-compare.mjs calendar-stage1-vs-stage2.config.mjs
import { matrix } from './calendar-stage1.config.mjs';

export default {
  name: 'calendar-stage1-vs-stage2',
  baseline: '../calendar-sticky-split',
  pilot: '.',
  outLabel: 'stage1-vs-stage2',
  ...matrix,
  saveShots: 'first',
};
