'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import {
  EVIDENCE_FIELD_LABELS,
  evidenceForField,
  type Analysis,
  type Deliverable,
  type EvidenceField,
} from '../lib/analyzer';

function money(value: number | null) {
  return value === null ? 'Not specified' : `$${value.toLocaleString()}`;
}

function percent(value: number | null) {
  return value === null ? null : `${value}%`;
}

function Fact({
  label,
  value,
  quote,
  hideWhenEmpty = false,
}: {
  label: string;
  value: ReactNode;
  quote: string | null;
  hideWhenEmpty?: boolean;
}) {
  const empty = value == null || value === '';
  if (hideWhenEmpty && empty && !quote) return null;
  return (
    <div className="fact">
      <div className="term">
        <span>{label}</span>
        <b className={value === 'Not specified' || value == null ? 'amber' : undefined}>
          {empty ? 'Not specified' : value}
        </b>
      </div>
      {quote ? (
        <details className="evidence">
          <summary>Evidence</summary>
          <p>“{quote}”</p>
        </details>
      ) : null}
    </div>
  );
}

function deliverableMeta(item: Deliverable) {
  const bits = [
    item.platform,
    item.quantity != null ? `${item.quantity}×` : null,
    item.format,
  ].filter(Boolean);
  return bits.join(' · ');
}

function DeliverableCard({ item }: { item: Deliverable }) {
  return (
    <div className="deliverable">
      <div className="deliverabletitle">
        <Check size={16} />
        <strong>{deliverableMeta(item)}</strong>
      </div>
      {item.requirements && <p className="bodycopy">{item.requirements}</p>}
      <div className="tagrow">
        {item.affiliateLinkRequired && <span className="tag">Affiliate link required</span>}
        {item.couponCodeRequired && <span className="tag">Coupon code required</span>}
        {!item.affiliateLinkRequired && !item.couponCodeRequired && (
          <span className="tag quiet">No affiliate link/code specified</span>
        )}
      </div>
    </div>
  );
}

