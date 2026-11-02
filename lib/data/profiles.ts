import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), 'Display name contains unsupported characters.');

export function optionalDisplayName(value: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  const parsed = displayNameSchema.safeParse(trimmed);
  if (!parsed.success) return { ok: false, error: 'Use a display name of 1–80 characters without line breaks.' };
  return { ok: true, value: parsed.data };
}

export function clientSuppliedIdentity(body: unknown) {
  if (!body || typeof body !== 'object') return false;
  return 'id' in body || 'email' in body || 'userId' in body || 'user_id' in body;
}

export function parseDisplayName(value: unknown) {
  const parsed = displayNameSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false as const, error: 'Use a display name of 1–80 characters without line breaks.' };
  }
  return { ok: true as const, displayName: parsed.data };
}

export function profileUpdate(userId: string, displayName: string, now = new Date().toISOString()) {
  return {
    match: { id: userId },
    values: { display_name: displayName, updated_at: now },
  };
}

export function profileInsert(user: { id: string; email: string | null }, displayName: string | null) {
  return { id: user.id, email: user.email, display_name: displayName };
}

export async function updateDisplayName(supabase: SupabaseClient, userId: string, displayName: string) {
  const payload = profileUpdate(userId, displayName);
  return supabase.from('creator_profiles').update(payload.values).eq('id', payload.match.id).select('id');
}

export async function insertOwnProfile(
  supabase: SupabaseClient,
  user: { id: string; email: string | null },
  displayName: string | null,
) {
  return supabase.from('creator_profiles').insert(profileInsert(user, displayName)).select('id, display_name, created_at').single();
}

export async function getOwnProfile(supabase: SupabaseClient, userId: string) {
  return supabase.from('creator_profiles').select('id, display_name, created_at').eq('id', userId).maybeSingle();
}

function hasRows(data: unknown): boolean {
  return Array.isArray(data) && data.length > 0;
}

export async function saveDisplayName(
  supabase: SupabaseClient,
  user: { id: string; email: string | null },
  displayName: string,
) {
  const updated = await updateDisplayName(supabase, user.id, displayName);
  if (updated.error) return { ok: false as const };
  if (hasRows(updated.data)) return { ok: true as const };
  const inserted = await insertOwnProfile(supabase, user, displayName);
  if (!inserted.error) return { ok: true as const };
  const retry = await updateDisplayName(supabase, user.id, displayName);
  if (!retry.error && hasRows(retry.data)) return { ok: true as const };
  return { ok: false as const };
}
