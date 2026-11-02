import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

export function createMemoryStore() {
  const tables: Record<string, Row[]> = {
    creator_profiles: [],
    saved_analyses: [],
  };
  let missedUpdates = 0;
  let failNextInsert = false;

  function builder(table: string) {
    const state = {
      op: 'select' as 'select' | 'insert' | 'update' | 'delete',
      payload: null as Row | null,
      filters: [] as Array<{ column: string; value: string }>,
    };

    function matches(row: Row) {
      return state.filters.every((filter) => row[filter.column] === filter.value);
    }

    async function run(mode: 'one' | 'many') {
      const rows = tables[table] ?? [];
      if (state.op === 'insert') {
        if (failNextInsert) {
          failNextInsert = false;
          return { data: null, error: { message: 'duplicate key' } };
        }
        const row = { ...(state.payload ?? {}) };
        if (!row.id) row.id = crypto.randomUUID();
        if (!row.created_at) row.created_at = new Date().toISOString();
        if (table === 'creator_profiles' && rows.some((existing) => existing.id === row.id)) {
          return { data: null, error: { message: 'duplicate key' } };
        }
        rows.push(row);
        tables[table] = rows;
        return { data: mode === 'one' ? row : [row], error: null };
      }
      if (state.op === 'update') {
        if (missedUpdates > 0) {
          missedUpdates -= 1;
          return { data: [], error: null };
        }
        const matched = rows.filter(matches);
        matched.forEach((row) => Object.assign(row, state.payload));
        return { data: matched.map((row) => ({ id: row.id })), error: null };
      }
      if (state.op === 'delete') {
        const matched = rows.filter(matches);
        tables[table] = rows.filter((row) => !matches(row));
        return { data: matched.map((row) => ({ id: row.id })), error: null };
      }
      const matched = rows.filter(matches);
      if (mode === 'one') return { data: matched[0] ?? null, error: null };
      return { data: matched, error: null };
    }

    const api = {
      insert(row: Row) {
        state.op = 'insert';
        state.payload = row;
        return api;
      },
      update(values: Row) {
        state.op = 'update';
        state.payload = values;
        return api;
      },
      delete() {
        state.op = 'delete';
        return api;
      },
      select() {
        return api;
      },
      eq(column: string, value: string) {
        state.filters.push({ column, value });
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      single() {
        return run('one');
      },
      maybeSingle() {
        return run('one');
      },
      then(
        resolve: (value: { data: unknown; error: { message: string } | null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        return run('many').then(resolve, reject);
      },
    };
    return api;
  }

  return {
    client: { from: (table: string) => builder(table) } as unknown as SupabaseClient,
    rows(table: 'creator_profiles' | 'saved_analyses') {
      return tables[table];
    },
    missNextUpdate() {
      missedUpdates += 1;
    },
    failNextInsert() {
      failNextInsert = true;
    },
  };
}
