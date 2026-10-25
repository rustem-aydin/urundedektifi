import * as migration_20260613_084314 from './20260613_084314';
import * as migration_20260622_162900_fix_allergens_schema from './20260622_162900_fix_allergens_schema';
import * as migration_20260622_165857_fix_allergens_schema from './20260622_165857_fix_allergens_schema';
import * as migration_20260622_165913_fix_allergens_schema2 from './20260622_165913_fix_allergens_schema2';
import * as migration_20261022_174805_percent_estimate_nullable from './20261022_174805_percent_estimate_nullable';
import * as migration_20261025_040936_add_expert_posts_and_following from './20261025_040936_add_expert_posts_and_following';

export const migrations = [
  {
    up: migration_20260613_084314.up,
    down: migration_20260613_084314.down,
    name: '20260613_084314',
  },
  {
    up: migration_20260622_162900_fix_allergens_schema.up,
    down: migration_20260622_162900_fix_allergens_schema.down,
    name: '20260622_162900_fix_allergens_schema',
  },
  {
    up: migration_20260622_165857_fix_allergens_schema.up,
    down: migration_20260622_165857_fix_allergens_schema.down,
    name: '20260622_165857_fix_allergens_schema',
  },
  {
    up: migration_20260622_165913_fix_allergens_schema2.up,
    down: migration_20260622_165913_fix_allergens_schema2.down,
    name: '20260622_165913_fix_allergens_schema2',
  },
  {
    up: migration_20261022_174805_percent_estimate_nullable.up,
    down: migration_20261022_174805_percent_estimate_nullable.down,
    name: '20261022_174805_percent_estimate_nullable',
  },
  {
    up: migration_20261025_040936_add_expert_posts_and_following.up,
    down: migration_20261025_040936_add_expert_posts_and_following.down,
    name: '20261025_040936_add_expert_posts_and_following'
  },
];
