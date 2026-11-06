type Row = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryStore() {
  const tables: Record<string, Row[]> = {
    creator_profiles: [],
    social_accounts: [],
    social_metrics: [],
    audience_demographics: [],
    sponsorship_preferences: [],
  };

  function rows(table: string) {
    return tables[table] ?? [];
  }

  function from(table: string) {
    const state = {
      filters: [] as Array<[string, unknown]>,
      orderKey: '',
      ascending: true,
      action: 'select' as 'select' | 'insert' | 'update' | 'delete' | 'upsert',
      payload: null as Row | Row[] | null,
      selectCols: '*',
    };

    const builder = {
      select(cols = '*') {
        state.selectCols = cols;
        return builder;
      },
      insert(payload: Row | Row[]) {
        state.action = 'insert';
        state.payload = payload;
        return builder;
      },
      upsert(payload: Row | Row[]) {
        state.action = 'upsert';
        state.payload = payload;
        return builder;
      },
      update(payload: Row) {
        state.action = 'update';
        state.payload = payload;
        return builder;
      },
      delete() {
        state.action = 'delete';
        return builder;
      },
      eq(key: string, value: unknown) {
        state.filters.push([key, value]);
        return builder;
      },
      order(key: string, options?: { ascending?: boolean }) {
        state.orderKey = key;
        state.ascending = options?.ascending !== false;
        return builder;
      },
      maybeSingle() {
        return run().then((result) => ({
          data: Array.isArray(result.data) ? result.data[0] ?? null : result.data,
          error: result.error,
        }));
      },
      single() {
        return run().then((result) => {
          const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
          return { data, error: data ? result.error : result.error || { message: 'missing' } };
        });
      },
      then(resolve: (value: { data: unknown; error: { message: string } | null }) => unknown, reject?: (reason: unknown) => unknown) {
        return run().then(resolve, reject);
      },
    };

    async function run() {
      const list = tables[table] ?? (tables[table] = []);
      const matches = (row: Row) => state.filters.every(([key, value]) => row[key] === value);

      if (state.action === 'insert') {
        const incoming = Array.isArray(state.payload) ? state.payload : [state.payload!];
        const created = incoming.map((row) => {
          const next: Row = {
            id: row.id ?? crypto.randomUUID(),
            created_at: row.created_at ?? new Date().toISOString(),
            updated_at: row.updated_at ?? new Date().toISOString(),
            ...row,
          };
          if (table === 'social_metrics' || table === 'audience_demographics') {
            const parent = tables.social_accounts.find((account) => account.id === next.social_account_id);
            if (!parent) return { error: { message: 'social account not found' } as const, row: null };
            if (next.user_id && next.user_id !== parent.user_id) {
              return { error: { message: 'cannot attach metrics or demographics to another user\'s social account' } as const, row: null };
            }
            next.user_id = parent.user_id;
            next.collected_at = next.collected_at ?? new Date().toISOString();
            next.source = next.source ?? 'manual';
          }
          return { error: null, row: next };
        });
        const failed = created.find((item) => item.error);
        if (failed?.error) return { data: null, error: failed.error };
        created.forEach((item) => {
          if (item.row) list.push(item.row);
        });
        return { data: created.map((item) => item.row), error: null };
      }

      if (state.action === 'upsert') {
        const incoming = Array.isArray(state.payload) ? state.payload : [state.payload!];
        const saved = incoming.map((row) => {
          const index = list.findIndex((existing) => existing.user_id === row.user_id);
          const next = {
            created_at: row.created_at ?? new Date().toISOString(),
            updated_at: row.updated_at ?? new Date().toISOString(),
            ...row,
          };
          if (index >= 0) list[index] = { ...list[index], ...next };
          else list.push(next);
          return next;
        });
        return { data: saved, error: null };
      }

      if (state.action === 'update') {
        const payload = state.payload as Row;
        for (let index = 0; index < list.length; index += 1) {
          if (matches(list[index])) list[index] = { ...list[index], ...payload, updated_at: payload.updated_at ?? new Date().toISOString() };
        }
        return { data: list.filter(matches), error: null };
      }

      if (state.action === 'delete') {
        const remaining = list.filter((row) => !matches(row));
        const removed = list.filter(matches);
        if (table === 'social_accounts') {
          const ids = new Set(removed.map((row) => row.id));
          tables.social_metrics = tables.social_metrics.filter((row) => !ids.has(row.social_account_id));
          tables.audience_demographics = tables.audience_demographics.filter((row) => !ids.has(row.social_account_id));
        }
        tables[table] = remaining;
        return { data: removed, error: null };
      }

      let selected = list.filter(matches);
      if (state.orderKey) {
        selected = [...selected].sort((a, b) => {
          const left = String(a[state.orderKey] ?? '');
          const right = String(b[state.orderKey] ?? '');
          return state.ascending ? left.localeCompare(right) : right.localeCompare(left);
        });
      }
      return { data: clone(selected), error: null };
    }

    return builder;
  }

  return {
    client: { from },
    rows,
  };
}
