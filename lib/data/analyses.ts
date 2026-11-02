import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { analysisSchema, type Analysis } from '../analyzer';
import type { VerifiedUser } from '../auth/user';

export const saveRequestSchema = z
  .object({
    offer: z.string().trim().min(20).max(12000),
    analysis: analysisSchema,
  })
  .strict();

export function analysisInsert(
  userId: string,
  input: { offer: string; analysis: Analysis; userId?: string; user_id?: string },
) {
  return {
    user_id: userId,
    offer_text: input.offer,
    analysis: input.analysis,
  };
}

export async function insertSavedAnalysis(
  supabase: SupabaseClient,
  userId: string,
  input: { offer: string; analysis: Analysis },
) {
  const row = analysisInsert(userId, input);
  return supabase.from('saved_analyses').insert(row).select('id').single();
}

export type SavedAnalysisListItem = {
  id: string;
  created_at: string;
  brand: string;
  mode: Analysis['mode'] | null;
};

export async function listSavedAnalyses(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('saved_analyses')
    .select('id, created_at, analysis')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { items: [] as SavedAnalysisListItem[], error: 'unavailable' as const };
  const items = ((data ?? []) as Array<{ id: string; created_at: string; analysis: unknown }>).map((row) => {
    const parsed = analysisSchema.safeParse(row.analysis);
    return {
      id: row.id,
      created_at: row.created_at,
      brand: parsed.success ? parsed.data.brand : 'Saved analysis',
      mode: parsed.success ? parsed.data.mode : null,
    };
  });
  return { items, error: null };
}

export async function getSavedAnalysis(supabase: SupabaseClient, userId: string, analysisId: string) {
  const { data, error } = await supabase
    .from('saved_analyses')
    .select('id, offer_text, analysis, created_at')
    .eq('user_id', userId)
    .eq('id', analysisId)
    .maybeSingle();
  if (error) return { row: null, error: 'unavailable' as const };
  if (!data) return { row: null, error: null };
  const parsed = analysisSchema.safeParse(data.analysis);
  if (!parsed.success) return { row: null, error: 'invalid' as const };
  return {
    row: {
      id: String(data.id),
      offerText: String(data.offer_text),
      createdAt: String(data.created_at),
      analysis: parsed.data,
    },
    error: null,
  };
}

export async function deleteSavedAnalysis(supabase: SupabaseClient, userId: string, analysisId: string) {
  return supabase.from('saved_analyses').delete().eq('user_id', userId).eq('id', analysisId).select('id');
}

export async function createSavedAnalysis(user: VerifiedUser, body: unknown, supabase: SupabaseClient) {
  const parsed = saveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: 'Provide the offer text and the analysis to save.' } };
  }
  const { data, error } = await insertSavedAnalysis(supabase, user.id, parsed.data);
  if (error || !data?.id) return { status: 500, body: { error: 'Unable to save this analysis.' } };
  return { status: 201, body: { id: String(data.id) } };
}
