import * as migration_20260613_084314 from './20260613_084314';
import * as migration_20260622_162900_fix_allergens_schema from './20260622_162900_fix_allergens_schema';

export const migrations = [
  {
    up: migration_20260613_084314.up,
    down: migration_20260613_084314.down,
    name: '20260613_084314',
  },
  {
    up: migration_20260622_162900_fix_allergens_schema.up,
    down: migration_20260622_162900_fix_allergens_schema.down,
    name: '20260622_162900_fix_allergens_schema'
  },
];
