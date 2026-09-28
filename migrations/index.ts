import * as migration_20260924_043824_init from './20260924_043824_init';
import * as migration_20260925_000001_add_viva_booking_columns from './20260925_000001_add_viva_booking_columns';
import * as migration_20260926_001_client_changes from './20260926_001_client_changes';
import * as migration_20260926_002_audit_actions from './20260926_002_audit_actions';
import * as migration_20260927_001_add_viva_payment_method_enum from './20260927_001_add_viva_payment_method_enum';
import * as migration_20260928_001_add_payment_deadline from './20260928_001_add_payment_deadline';
import * as migration_20260928_002_waitlist_lifecycle from './20260928_002_waitlist_lifecycle';
import * as migration_20260928_003_data_protection_policy from './20260928_003_data_protection_policy';

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
  {
    up: migration_20260927_001_add_viva_payment_method_enum.up,
    down: migration_20260927_001_add_viva_payment_method_enum.down,
    name: '20260927_001_add_viva_payment_method_enum'
  },
  {
    up: migration_20260928_001_add_payment_deadline.up,
    down: migration_20260928_001_add_payment_deadline.down,
    name: '20260928_001_add_payment_deadline'
  },
  {
    up: migration_20260928_002_waitlist_lifecycle.up,
    down: migration_20260928_002_waitlist_lifecycle.down,
    name: '20260928_002_waitlist_lifecycle'
  },
  {
    up: migration_20260928_003_data_protection_policy.up,
    down: migration_20260928_003_data_protection_policy.down,
    name: '20260928_003_data_protection_policy'
  },
];