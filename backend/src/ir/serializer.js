/**
 * Canonical Design IR Serializer & Migration Framework
 * Provides deterministic JSON serialization, deserialization, and schema version migrations.
 */

import { IR_VERSION } from './schema.js';
import { validateDesignIR } from './validator.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Deterministically serialize Design IR to a stable formatted JSON string
 * @param {Object} ir - Design IR document
 * @param {boolean} [pretty=false] - Whether to format with indentation
 * @returns {string} Serialized JSON
 */
export const serializeDesignIR = (ir, pretty = false) => {
  if (!ir || typeof ir !== 'object') {
    throw new AppError('Cannot serialize invalid Design IR: non-object', 400, 'SERIALIZE_ERROR');
  }

  // Basic validation check before serialization
  const validation = validateDesignIR(ir);
  if (!validation.isValid) {
    console.warn(`[serializeDesignIR] Warning: serializing IR with validation errors: ${validation.errors.join('; ')}`);
  }

  return pretty ? JSON.stringify(ir, null, 2) : JSON.stringify(ir);
};

/**
 * Safely parse JSON into Design IR document with validation
 * @param {string|Object} input - JSON string or raw object
 * @returns {Object} Hydrated Design IR document
 */
export const deserializeDesignIR = (input) => {
  if (!input) {
    throw new AppError('Cannot deserialize empty input', 400, 'DESERIALIZE_ERROR');
  }

  let parsed;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      throw new AppError(`Malformed JSON during Design IR deserialization: ${err.message}`, 400, 'MALFORMED_JSON');
    }
  } else if (typeof input === 'object') {
    parsed = input;
  } else {
    throw new AppError('Invalid input type for Design IR deserialization', 400, 'DESERIALIZE_ERROR');
  }

  // Schema version check and automatic migration if needed
  if (parsed.version && parsed.version !== IR_VERSION) {
    parsed = migrateDesignIR(parsed, IR_VERSION);
  }

  return parsed;
};

/**
 * Schema version migration router
 * @param {Object} ir - Design IR document from older schema
 * @param {string} targetVersion - Destination semver (default CURRENT)
 * @returns {Object} Migrated Design IR
 */
export const migrateDesignIR = (ir, targetVersion = IR_VERSION) => {
  if (!ir) return ir;

  const currentVersion = ir.version || '0.9.0';
  if (currentVersion === targetVersion) return ir;

  console.log(`[migrateDesignIR] Migrating Design IR from v${currentVersion} to v${targetVersion}...`);

  const migrated = { ...ir };

  // Example migration from pre-1.0.0 or legacy versions to 1.0.0
  if (currentVersion.startsWith('0.')) {
    migrated.version = '1.0.0';
    if (!migrated.tokens) migrated.tokens = { colors: {}, typography: {}, spacing: [], radii: [], shadows: [] };
    if (!migrated.components) migrated.components = [];
    if (!migrated.assets) migrated.assets = [];
    if (!migrated.relationships) migrated.relationships = { nodes: [], edges: [], statistics: {} };
    if (!migrated.metadata) migrated.metadata = {};
    migrated.metadata.migratedFrom = currentVersion;
    migrated.metadata.migratedAt = new Date().toISOString();
  }

  migrated.version = targetVersion;
  return migrated;
};

