import * as migration_20260610_155301 from './20260610_155301';

export const migrations = [
  {
    up: migration_20260610_155301.up,
    down: migration_20260610_155301.down,
    name: '20260610_155301'
  },
];
