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

// Product controls are shared by web and future native clients. No member
// health records or API credentials are stored in these tables.
export const adminSettings = sqliteTable('admin_settings', {
  id: integer('id').primaryKey(),
  revision: integer('revision').notNull(),
  publishedVersion: integer('published_version').notNull(),
  draft: text('draft').notNull(),
  published: text('published').notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});

export const adminVersions = sqliteTable('admin_versions', {
  version: integer('version').primaryKey(),
  config: text('config').notNull(),
  publishedAt: text('published_at').notNull(),
  publishedBy: text('published_by').notNull(),
});
