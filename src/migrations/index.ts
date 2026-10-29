import * as migration_20260613_084314 from './20260613_084314';
import * as migration_20260622_162900_fix_allergens_schema from './20260622_162900_fix_allergens_schema';
import * as migration_20260622_165857_fix_allergens_schema from './20260622_165857_fix_allergens_schema';
import * as migration_20260622_165913_fix_allergens_schema2 from './20260622_165913_fix_allergens_schema2';
import * as migration_20261022_174805_percent_estimate_nullable from './20261022_174805_percent_estimate_nullable';
import * as migration_20261025_040936_add_expert_posts_and_following from './20261025_040936_add_expert_posts_and_following';
import * as migration_20261025_061858 from './20261025_061858';
import * as migration_20261025_173424_add_goruntulenme from './20261025_173424_add_goruntulenme';
import * as migration_20261028_204639_additives_code_optional from './20261028_204639_additives_code_optional';
import * as migration_20261029_193000_drop_media_image_sizes from './20261029_193000_drop_media_image_sizes';
import * as migration_20261029_210000_add_profiles_and_contributions from './20261029_210000_add_profiles_and_contributions';

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
    name: '20261025_040936_add_expert_posts_and_following',
  },
  {
    up: migration_20261025_061858.up,
    down: migration_20261025_061858.down,
    name: '20261025_061858'
  },
  {
    up: migration_20261025_173424_add_goruntulenme.up,
    down: migration_20261025_173424_add_goruntulenme.down,
    name: '20261025_173424_add_goruntulenme',
  },
  {
    up: migration_20261028_204639_additives_code_optional.up,
    down: migration_20261028_204639_additives_code_optional.down,
    name: '20261028_204639_additives_code_optional',
  },
  {
    up: migration_20261029_193000_drop_media_image_sizes.up,
    down: migration_20261029_193000_drop_media_image_sizes.down,
    name: '20261029_193000_drop_media_image_sizes',
  },
  {
    up: migration_20261029_210000_add_profiles_and_contributions.up,
    down: migration_20261029_210000_add_profiles_and_contributions.down,
    name: '20261029_210000_add_profiles_and_contributions',
  },
];
