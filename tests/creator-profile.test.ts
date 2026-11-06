import { describe, expect, it } from 'vitest';
import {
  EXAMPLE,
  HLTH_CODE_EXAMPLE,
  analyzeOffer,
  offerMatchesPreferences,
} from '../lib/analyzer';
import {
  EMPTY_PROFILE,
  formatCreatorContext,
  getCreatorProfileBundle,
  parseProfileSave,
  saveCreatorProfileBundle,
} from '../lib/data/creator-profile';
import { createMemoryStore } from './memory-store';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';

const validProfile = {
  displayName: 'Ada',
  creatorName: 'Ada Creates',
  primaryNiche: 'Wellness',
  additionalNiches: ['Recipes'],
  primaryAudienceRegion: 'United States',
  bio: 'Self-reported creator bio.',
  preferences: {
    compensationPreference: 'flat_fee' as const,
    minimumGuaranteedFee: 500,
    preferredCurrency: 'USD',
    acceptsGiftedOnly: false,
    acceptsAffiliateLinks: false,
    acceptsCommissionOnly: false,
  },
  accounts: [
    {
      platform: 'Instagram' as const,
      handle: 'ada.creates',
      profileUrl: 'https://instagram.com/ada.creates',
      metrics: {
        followerCount: 12000,
        medianVideoViews: 2400,
        averageVideoViews: 3000,
        engagementRate: 4.2,
        averageWatchTimeSeconds: 8,
        averageVideoDurationSeconds: 20,
        metricsWindow: 'last 20 posts',
      },
      demographics: {
        countryBreakdown: [{ label: 'US', percent: 70 }],
        ageBreakdown: [{ label: '25-34', percent: 55 }],
        genderBreakdown: [],
      },
    },
    {
      platform: 'TikTok' as const,
      handle: 'adaonTikTok',
      profileUrl: 'https://tiktok.com/@ada',
      metrics: {
        followerCount: 0,
        medianVideoViews: null,
        averageVideoViews: null,
        engagementRate: null,
        averageWatchTimeSeconds: null,
        averageVideoDurationSeconds: null,
        metricsWindow: null,
      },
    },
  ],
};

describe('creator profile validation', () => {
  it('rejects a client-supplied user id and invalid metrics', () => {
    expect(parseProfileSave({ ...validProfile, userId: userB }).ok).toBe(false);
    expect(parseProfileSave({ ...validProfile, accounts: [{ ...validProfile.accounts[0], metrics: { ...validProfile.accounts[0].metrics, followerCount: -4 } }] }).ok).toBe(false);
    expect(parseProfileSave({ ...validProfile, accounts: [{ ...validProfile.accounts[0], metrics: { ...validProfile.accounts[0].metrics, engagementRate: 150 } }] }).ok).toBe(false);
    expect(parseProfileSave({ ...validProfile, accounts: [{ ...validProfile.accounts[0], profileUrl: 'instagram.com/nope' }] }).ok).toBe(false);
  });

  it('treats blank metric fields as missing rather than zero', () => {
    const parsed = parseProfileSave({
      ...validProfile,
      accounts: [{ platform: 'YouTube', handle: 'ada', profileUrl: '', metrics: { followerCount: '', medianVideoViews: '' } }],
      additionalNiches: [],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.accounts[0].metrics?.followerCount).toBeNull();
      expect(parsed.data.accounts[0].profileUrl).toBeNull();
    }
  });
});

