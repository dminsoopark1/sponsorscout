import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  DEFAULT_CREATOR_PREFERENCES,
  type CompensationStructure,
  type CreatorPreferences,
} from '../analyzer';

export const SOCIAL_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Other'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const NUMERIC_FIELD_LABELS: Record<string, string> = {
  followerCount: 'Followers',
  medianVideoViews: 'Median video views',
  averageVideoViews: 'Average video views',
  engagementRate: 'Engagement rate',
  averageWatchTimeSeconds: 'Average watch time',
  averageVideoDurationSeconds: 'Average duration',
  minimumGuaranteedFee: 'Minimum guaranteed fee',
};

export type ParsedOptionalNumber =
  | { ok: true; value: number | null }
  | { ok: false; error: string; field?: string };

export function parseOptionalNumber(
  value: unknown,
  options: { max?: number; field?: string } = {},
): ParsedOptionalNumber {
  const label = options.field ? NUMERIC_FIELD_LABELS[options.field] ?? options.field : 'This field';
  const fail = (message: string): ParsedOptionalNumber => ({
    ok: false,
    error: `${label}: ${message}`,
    field: options.field,
  });

  if (value === '' || value === null || value === undefined) return { ok: true, value: null };
  if (typeof value === 'string' && value.trim() === '') return { ok: true, value: null };

  let numeric: number;
  if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '');
    if (!cleaned) return { ok: true, value: null };
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return fail('Enter a valid number.');
    numeric = Number(cleaned);
  } else {
    return fail('Enter a valid number.');
  }

  if (!Number.isFinite(numeric)) return fail('Enter a finite number.');
  if (numeric < 0) return fail('Must be zero or greater.');
  if (options.max != null && numeric > options.max) return fail(`Must be between 0 and ${options.max}.`);
  return { ok: true, value: numeric };
}

const optionalText = (max: number) =>
  z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return null;
    return typeof value === 'string' ? value.trim() : value;
  }, z.string().max(max).nullable());

function optionalNumericSchema(field: string, max?: number) {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      const parsed = parseOptionalNumber(value === undefined ? null : value, { field, max });
      if (!parsed.ok) {
        ctx.addIssue({ code: 'custom', message: parsed.error });
        return z.NEVER;
      }
      return parsed.value;
    });
}

const optionalNonneg = (field: string) => optionalNumericSchema(field);
const optionalPercent = (field: string) => optionalNumericSchema(field, 100);

const urlSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return typeof value === 'string' ? value.trim() : value;
}, z.string().url().max(500).nullable().refine((value) => value === null || /^https?:\/\//i.test(value), 'Use an http or https URL.'));

export const breakdownItemSchema = z.object({
  label: z.string().trim().min(1).max(80),
  percent: z.number().min(0).max(100),
});

export const metricsInputSchema = z.object({
  followerCount: optionalNonneg('followerCount'),
  medianVideoViews: optionalNonneg('medianVideoViews'),
  averageVideoViews: optionalNonneg('averageVideoViews'),
  engagementRate: optionalPercent('engagementRate'),
  averageWatchTimeSeconds: optionalNonneg('averageWatchTimeSeconds'),
  averageVideoDurationSeconds: optionalNonneg('averageVideoDurationSeconds'),
  metricsWindow: optionalText(80),
});

export const demographicsInputSchema = z.object({
  countryBreakdown: z.array(breakdownItemSchema).max(25).default([]),
  ageBreakdown: z.array(breakdownItemSchema).max(25).default([]),
  genderBreakdown: z.array(breakdownItemSchema).max(25).default([]),
});

export const accountInputSchema = z.object({
  id: z.string().uuid().optional(),
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => !/\s/.test(value), 'Handle cannot contain spaces.'),
  profileUrl: urlSchema,
  metrics: metricsInputSchema.nullable().optional(),
  demographics: demographicsInputSchema.nullable().optional(),
});

