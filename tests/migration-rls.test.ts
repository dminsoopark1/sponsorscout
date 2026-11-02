import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('../supabase/migrations/20261101120000_creator_profiles_and_saved_analyses.sql', import.meta.url),
  'utf8',
);

describe('row level security migration', () => {
  it('enables and forces row level security on both owner tables', () => {
    for (const table of ['public.creator_profiles', 'public.saved_analyses']) {
      expect(sql).toContain(`alter table ${table} enable row level security;`);
      expect(sql).toContain(`alter table ${table} force row level security;`);
      expect(sql).toContain(`revoke all on table ${table} from public, anon;`);
    }
  });

  it('limits every policy to the signed-in user and the authenticated role', () => {
    const policies = sql.match(/create policy [\s\S]*?;/g) ?? [];
    expect(policies).toHaveLength(6);
    for (const policy of policies) {
      expect(policy).toContain('to authenticated');
      expect(policy).toContain('auth.uid()');
      expect(policy).not.toMatch(/using\s*\(\s*true\s*\)/i);
      expect(policy).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    }
    expect(sql).toContain('using (auth.uid() = id)');
    expect(sql).toContain('with check (auth.uid() = id)');
    expect(sql).toContain('using (auth.uid() = user_id)');
    expect(sql).toContain('with check (auth.uid() = user_id)');
  });

  it('does not grant anonymous access or profile ownership changes', () => {
    expect(sql).not.toMatch(/grant[\s\S]*to anon/i);
    expect(sql).toContain('grant update (display_name, updated_at) on table public.creator_profiles to authenticated;');
    expect(sql).not.toMatch(/grant update \(id/i);
    expect(sql).not.toMatch(/grant update \(email/i);
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = public');
    expect(sql).toContain('revoke all on function public.handle_new_user() from anon, authenticated;');
  });
});
