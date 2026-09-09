import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// One isolated, versioned document per member for the private MVP.
// All access is keyed by the trusted gateway identity, never a client user ID.
export const members = sqliteTable('members', {
  userId: text('user_id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
  operations: text('operations').notNull().default('[]'),
  updatedAt: text('updated_at').notNull(),
});
export const coachLimits = sqliteTable('coach_limits', {
  userId: text('user_id').primaryKey(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull(),
});
