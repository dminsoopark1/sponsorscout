'use client';

import { useMemo, useState } from 'react';
import {
  parseOptionalNumber,
  SOCIAL_PLATFORMS,
  type CreatorProfileBundle,
  type DemographicsInput,
  type SavedAccount,
  type SocialPlatform,
} from '../lib/data/creator-profile';

type AccountDraft = {
  key: string;
  id?: string;
  platform: SocialPlatform;
  handle: string;
  profileUrl: string;
  followerCount: string;
  medianVideoViews: string;
  averageVideoViews: string;
  engagementRate: string;
  averageWatchTimeSeconds: string;
  averageVideoDurationSeconds: string;
  metricsWindow: string;
  metricsCollectedAt: string | null;
  country: string;
  age: string;
  gender: string;
};

function toDraft(account?: SavedAccount): AccountDraft {
  return {
    key: account?.id ?? crypto.randomUUID(),
    id: account?.id,
    platform: account?.platform ?? 'Instagram',
    handle: account?.handle ?? '',
    profileUrl: account?.profileUrl ?? '',
    followerCount: account?.metrics?.followerCount == null ? '' : String(account.metrics.followerCount),
    medianVideoViews: account?.metrics?.medianVideoViews == null ? '' : String(account.metrics.medianVideoViews),
    averageVideoViews: account?.metrics?.averageVideoViews == null ? '' : String(account.metrics.averageVideoViews),
    engagementRate: account?.metrics?.engagementRate == null ? '' : String(account.metrics.engagementRate),
    averageWatchTimeSeconds:
      account?.metrics?.averageWatchTimeSeconds == null ? '' : String(account.metrics.averageWatchTimeSeconds),
    averageVideoDurationSeconds:
      account?.metrics?.averageVideoDurationSeconds == null ? '' : String(account.metrics.averageVideoDurationSeconds),
    metricsWindow: account?.metrics?.metricsWindow ?? '',
    metricsCollectedAt: account?.metrics?.collectedAt ?? null,
    country: formatBreakdown(account?.demographics?.countryBreakdown),
    age: formatBreakdown(account?.demographics?.ageBreakdown),
    gender: formatBreakdown(account?.demographics?.genderBreakdown),
  };
}

function formatBreakdown(items?: Array<{ label: string; percent: number }>) {
  if (!items?.length) return '';
  return items.map((item) => `${item.label}: ${item.percent}`).join(', ');
}

function parseBreakdown(value: string): DemographicsInput['countryBreakdown'] {
  if (!value.trim()) return [];
  return value.split(',').flatMap((part) => {
    const [label, percentRaw] = part.split(':').map((piece) => piece.trim());
    if (!label) return [];
    const percent = Number(percentRaw);
    if (!Number.isFinite(percent)) return [];
    return [{ label, percent }];
  });
}