describe('creator profile persistence', () => {
  it('saves and reloads identity, multiple accounts, and metrics', async () => {
    const store = createMemoryStore();
    const parsed = parseProfileSave(validProfile);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const saved = await saveCreatorProfileBundle(store.client as never, userA, parsed.data);
    expect(saved.ok && saved.bundle.displayName).toBe('Ada');
    if (!saved.ok) return;
    expect(saved.bundle.accounts).toHaveLength(2);
    const instagram = saved.bundle.accounts.find((account) => account.platform === 'Instagram');
    expect(instagram?.metrics?.followerCount).toBe(12000);
    expect(instagram?.metrics?.source).toBe('manual');
    expect(instagram?.metrics?.collectedAt).toBeTruthy();
    const tiktok = saved.bundle.accounts.find((account) => account.platform === 'TikTok');
    expect(tiktok?.metrics?.followerCount).toBe(0);
    expect(tiktok?.metrics?.medianVideoViews).toBeNull();

    const reloaded = await getCreatorProfileBundle(store.client as never, userA);
    expect(reloaded.bundle.creatorName).toBe('Ada Creates');
    expect(reloaded.bundle.accounts.map((account) => account.handle)).toEqual(['ada.creates', 'adaonTikTok']);
  });

  it('allows an incomplete profile with no accounts', async () => {
    const store = createMemoryStore();
    const parsed = parseProfileSave({
      displayName: 'Ada',
      creatorName: '',
      primaryNiche: '',
      additionalNiches: [],
      primaryAudienceRegion: '',
      bio: '',
      accounts: [],
      preferences: EMPTY_PROFILE.preferences,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const saved = await saveCreatorProfileBundle(store.client as never, userA, parsed.data);
    expect(saved.ok && saved.bundle.accounts).toEqual([]);
    expect(saved.ok && saved.bundle.displayName).toBe('Ada');
  });

  it('keeps one user from reading or writing another user\'s profile', async () => {
    const store = createMemoryStore();
    const parsed = parseProfileSave(validProfile);
    if (!parsed.ok) return;
    await saveCreatorProfileBundle(store.client as never, userA, parsed.data);
    const other = await getCreatorProfileBundle(store.client as never, userB);
    expect(other.bundle.accounts).toEqual([]);
    expect(other.bundle.displayName).toBeNull();

    const stolenId = store.rows('social_accounts')[0].id as string;
    const hijack = parseProfileSave({
      ...validProfile,
      accounts: [{ id: stolenId, platform: 'Instagram', handle: 'stolen', profileUrl: 'https://instagram.com/stolen' }],
    });
    if (!hijack.ok) return;
    const result = await saveCreatorProfileBundle(store.client as never, userB, hijack.data);
    expect(result.ok).toBe(false);
    expect(store.rows('social_accounts').every((row) => row.user_id === userA)).toBe(true);
  });

  it('rejects metrics attached to another user\'s social account', async () => {
    const store = createMemoryStore();
    const parsed = parseProfileSave(validProfile);
    if (!parsed.ok) return;
    await saveCreatorProfileBundle(store.client as never, userA, parsed.data);
    const accountId = store.rows('social_accounts')[0].id;
    const inserted = await store.client.from('social_metrics').insert({
      social_account_id: accountId,
      user_id: userB,
      follower_count: 99,
    });
    expect(inserted.error).toBeTruthy();
  });
});

describe('analysis with and without a creator profile', () => {
  it('keeps guest analysis on the default preference path', () => {
    const analysis = analyzeOffer(HLTH_CODE_EXAMPLE);
    expect(analysis.creatorContextUsed).toBe(false);
    expect(analysis.preferenceMatch.matches).toBe(false);
    expect(formatCreatorContext(null).used).toBe(false);
  });

  it('uses saved profile context without inventing a rate from followers', async () => {
    const store = createMemoryStore();
    const parsed = parseProfileSave({
      ...validProfile,
      preferences: {
        compensationPreference: 'affiliate_allowed',
        minimumGuaranteedFee: null,
        preferredCurrency: 'USD',
        acceptsGiftedOnly: true,
        acceptsAffiliateLinks: true,
        acceptsCommissionOnly: true,
      },
    });
    if (!parsed.ok) return;
    const saved = await saveCreatorProfileBundle(store.client as never, userA, parsed.data);
    if (!saved.ok) return;
    const context = formatCreatorContext(saved.bundle);
    expect(context.used).toBe(true);
    expect(context.prompt).toContain('self-reported');
    expect(context.prompt).toContain('12000');
    expect(context.prompt).not.toMatch(/fair market|should charge \$/i);
    const analysis = analyzeOffer(HLTH_CODE_EXAMPLE, context.preferences, { used: context.used, note: context.note });
    expect(analysis.creatorContextUsed).toBe(true);
    expect(analysis.creatorContextNote).toMatch(/self-reported/i);
    expect(offerMatchesPreferences(analysis, context.preferences)).toBe(true);
    expect(analyzeOffer(EXAMPLE).preferenceMatch.matches).toBe(true);
  });
});
