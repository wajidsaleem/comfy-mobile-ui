/**
 * Enum type definitions
 */

/**
 * Node execution modes
 */
export enum NodeMode {
  ALWAYS = 0,
  ON_EVENT = 1,
  NEVER = 2,
  ON_TRIGGER = 3,
  BYPASS = 4
}

/**
 * Node shapes
 */
export enum NodeShape {
  BOX = 1,
  ROUND = 2,
  CARD = 3,
  CIRCLE = 4
}