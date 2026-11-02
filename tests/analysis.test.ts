import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  EXAMPLE,
  HLTH_CODE_EXAMPLE,
  analyzeOffer,
  quoteInSource,
  type Analysis,
} from '../lib/analyzer';
import { POST as analyze } from '../app/api/analyze/route';
import { resetRateLimits } from '../lib/rate-limit';

function expectHlthCode(analysis: Analysis) {
  expect(analysis.brand).toBe('HLTH Code');
  expect(analysis.compensationModel).toBe('hybrid');
  expect(analysis.compensationModelLabel).toMatch(/gifted product \+ affiliate commission/i);
  expect(analysis.guaranteedCash).toBeNull();
  expect(analysis.offered).toBeNull();
  expect(analysis.commissionPercent).toBe(20);
  expect(analysis.commissionConditions?.toLowerCase()).toContain('new-customer');
  expect(analysis.followerDiscountPercent).toBe(15);
  expect(analysis.giftedProduct?.toLowerCase()).toMatch(/complimentary.*meal shake|bag of/);
  expect(analysis.futurePaidOpportunities.mentioned).toBe(true);
  expect(analysis.futurePaidOpportunities.guaranteed).toBe(false);
  expect(analysis.deliverableGroups).toHaveLength(1);
  expect(analysis.deliverableGroups[0].relation).not.toBe('or');
  const items = analysis.deliverableGroups[0].items;
  expect(items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ platform: 'Instagram', format: 'Reel', quantity: 1 }),
      expect.objectContaining({
        platform: 'Instagram',
        format: 'Stories',
        quantity: 2,
        affiliateLinkRequired: true,
        couponCodeRequired: true,
      }),
    ]),
  );
  expect(analysis.deadline.display).toBe('Within 14 days after receiving the product.');
  expect(analysis.organicUsage.specified).toBe(false);
  expect(analysis.organicUsage.summary).toBe('Not specified');
  expect(analysis.paidUsage.specified).toBe(false);
  expect(analysis.paidUsage.summary).toBe('Not specified');
  expect(analysis.exclusivity.specified).toBe(false);
  expect(analysis.exclusivity.summary).toBe('Not specified');
  expect(analysis.preferenceMatch.matches).toBe(false);
  expect(analysis.recommendation.toLowerCase()).toMatch(/flat fee|preference mismatch/);
  expect(analysis.recommendation).not.toMatch(/\$\d+/);
  for (const item of analysis.evidence) {
    if (item.quote) expect(quoteInSource(HLTH_CODE_EXAMPLE, item.quote)).toBe(true);
  }
}

function expectPostmates(analysis: Analysis) {
  expect(analysis.brand).toBe('Postmates');
  expect(analysis.compensationModel).toBe('flat_fee');
  expect(analysis.guaranteedCash).toBe(250);
  expect(analysis.offered).toBe(250);
  expect(analysis.deliverableGroups).toHaveLength(2);
  expect(analysis.deliverableGroups[0].relation).toBe('required');
  expect(analysis.deliverableGroups[1].relation).toBe('or');
  expect(analysis.deliverableGroups[0].items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ platform: 'Instagram', format: 'Reel', quantity: 1 }),
      expect.objectContaining({ platform: 'Instagram', format: 'Story set', quantity: 1, requirements: '3 frames' }),
    ]),
  );
  expect(analysis.deliverableGroups[1].items).toEqual([
    expect.objectContaining({ platform: 'TikTok', format: 'Post', quantity: 1 }),
  ]);
  expect(analysis.deliverables.some((line) => /^OR /.test(line))).toBe(true);
  expect(analysis.organicUsage.specified).toBe(true);
  expect(analysis.organicUsage.duration).toBe('perpetual');
  expect(analysis.paidUsage.specified).toBe(true);
  expect(analysis.paidUsage.duration).toBe('perpetual');
  expect(analysis.exclusivity.specified).toBe(false);
  expect(analysis.exclusivity.summary).toBe('Not specified');
  expect(analysis.preferenceMatch.matches).toBe(true);
  for (const item of analysis.evidence) {
    if (item.quote) expect(quoteInSource(EXAMPLE, item.quote)).toBe(true);
  }
}

describe('offer extraction', () => {
  it('extracts the HLTH Code gifted + affiliate structure without inventing cash', () => {
    expectHlthCode(analyzeOffer(HLTH_CODE_EXAMPLE));
  });

  it('preserves Postmates AND/OR deliverable alternatives', () => {
    expectPostmates(analyzeOffer(EXAMPLE));
  });

  it('does not treat a missing payment as $0', () => {
    const analysis = analyzeOffer(HLTH_CODE_EXAMPLE);
    expect(analysis.guaranteedCash).not.toBe(0);
    expect(analysis.offered).toBeNull();
  });
});

describe('POST /api/analyze response shape', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    resetRateLimits();
  });

  async function postOffer(offer: string) {
    const response = await analyze(
      new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.10' },
        body: JSON.stringify({ offer }),
      }),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as Analysis;
  }

  it('returns the HLTH Code API contract in demo mode', async () => {
    const body = await postOffer(HLTH_CODE_EXAMPLE);
    expect(body.mode).toBe('demo');
    expectHlthCode(body);
    expect(body).toMatchObject({
      brand: 'HLTH Code',
      compensationModel: 'hybrid',
      guaranteedCash: null,
      commissionPercent: 20,
      followerDiscountPercent: 15,
      deliverableGroups: expect.any(Array),
      evidence: expect.any(Array),
    });
  });

  it('returns Postmates alternatives in the API response', async () => {
    const body = await postOffer(EXAMPLE);
    expect(body.mode).toBe('demo');
    expectPostmates(body);
    expect(body.deliverableGroups.map((group) => group.relation)).toEqual(['required', 'or']);
  });
});