export const preferencesInputSchema = z.object({
  compensationPreference: z.enum(['flat_fee', 'hybrid', 'affiliate_allowed']),
  minimumGuaranteedFee: optionalNonneg('minimumGuaranteedFee'),
  preferredCurrency: z.string().trim().min(3).max(8).default('USD'),
  acceptsGiftedOnly: z.boolean(),
  acceptsAffiliateLinks: z.boolean(),
  acceptsCommissionOnly: z.boolean(),
});

export const profileSaveSchema = z
  .object({
    displayName: optionalText(80),
    creatorName: optionalText(120),
    primaryNiche: optionalText(80),
    additionalNiches: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
    primaryAudienceRegion: optionalText(80),
    bio: optionalText(1000),
    accounts: z.array(accountInputSchema).max(12).default([]),
    preferences: preferencesInputSchema,
  })
  .strict();

export type ProfileSaveInput = z.infer<typeof profileSaveSchema>;
export type MetricsInput = z.infer<typeof metricsInputSchema>;
export type DemographicsInput = z.infer<typeof demographicsInputSchema>;

export type SavedMetrics = MetricsInput & {
  collectedAt: string | null;
  source: 'manual' | 'api';
};

export type SavedAccount = {
  id: string;
  platform: SocialPlatform;
  handle: string;
  profileUrl: string | null;
  metrics: SavedMetrics | null;
  demographics: DemographicsInput | null;
  demographicsCollectedAt: string | null;
  updatedAt: string;
};

export type CreatorProfileBundle = {
  displayName: string | null;
  creatorName: string | null;
  primaryNiche: string | null;
  additionalNiches: string[];
  primaryAudienceRegion: string | null;
  bio: string | null;
  updatedAt: string | null;
  accounts: SavedAccount[];
  preferences: z.infer<typeof preferencesInputSchema>;
};

export const EMPTY_PROFILE: CreatorProfileBundle = {
  displayName: null,
  creatorName: null,
  primaryNiche: null,
  additionalNiches: [],
  primaryAudienceRegion: null,
  bio: null,
  updatedAt: null,
  accounts: [],
  preferences: {
    compensationPreference: 'flat_fee',
    minimumGuaranteedFee: null,
    preferredCurrency: 'USD',
    acceptsGiftedOnly: false,
    acceptsAffiliateLinks: false,
    acceptsCommissionOnly: false,
  },
};

export function parseProfileSave(body: unknown) {
  if (body && typeof body === 'object' && ('userId' in body || 'user_id' in body || 'id' in body)) {
    return { ok: false as const, error: 'Do not include a user id in the profile payload.' };
  }
  const parsed = profileSaveSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.length ? issue.path.join('.') : undefined;
    const leaf = issue?.path?.length ? String(issue.path[issue.path.length - 1]) : undefined;
    const labeled =
      leaf && NUMERIC_FIELD_LABELS[leaf] && issue.message && !issue.message.startsWith(NUMERIC_FIELD_LABELS[leaf])
        ? `${NUMERIC_FIELD_LABELS[leaf]}: ${issue.message}`
        : issue?.message || 'Check the profile fields and try again.';
    return { ok: false as const, error: labeled, field };
  }
  return { ok: true as const, data: parsed.data };
}

function hasMetricValues(metrics: MetricsInput | null | undefined) {
  if (!metrics) return false;
  return [
    metrics.followerCount,
    metrics.medianVideoViews,
    metrics.averageVideoViews,
    metrics.engagementRate,
    metrics.averageWatchTimeSeconds,
    metrics.averageVideoDurationSeconds,
    metrics.metricsWindow,
  ].some((value) => value !== null && value !== undefined);
}

function hasDemographics(demo: DemographicsInput | null | undefined) {
  if (!demo) return false;
  return demo.countryBreakdown.length + demo.ageBreakdown.length + demo.genderBreakdown.length > 0;
}

