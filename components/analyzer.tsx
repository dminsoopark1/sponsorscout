'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Clipboard,
  FileText,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  ChevronRight,
  LockKeyhole,
} from 'lucide-react';
import { AnalysisResults } from './analysis-results';
import { EXAMPLE, HLTH_CODE_EXAMPLE, type Analysis } from '../lib/analyzer';

export default function Analyzer({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [offer, setOffer] = useState('');
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  async function analyze() {
    setLoading(true);
    setError('');
    setData(null);
    setSaveMessage('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer }),
      });
      const body = await res.json();
      if (!res.ok) throw Error(body.error || 'Analysis failed');
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!data) return;
    await navigator.clipboard.writeText(data.draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer, analysis: data }),
      });
      const body = await res.json();
      if (!res.ok) throw Error(body.error || 'Could not save this analysis.');
      setSaveMessage('Saved to your dashboard.');
    } catch (caught) {
      setSaveMessage(caught instanceof Error ? caught.message : 'Could not save this analysis.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14} /> MADE FOR INDEPENDENT CREATORS</div>
        <h1>Know your worth.<br /><em>Negotiate with confidence.</em></h1>
        <p>Turn confusing sponsorship offers into clear deal terms, licensing red flags, and a smarter next move.</p>
        <div className="trustline">
          <span><ShieldCheck size={15} />Transparent reasoning</span>
          <span><LockKeyhole size={15} />No account required</span>
          <span><WandSparkles size={15} />AI-assisted analysis</span>
        </div>
      </section>
      <section className="workspace">
        <div className="panel entry">
          <div className="panelhead">
            <div>
              <div className="step">01 / YOUR OFFER</div>
              <h2>Analyze a brand deal</h2>
              <p>Paste the email or brief you received from a brand.</p>
            </div>
            <div className="fileicon"><FileText size={20} /></div>
          </div>
          <label htmlFor="offer">SPONSORSHIP MESSAGE</label>
          <textarea
            id="offer"
            value={offer}
            onChange={(event) => setOffer(event.target.value)}
            placeholder="Hi! We'd love to collaborate on a campaign. We're offering $250 for an Instagram Reel and 3 Story frames, with perpetual paid usage rights..."
            maxLength={12000}
          />
          <div className="inputfooter">
            <span>{offer.length.toLocaleString()} / 12,000 characters</span>
            <div className="example-links">
              <button className="textbtn" onClick={() => setOffer(EXAMPLE)}>Try Postmates example <ChevronRight size={13} /></button>
              <button className="textbtn" onClick={() => setOffer(HLTH_CODE_EXAMPLE)}>Try HLTH Code example <ChevronRight size={13} /></button>
            </div>
          </div>
          <button className="primary" onClick={analyze} disabled={loading || offer.trim().length < 20}>
            {loading ? 'Analyzing offer...' : <>Analyze this offer <ArrowRight size={18} /></>}
          </button>
          {error && <p role="alert" className="error">{error}</p>}
          <div className="disclaimer">
            <ShieldCheck size={16} />
            <span>Demo mode works without an API key. Text is processed for analysis; do not submit confidential details you are not authorized to share.</span>
          </div>
        </div>
        <div className="panel results">
          <div className="panelhead">
            <div>
              <div className="step">02 / DEAL INTELLIGENCE</div>
              <h2>Your analysis</h2>
              <p>Evidence first. Recommendations second.</p>
            </div>
            <span className={data ? 'pill active' : 'pill'}>{data ? (data.mode === 'ai' ? 'CLAUDE AI' : 'RULE-BASED DEMO') : 'AWAITING OFFER'}</span>
          </div>
          {!data ? (
            <div className="empty">
              <div className="emptyicon"><Sparkles size={25} /></div>
              <h3>A clearer deal starts here.</h3>
              <p>Submit your offer to reveal key terms, rights warnings, missing details, and a negotiation draft.</p>
              <div className="emptybars"><div /><div /><div /></div>
            </div>
          ) : (
            <>
              <AnalysisResults data={data} />
              <div className="section draft">
                <div className="drafthead">
                  <h3>Reply draft</h3>
                  <button className="copy" onClick={copy}>{copied ? <Check size={14} /> : <Clipboard size={14} />} {copied ? 'Copied' : 'Copy draft'}</button>
                </div>
                <pre>{data.draft}</pre>
              </div>
              <div className="footnote">{data.mode === 'ai' ? 'Claude AI' : 'Rule-based demo'} analysis · No verified market comparables included · Not legal or financial advice.</div>
              <div className="saverow">
                {isAuthenticated ? (
                  <button type="button" className="copy" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save to dashboard'}</button>
                ) : (
                  <p className="savehint"><Link href="/login?next=/">Sign in</Link> to save this analysis to your dashboard.</p>
                )}
                {saveMessage && <p className="savehint" role="status">{saveMessage}</p>}
              </div>
            </>
          )}
        </div>
      </section>
      <section className="below">
        <div className="belowlabel">HOW SPONSORSCOUT THINKS</div>
        <div className="features">
          <div><span>01</span><h3>Extract the terms</h3><p>Identify deliverables, compensation, usage rights and obligations.</p></div>
          <div><span>02</span><h3>Surface the unknowns</h3><p>Flag perpetual licenses and missing details before suggesting a number.</p></div>
          <div><span>03</span><h3>Negotiate smarter</h3><p>Get a professional draft that protects your leverage and preserves the relationship.</p></div>
        </div>
      </section>
    </main>
  );
}
