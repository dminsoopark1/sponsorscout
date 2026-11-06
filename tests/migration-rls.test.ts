import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('../supabase/migrations/20261106000000_creator_profiles_v06.sql', import.meta.url),
  'utf8',
);

describe('creator profile migration', () => {
  it('creates owner-scoped tables with RLS', () => {
    for (const table of [
      'creator_profiles',
      'social_accounts',
      'social_metrics',
      'audience_demographics',
      'sponsorship_preferences',
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('limits policies to the authenticated owner', () => {
    expect(sql).toContain('to authenticated');
    expect(sql).toContain('auth.uid() = user_id');
    expect(sql).toContain('cannot attach metrics or demographics to another user');
    expect(sql).toContain('revoke all on public.creator_profiles from anon');
  });

  it('keeps a manual/api source for future synchronization', () => {
    expect(sql).toContain("check (source in ('manual', 'api'))");
  });
});