export function AnalysisResults({ data }: { data: Analysis }) {
  const quote = (field: EvidenceField) => evidenceForField(data, field);
  const [openAll, setOpenAll] = useState(false);

  return (
    <div className="resultcontent">
      <div className={'modebanner ' + (data.mode === 'ai' ? 'ai' : 'demo')}>
        <span className="dot" />
        Analysis mode: {data.mode === 'ai' ? 'Claude AI' : 'Rule-based demo'}
      </div>

      <div className="section first">
        <h3>Deal overview</h3>
        <div className="summary">
          <div className="muted caps">BRAND</div>
          <div className="resultbrand">{data.brand}</div>
          <Fact label="Compensation model" value={data.compensationModelLabel} quote={quote('commission') || quote('giftedProduct') || quote('guaranteedCash')} />
          <Fact label="Guaranteed cash" value={money(data.guaranteedCash)} quote={quote('guaranteedCash')} />
          <Fact
            label="Matches preferred structure"
            value={data.preferenceMatch.matches ? 'Yes — guaranteed flat fee' : 'No — preference mismatch'}
            quote={null}
          />
        </div>
      </div>

      <div className="section">
        <h3>Compensation breakdown</h3>
        <Fact label="Guaranteed payment" value={money(data.guaranteedCash)} quote={quote('guaranteedCash')} />
        <Fact
          label="Affiliate commission"
          value={percent(data.commissionPercent)}
          quote={quote('commission')}
          hideWhenEmpty={!data.commissionPercent && !quote('commission')}
        />
        {data.commissionPercent != null || quote('commissionConditions') ? (
          <Fact
            label="Commission eligibility"
            value={data.commissionConditions ?? 'Not specified'}
            quote={quote('commissionConditions')}
          />
        ) : null}
        <Fact
          label="Follower discount"
          value={percent(data.followerDiscountPercent)}
          quote={quote('followerDiscount')}
          hideWhenEmpty={!data.followerDiscountPercent && !quote('followerDiscount')}
        />
        <Fact
          label="Gifted products"
          value={data.giftedProduct}
          quote={quote('giftedProduct')}
          hideWhenEmpty={!data.giftedProduct && !quote('giftedProduct')}
        />
        <Fact
          label="Future paid opportunities"
          value={
            data.futurePaidOpportunities.mentioned
              ? data.futurePaidOpportunities.summary
              : null
          }
          quote={quote('futurePaidOpportunities')}
          hideWhenEmpty={!data.futurePaidOpportunities.mentioned}
        />
      </div>

      <div className="section">
        <h3>Deliverables</h3>
        {data.deliverableGroups.length === 0 ? (
          <p className="bodycopy">Not specified</p>
        ) : (
          data.deliverableGroups.map((group, index) => (
            <div key={`${group.label}-${index}`}>
              {index > 0 && group.relation === 'or' ? <div className="or-divider">OR</div> : null}
              {index > 0 && group.relation === 'and' ? <div className="and-divider">AND</div> : null}
              <div className="deliverable-group">
                <div className="muted caps">
                  {group.label}
                  {group.items.length > 1 ? ' · ALL REQUIRED (AND)' : ''}
                </div>
                {group.items.map((item, itemIndex) => (
                  <DeliverableCard key={`${item.format}-${itemIndex}`} item={item} />
                ))}
              </div>
            </div>
          ))
        )}
        {quote('deliverables') || quote('affiliateRequirements') ? (
          <details className="evidence" open={openAll}>
            <summary>Deliverable evidence</summary>
            {quote('deliverables') && <p>“{quote('deliverables')}”</p>}
            {quote('affiliateRequirements') && <p>“{quote('affiliateRequirements')}”</p>}
          </details>
        ) : null}
      </div>

      <div className="section">
        <h3>Timeline</h3>
        <Fact label="Deadline" value={data.deadline.display} quote={quote('deadline')} />
      </div>

      <div className="section">
        <h3>Rights & terms</h3>
        <Fact label="Organic usage" value={data.organicUsage.summary} quote={quote('organicUsage')} />
        <Fact label="Paid usage" value={data.paidUsage.summary} quote={quote('paidUsage')} />
        <Fact label="Exclusivity" value={data.exclusivity.summary} quote={quote('exclusivity')} />
      </div>

      <div className="section">
        <h3>Negotiation recommendation</h3>
        {!data.preferenceMatch.matches && (
          <div className="risk high">
            <AlertTriangle size={17} />
            <div>
              <strong>Preference mismatch</strong>
              <p>{data.preferenceMatch.summary}</p>
            </div>
          </div>
        )}
        <p className="bodycopy">{data.recommendation}</p>
      </div>

      <div className="section">
        <div className="drafthead">
          <h3>Evidence</h3>
          <button type="button" className="copy" onClick={() => setOpenAll((value) => !value)}>
            {openAll ? 'Hide quotes' : 'Show all quotes'}
          </button>
        </div>
        <p className="bodycopy">Quoted text is shown next to the matching field only when it appears in the original offer.</p>
        {openAll && (
          <div className="evidence-list">
            {data.evidence
              .filter((item) => item.quote)
              .map((item) => (
                <div className="fact" key={item.field}>
                  <div className="term">
                    <span>{EVIDENCE_FIELD_LABELS[item.field]}</span>
                    <b>“{item.quote}”</b>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {data.risks.length > 0 && (
        <div className="section">
          <h3>Flags to review</h3>
          {data.risks.map((risk, index) => (
            <div className={'risk ' + risk.level} key={index}>
              <AlertTriangle size={17} />
              <div>
                <strong>{risk.title}</strong>
                <p>{risk.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section">
        <h3>Clarify before pricing</h3>
        <ul className="missing">{data.missing.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </div>
  );
}
