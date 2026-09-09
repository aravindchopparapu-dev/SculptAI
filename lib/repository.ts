import { emptyState, type State } from './fitness.ts';
import { applyAction, type Action } from './actions.ts';
type Row = { data: string; revision: number; operations: string };
export class Conflict extends Error {}
export class DuplicateOperation extends Error {}
export async function readState(db: D1Database, userId: string) {
  const row = await db
    .prepare('SELECT data, revision FROM members WHERE user_id = ?')
    .bind(userId)
    .first<Row>();
  return {
    state: row ? (JSON.parse(row.data) as State) : emptyState(),
    revision: row?.revision ?? 0,
  };
}
export async function mutateState(
  db: D1Database,
  userId: string,
  revision: number,
  operationId: string,
  action: Action,
) {
  await db
    .prepare(
      'INSERT INTO members (user_id, data, revision, operations, updated_at) VALUES (?, ?, 0, ?, ?) ON CONFLICT(user_id) DO NOTHING',
    )
    .bind(userId, JSON.stringify(emptyState()), '[]', new Date().toISOString())
    .run();
  const row = await db
    .prepare('SELECT data, revision, operations FROM members WHERE user_id = ?')
    .bind(userId)
    .first<Row>();
  if (!row) throw new Error('Member unavailable');
  const operations = JSON.parse(row.operations) as {
    id: string;
    action: string;
  }[];
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(action)),
  );
  const canonical = Array.from(new Uint8Array(digest), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
  const previous = operations.find((x) => x.id === operationId);
  if (previous) {
    if (previous.action !== canonical)
      throw new DuplicateOperation('This request identifier was already used.');
    return { state: JSON.parse(row.data) as State, revision: row.revision };
  }
  if (row.revision !== revision)
    throw new Conflict(
      'Another tab changed your data. Review the refreshed data and try again.',
    );
  const state = applyAction(JSON.parse(row.data), action);
  // Store bounded hashes of payloads, not duplicate health data.
  const nextOps = [...operations, { id: operationId, action: canonical }].slice(
    -30,
  );
  if (action.type === 'deleteData') nextOps.splice(0, nextOps.length - 1);
  const result = await db
    .prepare(
      'UPDATE members SET data = ?, revision = revision + 1, operations = ?, updated_at = ? WHERE user_id = ? AND revision = ?',
    )
    .bind(
      JSON.stringify(state),
      JSON.stringify(nextOps),
      new Date().toISOString(),
      userId,
      revision,
    )
    .run();
  if (!result.meta.changes)
    throw new Conflict(
      'Another tab saved first. Your data has been refreshed; try again.',
    );
  return { state, revision: revision + 1 };
}
