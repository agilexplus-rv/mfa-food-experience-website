import * as migration_20260924_043824_init from './20260924_043824_init';

export const migrations = [
  {
    up: migration_20260924_043824_init.up,
    down: migration_20260924_043824_init.down,
    name: '20260924_043824_init'
  },
];
