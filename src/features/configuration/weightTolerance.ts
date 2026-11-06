// How far the criteria weights may be from 1.0 (100%) before Configuration flags them.
// Non-blocking everywhere it is used (FR-010): a warning, never a gate.
export const WEIGHT_TOLERANCE = 0.001;
