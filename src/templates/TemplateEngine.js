/**
 * Template Engine — resolves a test template by ID and validates it.
 *
 * A test template shape:
 * {
 *   id:           string           unique slug
 *   name:         string           display name
 *   description:  string
 *   nodes:        NodeDef[]        required sensor nodes
 *   triggerSequence: string[]      ordered list of roles that must fire
 *   metrics:      MetricDef[]      formulas applied to event timestamps
 *   fieldLayout:  string           SVG or ASCII art field diagram
 *   normTable:    NormTable|null   age/gender benchmark table
 * }
 *
 * NodeDef:   { id, role, label, description, optional? }
 * MetricDef: { key, label, unit, formula(events) → value }
 * NormTable: { male: {age: {excellent,good,average,belowAverage,poor}}, female: {...} }
 */

import { sprint30mTemplate }    from './sprint30m';
import { yShapeTemplate }       from './yShapeAgility';
import { illinoisTemplate }     from './illinoisAgility';

const REGISTRY = [
  sprint30mTemplate,
  yShapeTemplate,
  illinoisTemplate,
];

/** Returns all registered templates */
export function getAllTemplates() {
  return REGISTRY;
}

/** Returns a template by id, or null */
export function getTemplate(id) {
  return REGISTRY.find(t => t.id === id) || null;
}

/**
 * Calculates metrics from an ordered array of trigger events.
 * events: [{ role, correctedTime, method }]
 */
export function calculateMetrics(template, events) {
  const results = {};
  for (const metric of template.metrics) {
    try {
      results[metric.key] = metric.formula(events);
    } catch {
      results[metric.key] = null;
    }
  }
  return results;
}

/**
 * Returns rating label from norm table.
 * gender: 'male'|'female', age: number, value: number (seconds)
 */
export function getNormRating(template, gender, age, value) {
  if (!template.normTable) return null;
  const genderTable = template.normTable[gender] || template.normTable.male;
  if (!genderTable) return null;

  // Find closest age bracket
  const ages   = Object.keys(genderTable).map(Number).sort((a, b) => a - b);
  const bracket = ages.reduce((prev, curr) =>
    Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev, ages[0]);

  const norms  = genderTable[bracket];
  if (!norms) return null;

  if (value <= norms.excellent)   return { label: 'Excellent',      color: 'text-green-400' };
  if (value <= norms.good)        return { label: 'Good',           color: 'text-blue-400'  };
  if (value <= norms.average)     return { label: 'Average',        color: 'text-yellow-400'};
  if (value <= norms.belowAverage)return { label: 'Below Average',  color: 'text-orange-400'};
  return                                 { label: 'Poor',           color: 'text-red-400'   };
}

/** Register a new template at runtime (for custom coach-defined tests) */
export function registerTemplate(template) {
  if (REGISTRY.find(t => t.id === template.id)) return;
  REGISTRY.push(template);
}
