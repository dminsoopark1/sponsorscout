import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isServiceRoleKey, readSupabaseEnv } from '../lib/supabase/env';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.next' || name === 'tests') return [];
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('secret handling', () => {
  it('recognizes a service-role key and refuses to treat it as publishable', () => {
    const payload = Buffer.from(JSON.stringify({ role: 'service_role', ref: 'example' })).toString('base64url');
    const serviceJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.signature`;
    expect(isServiceRoleKey(serviceJwt)).toBe(true);
    expect(isServiceRoleKey('sb_secret_example')).toBe(true);
    expect(isServiceRoleKey('sb_publishable_example')).toBe(false);

    const result = readSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: serviceJwt,
    });
    expect(result).toEqual({ ok: false, reason: 'service-role' });
  });

  it('reads publishable env vars with static access so the browser bundle can see them', () => {
    const source = readFileSync(path.join(process.cwd(), 'lib/supabase/env.ts'), 'utf8');
    expect(source).toContain('process.env.NEXT_PUBLIC_SUPABASE_URL');
    expect(source).toContain('process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    expect(source).toContain('process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('does not read a service-role variable or put the Anthropic key in client code', () => {
    const files = sourceFiles(process.cwd());
    const offenders = files.filter((file) => {
      const text = readFileSync(file, 'utf8');
      if (text.includes('SUPABASE_SERVICE_ROLE') || text.includes('NEXT_PUBLIC_ANTHROPIC')) return true;
      if (text.includes("'use client'") && (text.includes('ANTHROPIC_API_KEY') || text.includes('service_role'))) return true;
      return false;
    });
    expect(offenders).toEqual([]);
  });
});