function numberField(value: string, field: string, percent = false) {
  const parsed = parseOptionalNumber(value, { field, max: percent ? 100 : undefined });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

export function CreatorProfileForm({
  initial,
  disabled,
}: {
  initial: CreatorProfileBundle;
  disabled?: boolean;
}) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? '');
  const [creatorName, setCreatorName] = useState(initial.creatorName ?? '');
  const [primaryNiche, setPrimaryNiche] = useState(initial.primaryNiche ?? '');
  const [additionalNiches, setAdditionalNiches] = useState(initial.additionalNiches.join(', '));
  const [region, setRegion] = useState(initial.primaryAudienceRegion ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [accounts, setAccounts] = useState<AccountDraft[]>(
    initial.accounts.length ? initial.accounts.map((account) => toDraft(account)) : [],
  );
  const [compensation, setCompensation] = useState(initial.preferences.compensationPreference);
  const [minimumFee, setMinimumFee] = useState(
    initial.preferences.minimumGuaranteedFee == null ? '' : String(initial.preferences.minimumGuaranteedFee),
  );
  const [currency, setCurrency] = useState(initial.preferences.preferredCurrency || 'USD');
  const [acceptsGiftedOnly, setAcceptsGiftedOnly] = useState(initial.preferences.acceptsGiftedOnly);
  const [acceptsAffiliateLinks, setAcceptsAffiliateLinks] = useState(initial.preferences.acceptsAffiliateLinks);
  const [acceptsCommissionOnly, setAcceptsCommissionOnly] = useState(initial.preferences.acceptsCommissionOnly);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);

  const lastUpdated = useMemo(() => {
    if (!updatedAt) return 'Not saved yet';
    return new Date(updatedAt).toLocaleString();
  }, [updatedAt]);

  function updateAccount(key: string, patch: Partial<AccountDraft>) {
    setAccounts((current) => current.map((account) => (account.key === key ? { ...account, ...patch } : account)));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
      displayName,
      creatorName,
      primaryNiche,
      additionalNiches: additionalNiches
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      primaryAudienceRegion: region,
      bio,
      preferences: {
        compensationPreference: compensation,
        minimumGuaranteedFee: numberField(minimumFee, 'minimumGuaranteedFee'),
        preferredCurrency: currency,
        acceptsGiftedOnly,
        acceptsAffiliateLinks,
        acceptsCommissionOnly,
      },
      accounts: accounts.map((account) => ({
        id: account.id,
        platform: account.platform,
        handle: account.handle,
        profileUrl: account.profileUrl,
        metrics: {
          followerCount: numberField(account.followerCount, 'followerCount'),
          medianVideoViews: numberField(account.medianVideoViews, 'medianVideoViews'),
          averageVideoViews: numberField(account.averageVideoViews, 'averageVideoViews'),
          engagementRate: numberField(account.engagementRate, 'engagementRate', true),
          averageWatchTimeSeconds: numberField(account.averageWatchTimeSeconds, 'averageWatchTimeSeconds'),
          averageVideoDurationSeconds: numberField(account.averageVideoDurationSeconds, 'averageVideoDurationSeconds'),
          metricsWindow: account.metricsWindow,
        },
        demographics: {
          countryBreakdown: parseBreakdown(account.country),
          ageBreakdown: parseBreakdown(account.age),
          genderBreakdown: parseBreakdown(account.gender),
        },
      })),
    };
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'Could not save this profile.');
      setMessage('Creator profile saved.');
      setUpdatedAt(body.updatedAt);
      if (Array.isArray(body.accounts)) {
        setAccounts(body.accounts.map((account: SavedAccount) => toDraft(account)));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="profileform" onSubmit={onSubmit}>
      <p className="savehint">Profile last updated: {lastUpdated}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="note" role="status">{message}</p>}

      <section className="authcard profilesection">
        <div className="step">A / CREATOR IDENTITY</div>
        <h2>Who you are</h2>
        <div className="formgrid">
          <label className="field"><span>DISPLAY NAME</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} disabled={disabled} /></label>
          <label className="field"><span>CREATOR / BRAND NAME</span><input value={creatorName} onChange={(event) => setCreatorName(event.target.value)} maxLength={120} disabled={disabled} /></label>
          <label className="field"><span>PRIMARY NICHE</span><input value={primaryNiche} onChange={(event) => setPrimaryNiche(event.target.value)} maxLength={80} disabled={disabled} /></label>
          <label className="field"><span>ADDITIONAL NICHES</span><input value={additionalNiches} onChange={(event) => setAdditionalNiches(event.target.value)} placeholder="Wellness, recipes" disabled={disabled} /></label>
          <label className="field"><span>PRIMARY AUDIENCE REGION</span><input value={region} onChange={(event) => setRegion(event.target.value)} maxLength={80} disabled={disabled} /></label>
        </div>
        <label className="field"><span>BIO</span><textarea className="shortarea" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={1000} disabled={disabled} /></label>
      </section>

      <section className="authcard profilesection">
        <div className="sectionhead">
          <div>
            <div className="step">B / SOCIAL MEDIA ACCOUNTS</div>
            <h2>Platforms</h2>
            <p className="authlead">Add each platform separately. Handles can be edited or removed later.</p>
          </div>
          <button
            type="button"
            className="copy"
            disabled={disabled}
            onClick={() => setAccounts((current) => [...current, toDraft()])}
          >
            Add account
          </button>
        </div>
        {accounts.length === 0 && <p className="note">No social accounts yet. Add Instagram, TikTok, YouTube, or Other.</p>}
        {accounts.map((account, index) => (
          <div className="accountcard" key={account.key}>
            <div className="sectionhead">
              <strong>Account {index + 1}</strong>
              <button type="button" className="textbtn" disabled={disabled} onClick={() => setAccounts((current) => current.filter((item) => item.key !== account.key))}>Remove</button>
            </div>
            <div className="formgrid">
              <label className="field">
                <span>PLATFORM</span>
                <select value={account.platform} disabled={disabled} onChange={(event) => updateAccount(account.key, { platform: event.target.value as SocialPlatform })}>
                  {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
                </select>
              </label>
              <label className="field"><span>HANDLE</span><input value={account.handle} disabled={disabled} onChange={(event) => updateAccount(account.key, { handle: event.target.value })} placeholder="@handle" /></label>
              <label className="field"><span>PROFILE URL</span><input value={account.profileUrl} disabled={disabled} onChange={(event) => updateAccount(account.key, { profileUrl: event.target.value })} placeholder="https://" /></label>
            </div>

            <h3>C / Platform analytics</h3>
            <p className="savehint">
              {account.metricsCollectedAt
                ? `Last updated ${new Date(account.metricsCollectedAt).toLocaleString()} · self-reported`
                : 'No metrics saved yet for this platform.'}
            </p>
            <div className="formgrid">
              <label className="field"><span>FOLLOWERS</span><input inputMode="numeric" value={account.followerCount} disabled={disabled} onChange={(event) => updateAccount(account.key, { followerCount: event.target.value })} placeholder="Leave blank if unknown" /></label>
              <label className="field"><span>MEDIAN VIDEO VIEWS</span><input inputMode="numeric" value={account.medianVideoViews} disabled={disabled} onChange={(event) => updateAccount(account.key, { medianVideoViews: event.target.value })} /></label>
              <label className="field"><span>AVERAGE VIDEO VIEWS</span><input inputMode="numeric" value={account.averageVideoViews} disabled={disabled} onChange={(event) => updateAccount(account.key, { averageVideoViews: event.target.value })} /></label>
              <label className="field"><span>ENGAGEMENT RATE %</span><input inputMode="decimal" value={account.engagementRate} disabled={disabled} onChange={(event) => updateAccount(account.key, { engagementRate: event.target.value })} /></label>
              <label className="field"><span>AVG WATCH TIME (SEC)</span><input inputMode="decimal" value={account.averageWatchTimeSeconds} disabled={disabled} onChange={(event) => updateAccount(account.key, { averageWatchTimeSeconds: event.target.value })} /></label>
              <label className="field"><span>AVG DURATION (SEC)</span><input inputMode="decimal" value={account.averageVideoDurationSeconds} disabled={disabled} onChange={(event) => updateAccount(account.key, { averageVideoDurationSeconds: event.target.value })} /></label>
              <label className="field"><span>METRICS WINDOW</span><input value={account.metricsWindow} disabled={disabled} onChange={(event) => updateAccount(account.key, { metricsWindow: event.target.value })} placeholder="last 20 posts" /></label>
            </div>

            <h3>D / Audience demographics (optional)</h3>
            <p className="savehint">Use `label: percent` pairs, comma-separated. Example: US: 70, CA: 30</p>
            <label className="field"><span>COUNTRY / REGION</span><input value={account.country} disabled={disabled} onChange={(event) => updateAccount(account.key, { country: event.target.value })} /></label>
            <label className="field"><span>AGE</span><input value={account.age} disabled={disabled} onChange={(event) => updateAccount(account.key, { age: event.target.value })} placeholder="18-24: 40, 25-34: 60" /></label>
            <label className="field"><span>GENDER</span><input value={account.gender} disabled={disabled} onChange={(event) => updateAccount(account.key, { gender: event.target.value })} /></label>
          </div>
        ))}
      </section>

      <section className="authcard profilesection">
        <div className="step">E / SPONSORSHIP PREFERENCES</div>
        <h2>What you will accept</h2>
        <label className="field">
          <span>COMPENSATION PREFERENCE</span>
          <select value={compensation} disabled={disabled} onChange={(event) => setCompensation(event.target.value as typeof compensation)}>
            <option value="flat_fee">Guaranteed flat fee only</option>
            <option value="hybrid">Hybrid (fee plus usage or affiliate)</option>
            <option value="affiliate_allowed">Affiliate-friendly</option>
          </select>
        </label>
        <div className="formgrid">
          <label className="field"><span>MINIMUM GUARANTEED FEE</span><input inputMode="decimal" value={minimumFee} disabled={disabled} onChange={(event) => setMinimumFee(event.target.value)} placeholder="Optional" /></label>
          <label className="field"><span>CURRENCY</span><input value={currency} disabled={disabled} onChange={(event) => setCurrency(event.target.value)} maxLength={8} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={acceptsGiftedOnly} disabled={disabled} onChange={(event) => setAcceptsGiftedOnly(event.target.checked)} /> Accepts gifted-only collaborations</label>
        <label className="check"><input type="checkbox" checked={acceptsAffiliateLinks} disabled={disabled} onChange={(event) => setAcceptsAffiliateLinks(event.target.checked)} /> Accepts affiliate links</label>
        <label className="check"><input type="checkbox" checked={acceptsCommissionOnly} disabled={disabled} onChange={(event) => setAcceptsCommissionOnly(event.target.checked)} /> Accepts commission-only deals</label>
      </section>

      <button className="primary" type="submit" disabled={disabled || saving}>{saving ? 'Saving profile...' : 'Save creator profile'}</button>
    </form>
  );
}
