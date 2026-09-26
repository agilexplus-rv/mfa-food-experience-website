import * as migration_20260924_043824_init from './20260924_043824_init';
import * as migration_20260925_000001_add_viva_booking_columns from './20260925_000001_add_viva_booking_columns';
import * as migration_20260926_001_client_changes from './20260926_001_client_changes';
import * as migration_20260926_002_audit_actions from './20260926_002_audit_actions';

export const migrations = [
  {
    up: migration_20260924_043824_init.up,
    down: migration_20260924_043824_init.down,
    name: '20260924_043824_init'
  },
  {
    up: migration_20260925_000001_add_viva_booking_columns.up,
    down: migration_20260925_000001_add_viva_booking_columns.down,
    name: '20260925_000001_add_viva_booking_columns'
  },
  {
    up: migration_20260926_001_client_changes.up,
    down: migration_20260926_001_client_changes.down,
    name: '20260926_001_client_changes'
  },
  {
    up: migration_20260926_002_audit_actions.up,
    down: migration_20260926_002_audit_actions.down,
    name: '20260926_002_audit_actions'
  },
];