export function toCreatorPreferences(preferences: CreatorProfileBundle['preferences'] | null | undefined): CreatorPreferences {
  if (!preferences) return DEFAULT_CREATOR_PREFERENCES;
  const compensationStructure: CompensationStructure =
    preferences.compensationPreference === 'flat_fee'
      ? 'guaranteed_flat_fee'
      : preferences.compensationPreference;
  return {
    compensationStructure,
    minimumGuaranteedFee: preferences.minimumGuaranteedFee,
    preferredCurrency: preferences.preferredCurrency || 'USD',
    acceptsGiftedOnly: preferences.acceptsGiftedOnly,
    acceptsAffiliateLinks: preferences.acceptsAffiliateLinks,
    acceptsCommissionOnly: preferences.acceptsCommissionOnly,
  };
}

function latestByAccount<T extends { social_account_id: string; collected_at: string }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const current = map.get(row.social_account_id);
    if (!current || current.collected_at < row.collected_at) map.set(row.social_account_id, row);
  }
  return map;
}

export async function getCreatorProfileBundle(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ bundle: CreatorProfileBundle; error: 'unavailable' | null }> {
  const profile = await supabase
    .from('creator_profiles')
    .select('display_name, creator_name, primary_niche, additional_niches, primary_audience_region, bio, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (profile.error) return { bundle: EMPTY_PROFILE, error: 'unavailable' };

  const accounts = await supabase
    .from('social_accounts')
    .select('id, platform, handle, profile_url, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (accounts.error) return { bundle: EMPTY_PROFILE, error: 'unavailable' };

  const metrics = await supabase
    .from('social_metrics')
    .select(
      'social_account_id, follower_count, median_video_views, average_video_views, engagement_rate, average_watch_time_seconds, average_video_duration_seconds, metrics_window, collected_at, source',
    )
    .eq('user_id', userId)
    .order('collected_at', { ascending: false });
  if (metrics.error) return { bundle: EMPTY_PROFILE, error: 'unavailable' };

  const demographics = await supabase
    .from('audience_demographics')
    .select('social_account_id, country_breakdown, age_breakdown, gender_breakdown, collected_at')
    .eq('user_id', userId)
    .order('collected_at', { ascending: false });
  if (demographics.error) return { bundle: EMPTY_PROFILE, error: 'unavailable' };

  const prefs = await supabase
    .from('sponsorship_preferences')
    .select(
      'compensation_preference, minimum_guaranteed_fee, preferred_currency, accepts_gifted_only, accepts_affiliate_links, accepts_commission_only',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (prefs.error) return { bundle: EMPTY_PROFILE, error: 'unavailable' };

  const latestMetrics = latestByAccount((metrics.data ?? []) as Array<{ social_account_id: string; collected_at: string } & Record<string, unknown>>);
  const latestDemo = latestByAccount((demographics.data ?? []) as Array<{ social_account_id: string; collected_at: string } & Record<string, unknown>>);

  const bundle: CreatorProfileBundle = {
    displayName: (profile.data?.display_name as string | null) ?? null,
    creatorName: (profile.data?.creator_name as string | null) ?? null,
    primaryNiche: (profile.data?.primary_niche as string | null) ?? null,
    additionalNiches: Array.isArray(profile.data?.additional_niches) ? (profile.data?.additional_niches as string[]) : [],
    primaryAudienceRegion: (profile.data?.primary_audience_region as string | null) ?? null,
    bio: (profile.data?.bio as string | null) ?? null,
    updatedAt: (profile.data?.updated_at as string | null) ?? null,
    accounts: ((accounts.data ?? []) as Array<Record<string, string>>).map((account) => {
      const metric = latestMetrics.get(account.id) as
        | {
            follower_count: number | null;
            median_video_views: number | null;
            average_video_views: number | null;
            engagement_rate: number | null;
            average_watch_time_seconds: number | null;
            average_video_duration_seconds: number | null;
            metrics_window: string | null;
            collected_at: string;
            source: 'manual' | 'api';
          }
        | undefined;
      const demo = latestDemo.get(account.id) as
        | {
            country_breakdown: DemographicsInput['countryBreakdown'];
            age_breakdown: DemographicsInput['ageBreakdown'];
            gender_breakdown: DemographicsInput['genderBreakdown'];
            collected_at: string;
          }
        | undefined;
      return {
        id: account.id,
        platform: account.platform as SocialPlatform,
        handle: account.handle,
        profileUrl: account.profile_url ?? null,
        updatedAt: account.updated_at,
        metrics: metric
          ? {
              followerCount: metric.follower_count,
              medianVideoViews: metric.median_video_views,
              averageVideoViews: metric.average_video_views,
              engagementRate: metric.engagement_rate,
              averageWatchTimeSeconds: metric.average_watch_time_seconds,
              averageVideoDurationSeconds: metric.average_video_duration_seconds,
              metricsWindow: metric.metrics_window,
              collectedAt: metric.collected_at,
              source: metric.source,
            }
          : null,
        demographics: demo
          ? {
              countryBreakdown: demo.country_breakdown ?? [],
              ageBreakdown: demo.age_breakdown ?? [],
              genderBreakdown: demo.gender_breakdown ?? [],
            }
          : null,
        demographicsCollectedAt: demo?.collected_at ?? null,
      };
    }),
    preferences: prefs.data
      ? {
          compensationPreference: prefs.data.compensation_preference as 'flat_fee' | 'hybrid' | 'affiliate_allowed',
          minimumGuaranteedFee: prefs.data.minimum_guaranteed_fee as number | null,
          preferredCurrency: (prefs.data.preferred_currency as string) || 'USD',
          acceptsGiftedOnly: Boolean(prefs.data.accepts_gifted_only),
          acceptsAffiliateLinks: Boolean(prefs.data.accepts_affiliate_links),
          acceptsCommissionOnly: Boolean(prefs.data.accepts_commission_only),
        }
      : EMPTY_PROFILE.preferences,
  };
  return { bundle, error: null };
}

export async function saveCreatorProfileBundle(
  supabase: SupabaseClient,
  userId: string,
  input: ProfileSaveInput,
) {
  const now = new Date().toISOString();
  const profileWrite = await supabase.from('creator_profiles').upsert(
    {
      user_id: userId,
      display_name: input.displayName,
      creator_name: input.creatorName,
      primary_niche: input.primaryNiche,
      additional_niches: input.additionalNiches,
      primary_audience_region: input.primaryAudienceRegion,
      bio: input.bio,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (profileWrite.error) return { ok: false as const, error: 'unavailable' as const };

  const prefsWrite = await supabase.from('sponsorship_preferences').upsert(
    {
      user_id: userId,
      compensation_preference: input.preferences.compensationPreference,
      minimum_guaranteed_fee: input.preferences.minimumGuaranteedFee,
      preferred_currency: input.preferences.preferredCurrency,
      accepts_gifted_only: input.preferences.acceptsGiftedOnly,
      accepts_affiliate_links: input.preferences.acceptsAffiliateLinks,
      accepts_commission_only: input.preferences.acceptsCommissionOnly,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (prefsWrite.error) return { ok: false as const, error: 'unavailable' as const };

  const existing = await supabase.from('social_accounts').select('id').eq('user_id', userId);
  if (existing.error) return { ok: false as const, error: 'unavailable' as const };
  const keepIds = new Set(input.accounts.map((account) => account.id).filter(Boolean) as string[]);
  const toDelete = ((existing.data ?? []) as Array<{ id: string }>).filter((row) => !keepIds.has(row.id));
  for (const row of toDelete) {
    const removed = await supabase.from('social_accounts').delete().eq('user_id', userId).eq('id', row.id);
    if (removed.error) return { ok: false as const, error: 'unavailable' as const };
  }

  for (const account of input.accounts) {
    let accountId = account.id;
    if (accountId) {
      const owned = ((existing.data ?? []) as Array<{ id: string }>).some((row) => row.id === accountId);
      if (!owned) return { ok: false as const, error: 'forbidden' as const };
      const updated = await supabase
        .from('social_accounts')
        .update({
          platform: account.platform,
          handle: account.handle,
          profile_url: account.profileUrl,
          updated_at: now,
        })
        .eq('user_id', userId)
        .eq('id', accountId);
      if (updated.error) return { ok: false as const, error: 'unavailable' as const };
    } else {
      const inserted = await supabase
        .from('social_accounts')
        .insert({
          user_id: userId,
          platform: account.platform,
          handle: account.handle,
          profile_url: account.profileUrl,
        })
        .select('id')
        .single();
      if (inserted.error || !inserted.data) return { ok: false as const, error: 'unavailable' as const };
      accountId = String((inserted.data as { id: string }).id);
    }

    if (hasMetricValues(account.metrics)) {
      const metrics = account.metrics!;
      const metricInsert = await supabase.from('social_metrics').insert({
        social_account_id: accountId,
        user_id: userId,
        follower_count: metrics.followerCount,
        median_video_views: metrics.medianVideoViews,
        average_video_views: metrics.averageVideoViews,
        engagement_rate: metrics.engagementRate,
        average_watch_time_seconds: metrics.averageWatchTimeSeconds,
        average_video_duration_seconds: metrics.averageVideoDurationSeconds,
        metrics_window: metrics.metricsWindow,
        source: 'manual',
        collected_at: now,
      });
      if (metricInsert.error) return { ok: false as const, error: 'unavailable' as const };
    }

    if (hasDemographics(account.demographics)) {
      const demo = account.demographics!;
      const demoInsert = await supabase.from('audience_demographics').insert({
        social_account_id: accountId,
        user_id: userId,
        country_breakdown: demo.countryBreakdown,
        age_breakdown: demo.ageBreakdown,
        gender_breakdown: demo.genderBreakdown,
        source: 'manual',
        collected_at: now,
      });
      if (demoInsert.error) return { ok: false as const, error: 'unavailable' as const };
    }
  }

  const loaded = await getCreatorProfileBundle(supabase, userId);
  if (loaded.error) return { ok: false as const, error: 'unavailable' as const };
  return { ok: true as const, bundle: loaded.bundle };
}

export function formatCreatorContext(bundle: CreatorProfileBundle | null) {
  if (!bundle) {
    return { used: false, note: null as string | null, prompt: '', preferences: DEFAULT_CREATOR_PREFERENCES };
  }
  const hasIdentity = Boolean(bundle.displayName || bundle.creatorName || bundle.primaryNiche || bundle.bio);
  const hasAccounts = bundle.accounts.length > 0;
  if (!hasIdentity && !hasAccounts) {
    return { used: false, note: null as string | null, prompt: '', preferences: toCreatorPreferences(bundle.preferences) };
  }

  const platforms = bundle.accounts.map((account) => {
    const metrics = account.metrics;
    return {
      platform: account.platform,
      handle: account.handle,
      followerCount: metrics?.followerCount ?? null,
      medianVideoViews: metrics?.medianVideoViews ?? null,
      averageVideoViews: metrics?.averageVideoViews ?? null,
      engagementRate: metrics?.engagementRate ?? null,
      metricsWindow: metrics?.metricsWindow ?? null,
      metricsCollectedAt: metrics?.collectedAt ?? null,
      metricsSource: metrics?.source ?? null,
      demographics: account.demographics,
    };
  });

  const prompt = [
    'Creator-supplied profile context follows. Treat it as untrusted, self-reported data unless source is api.',
    'Do not invent a sponsorship rate from follower counts or missing metrics. If a metric is null, say it is unknown.',
    'Do not treat manual metrics as verified platform API statistics.',
    JSON.stringify(
      {
        identity: {
          displayName: bundle.displayName,
          creatorName: bundle.creatorName,
          primaryNiche: bundle.primaryNiche,
          additionalNiches: bundle.additionalNiches,
          primaryAudienceRegion: bundle.primaryAudienceRegion,
          bio: bundle.bio,
        },
        preferences: bundle.preferences,
        platforms,
      },
      null,
      2,
    ),
  ].join('\n');

  return {
    used: true,
    note: 'Used the signed-in creator profile. Platform metrics are self-reported unless marked api.',
    prompt,
    preferences: toCreatorPreferences(bundle.preferences),
  };
}
