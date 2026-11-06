import { z } from 'zod';

export const EXAMPLE = `Hi! We're reaching out about an upcoming Postmates creator campaign. We'd love to offer $250 for one Instagram Reel and three Instagram Story frames OR one TikTok post. We require organic usage rights in perpetuity and paid advertising usage rights in perpetuity. Please let us know if you're interested!`;

export const HLTH_CODE_EXAMPLE = `Hi! We're HLTH Code. We'd love to send you one complimentary bag of our meal shake. In exchange, please create 1 Instagram Reel AND 2 Instagram Stories. Please include your unique affiliate link and coupon code in the Stories. You'll earn a 20% commission on qualifying new-customer orders, and your followers receive 15% off. Please post within 14 days of receiving the product. There may be opportunities for future paid partnerships, but those are not guaranteed.`;

export type CompensationStructure = 'guaranteed_flat_fee' | 'flat_fee' | 'hybrid' | 'affiliate_allowed';

export type CreatorPreferences = {
  compensationStructure: CompensationStructure;
  minimumGuaranteedFee: number | null;
  preferredCurrency: string;
  acceptsGiftedOnly: boolean;
  acceptsAffiliateLinks: boolean;
  acceptsCommissionOnly: boolean;
};

export const DEFAULT_CREATOR_PREFERENCES: CreatorPreferences = {
  compensationStructure: 'guaranteed_flat_fee',
  minimumGuaranteedFee: null,
  preferredCurrency: 'USD',
  acceptsGiftedOnly: false,
  acceptsAffiliateLinks: false,
  acceptsCommissionOnly: false,
};

export type AnalysisCreatorContext = {
  used: boolean;
  note: string | null;
};

const platformSchema = z.enum(['Instagram', 'TikTok', 'YouTube', 'Other', 'Unspecified']);
const compensationModelSchema = z.enum(['flat_fee', 'affiliate', 'gifted', 'hybrid', 'unknown']);
const evidenceFieldSchema = z.enum([
  'brand',
  'guaranteedCash',
  'commission',
  'commissionConditions',
  'followerDiscount',
  'giftedProduct',
  'futurePaidOpportunities',
  'deliverables',
  'affiliateRequirements',
  'deadline',
  'organicUsage',
  'paidUsage',
  'exclusivity',
]);

export const evidenceItemSchema = z.object({
  field: evidenceFieldSchema,
  quote: z.string().nullable(),
});

export const deliverableSchema = z.object({
  platform: platformSchema,
  format: z.string(),
  quantity: z.number().nullable(),
  requirements: z.string().nullable(),
  affiliateLinkRequired: z.boolean(),
  couponCodeRequired: z.boolean(),
});

export const deliverableGroupSchema = z.object({
  label: z.string(),
  relation: z.enum(['required', 'and', 'or']),
  items: z.array(deliverableSchema).min(1),
});

export const rightsTermSchema = z.object({
  specified: z.boolean(),
  duration: z.string().nullable(),
  summary: z.string(),
});

export const deadlineSchema = z.object({
  relativeDuration: z.string().nullable(),
  triggeringEvent: z.string().nullable(),
  absoluteDate: z.string().nullable(),
  display: z.string(),
});

export const extractedAnalysisSchema = z.object({
  brand: z.string(),
  compensationModel: compensationModelSchema,
  guaranteedCash: z.number().nullable(),
  commissionPercent: z.number().nullable(),
  commissionConditions: z.string().nullable(),
  followerDiscountPercent: z.number().nullable(),
  giftedProduct: z.string().nullable(),
  futurePaidOpportunities: z.object({
    mentioned: z.boolean(),
    guaranteed: z.boolean(),
    summary: z.string().nullable(),
  }),
  deliverableGroups: z.array(deliverableGroupSchema),
  deadline: deadlineSchema,
  organicUsage: rightsTermSchema,
  paidUsage: rightsTermSchema,
  exclusivity: z.object({
    specified: z.boolean(),
    summary: z.string(),
  }),
  evidence: z.array(evidenceItemSchema),
  risks: z.array(
    z.object({
      level: z.enum(['high', 'medium', 'info']),
      title: z.string(),
      detail: z.string(),
    }),
  ),
  missing: z.array(z.string()),
  recommendation: z.string(),
  draft: z.string(),
});

export const analysisSchema = extractedAnalysisSchema.extend({
  offered: z.number().nullable(),
  platform: z.enum(['Instagram', 'TikTok', 'Mixed', 'Unspecified']),
  deliverables: z.array(z.string()).min(1),
  organicRights: z.string(),
  paidRights: z.string(),
  exclusivityLabel: z.string(),
  compensationModelLabel: z.string(),
  preferenceMatch: z.object({
    preferredModel: z.enum(['guaranteed_flat_fee', 'flat_fee', 'hybrid', 'affiliate_allowed']),
    matches: z.boolean(),
    summary: z.string(),
  }),
  creatorContextUsed: z.boolean(),
  creatorContextNote: z.string().nullable(),
  confidence: z.enum(['Limited', 'Moderate']),
  mode: z.enum(['demo', 'ai']),
});

export type Deliverable = z.infer<typeof deliverableSchema>;
export type DeliverableGroup = z.infer<typeof deliverableGroupSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type ExtractedAnalysis = z.infer<typeof extractedAnalysisSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type EvidenceField = z.infer<typeof evidenceFieldSchema>;

export const COMPENSATION_MODEL_LABELS: Record<Analysis['compensationModel'], string> = {
  flat_fee: 'Guaranteed flat fee',
  affiliate: 'Affiliate commission',
  gifted: 'Gifted product',
  hybrid: 'Gifted product + affiliate commission',
  unknown: 'Unknown',
};

export const EVIDENCE_FIELD_LABELS: Record<EvidenceField, string> = {
  brand: 'Brand',
  guaranteedCash: 'Guaranteed payment',
  commission: 'Affiliate commission',
  commissionConditions: 'Commission eligibility',
  followerDiscount: 'Follower discount',
  giftedProduct: 'Gifted products',
  futurePaidOpportunities: 'Future paid opportunities',
  deliverables: 'Deliverables',
  affiliateRequirements: 'Affiliate link / code',
  deadline: 'Timeline',
  organicUsage: 'Organic usage',
  paidUsage: 'Paid usage',
  exclusivity: 'Exclusivity',
};

const WORD_TO_NUMBER: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

export function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function quoteInSource(source: string, quote: string | null | undefined) {
  if (!quote) return false;
  return normalizeText(source).includes(normalizeText(quote));
}

export function evidenceForField(analysis: Analysis, field: EvidenceField) {
  const item = analysis.evidence.find((entry) => entry.field === field && entry.quote);
  return item?.quote ?? null;
}

export function formatDeliverables(groups: DeliverableGroup[]): string[] {
  if (!groups.length) return ['Not clearly specified'];
  return groups.map((group, index) => {
    const joined = group.items
      .map((item) => {
        const qty = item.quantity === null ? '' : `${item.quantity} `;
        return `${qty}${item.platform} ${item.format}`.replace(/\s+/g, ' ').trim();
      })
      .join(' AND ');
    const relation = index === 0 ? '' : group.relation === 'or' ? 'OR ' : 'AND ';
    return `${relation}${group.label}: ${joined}`;
  });
}

function platformsFromGroups(groups: DeliverableGroup[]): Analysis['platform'] {
  const platforms = new Set(groups.flatMap((group) => group.items.map((item) => item.platform)));
  platforms.delete('Unspecified');
  platforms.delete('Other');
  platforms.delete('YouTube');
  if (platforms.has('Instagram') && platforms.has('TikTok')) return 'Mixed';
  if (platforms.has('Instagram')) return 'Instagram';
  if (platforms.has('TikTok')) return 'TikTok';
  return 'Unspecified';
}

function compensationLabel(model: Analysis['compensationModel'], extracted: ExtractedAnalysis) {
  if (model === 'hybrid' && extracted.giftedProduct && extracted.commissionPercent != null) {
    return 'Gifted product + affiliate commission';
  }
  return COMPENSATION_MODEL_LABELS[model];
}

function preferredModelLabel(structure: CreatorPreferences['compensationStructure']) {
  if (structure === 'hybrid') return 'hybrid compensation';
  if (structure === 'affiliate_allowed') return 'affiliate-friendly compensation';
  return 'guaranteed flat-fee sponsorships';
}

export function offerMatchesPreferences(
  extracted: Pick<ExtractedAnalysis, 'compensationModel' | 'guaranteedCash'>,
  preferences: CreatorPreferences = DEFAULT_CREATOR_PREFERENCES,
): boolean {
  const hasCash = extracted.guaranteedCash != null;
  const model = extracted.compensationModel;
  if (
    hasCash &&
    preferences.minimumGuaranteedFee != null &&
    extracted.guaranteedCash! < preferences.minimumGuaranteedFee
  ) {
    return false;
  }
  if (model === 'gifted' && !preferences.acceptsGiftedOnly) return false;
  if (model === 'affiliate' && !preferences.acceptsAffiliateLinks && !preferences.acceptsCommissionOnly) {
    return false;
  }
  if (preferences.compensationStructure === 'hybrid') {
    return hasCash || model === 'hybrid' || model === 'flat_fee' || preferences.acceptsAffiliateLinks;
  }
  if (preferences.compensationStructure === 'affiliate_allowed') {
    return true;
  }
  return hasCash && model === 'flat_fee';
}

function preferenceMatch(
  extracted: ExtractedAnalysis,
  preferences: CreatorPreferences = DEFAULT_CREATOR_PREFERENCES,
): Analysis['preferenceMatch'] {
  const preferredModel = preferences.compensationStructure;
  const matches = offerMatchesPreferences(extracted, preferences);
  if (matches) {
    return {
      preferredModel,
      matches: true,
      summary: `This offer matches the saved preference for ${preferredModelLabel(preferredModel)}.`,
    };
  }
  const minNote =
    preferences.minimumGuaranteedFee != null
      ? ` The saved minimum guaranteed fee is ${preferences.preferredCurrency} ${preferences.minimumGuaranteedFee.toLocaleString()} (creator-stated, not a market estimate).`
      : '';
  return {
    preferredModel,
    matches: false,
    summary: `Preference mismatch: this creator prefers ${preferredModelLabel(preferredModel)}, and the proposal does not match that structure.${minNote}`,
  };
}

export function validateEvidence(source: string, evidence: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<EvidenceField>();
  const validated: EvidenceItem[] = [];
  for (const item of evidence) {
    if (seen.has(item.field)) continue;
    seen.add(item.field);
    validated.push({
      field: item.field,
      quote: quoteInSource(source, item.quote) ? item.quote!.replace(/\s+/g, ' ').trim() : null,
    });
  }
  for (const field of evidenceFieldSchema.options) {
    if (!seen.has(field)) validated.push({ field, quote: null });
  }
  return validated;
}

function sanitizeExtracted(source: string, extracted: ExtractedAnalysis): ExtractedAnalysis {
  const hasCashFigure = /\$\s?[\d,]+(?:\.\d{2})?/.test(source);
  const guaranteedCash = hasCashFigure ? extracted.guaranteedCash : null;
  return {
    ...extracted,
    guaranteedCash,
    evidence: validateEvidence(source, extracted.evidence),
  };
}

function buildPreferenceRecommendation(extracted: ExtractedAnalysis, match: Analysis['preferenceMatch']) {
  if (match.matches) return extracted.recommendation;
  const affiliateNote =
    extracted.compensationModel === 'affiliate' || extracted.compensationModel === 'hybrid'
      ? ' This is an affiliate/gifted proposal rather than a guaranteed flat fee. Ask for a guaranteed posting fee if you want to proceed, and keep any commission as an add-on. Do not invent a market rate.'
      : ' Ask whether a guaranteed flat fee is available. Do not invent a market rate.';
  if (extracted.recommendation.toLowerCase().includes('preference mismatch')) return extracted.recommendation;
  return `${match.summary}${affiliateNote} ${extracted.recommendation}`.trim();
}

export function toAnalysis(
  extractedInput: ExtractedAnalysis,
  mode: Analysis['mode'],
  source: string,
  preferences: CreatorPreferences = DEFAULT_CREATOR_PREFERENCES,
  creatorContext: AnalysisCreatorContext = { used: false, note: null },
): Analysis {
  const extracted = sanitizeExtracted(source, extractedInput);
  const match = preferenceMatch(extracted, preferences);
  const risks = [...extracted.risks];
  if (!match.matches && !risks.some((risk) => risk.title === 'Compensation preference mismatch')) {
    risks.unshift({
      level: 'high',
      title: 'Compensation preference mismatch',
      detail: match.summary,
    });
  }
  return analysisSchema.parse({
    ...extracted,
    risks,
    recommendation: buildPreferenceRecommendation(extracted, match),
    offered: extracted.guaranteedCash,
    platform: platformsFromGroups(extracted.deliverableGroups),
    deliverables: formatDeliverables(extracted.deliverableGroups),
    organicRights: extracted.organicUsage.summary,
    paidRights: extracted.paidUsage.summary,
    exclusivityLabel: extracted.exclusivity.summary,
    compensationModelLabel: compensationLabel(extracted.compensationModel, extracted),
    preferenceMatch: match,
    creatorContextUsed: creatorContext.used,
    creatorContextNote: creatorContext.note,
    confidence: 'Limited',
    mode,
  });
}

function parseQty(raw: string | undefined, fallback: number | null) {
  if (!raw) return fallback;
  const keyed = WORD_TO_NUMBER[raw.toLowerCase()];
  if (keyed) return keyed;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function snippet(source: string, pattern: RegExp) {
  const match = source.match(pattern);
  if (!match) return null;
  return match[0].replace(/\s+/g, ' ').trim().slice(0, 220);
}

function evidence(field: EvidenceField, quote: string | null): EvidenceItem {
  return { field, quote };
}

function unspecifiedRights() {
  return { specified: false, duration: null, summary: 'Not specified' };
}

function perpetualRights(kind: 'organic' | 'paid') {
  return {
    specified: true,
    duration: 'perpetual',
    summary: kind === 'organic' ? 'Perpetual organic usage' : 'Perpetual paid usage',
  };
}

export function analyzeOffer(
  input: string,
  preferences: CreatorPreferences = DEFAULT_CREATOR_PREFERENCES,
  creatorContext: AnalysisCreatorContext = { used: false, note: null },
): Analysis {
  const s = input.toLowerCase();
  const brand = /hlth\s*code/i.test(input)
    ? 'HLTH Code'
    : /postmates/i.test(input)
      ? 'Postmates'
      : (/(?:from|for|with|at)\s+([A-Z][\w&'.-]+(?:\s+[A-Z][\w&'.-]+){0,2})/.exec(input)?.[1] ||
        'Unspecified brand');

  const cashMatch = /(?:offer(?:ing)?|offered)\s+\$\s?([\d,]+(?:\.\d{2})?)|\$\s?([\d,]+(?:\.\d{2})?)\s+for\b/i.exec(
    input,
  );
  const guaranteedCash = cashMatch ? Number((cashMatch[1] || cashMatch[2]).replaceAll(',', '')) : null;

  const commissionMatch = /(\d+(?:\.\d+)?)\s*%\s*commission/i.exec(input);
  const commissionPercent = commissionMatch ? Number(commissionMatch[1]) : null;
  const commissionConditions = /qualifying new-customer orders/i.test(input)
    ? 'Qualifying new-customer orders'
    : commissionPercent != null
      ? 'Commission mentioned; qualifying conditions unclear'
      : null;

  const discountMatch =
    /followers?[^\d%]{0,40}(\d+(?:\.\d+)?)\s*%/i.exec(input) || /(\d+(?:\.\d+)?)\s*%\s*off/i.exec(input);
  const followerDiscountPercent = discountMatch ? Number(discountMatch[1]) : null;

  const giftMatch = /((?:one\s+|a\s+|an\s+)?complimentary\s+[^.]{5,80}|gifted\s+[^.]{5,80})/i.exec(input);
  const giftedProduct = giftMatch ? giftMatch[1].replace(/\s+/g, ' ').trim().replace(/\.$/, '') : null;

  const futureMentioned = /future paid|paid partnership/i.test(input);
  const futureNotGuaranteed = /not guaranteed/i.test(input);
  const futurePaidOpportunities = {
    mentioned: futureMentioned,
    guaranteed: futureMentioned && !futureNotGuaranteed,
    summary: futureMentioned
      ? futureNotGuaranteed
        ? 'Possible future paid partnerships, not guaranteed'
        : 'Future paid opportunities mentioned'
      : null,
  };

  const hasOr = /\bor\b/.test(s);
  const reelQty = parseQty(
    /(?:(\d+|one|an|a)\s+)?(?:instagram\s+)?reels?/i.exec(input)?.[1],
    /reel/.test(s) ? 1 : null,
  );
  const storyFrameQty = parseQty(
    /(\d+|one|two|three|four|five|six)\s*(?:-?\s*)?(?:frame\s+)?(?:instagram\s+)?stor(?:y|ies)\s+frames?/i.exec(
      input,
    )?.[1],
    null,
  );
  const storyQty = parseQty(
    /(\d+|one|two|three|four|five|six)\s+(?:instagram\s+)?stor(?:y|ies)(?!\s+frames?)/i.exec(input)?.[1],
    null,
  );
  const tiktokQty = parseQty(/(?:(\d+|one|a|an)\s+)?tiktok(?:\s+post)?/i.exec(input)?.[1], /tiktok/.test(s) ? 1 : null);

  const affiliateInStories = /(?:affiliate link|coupon code)[^.]*stor(?:y|ies)|stor(?:y|ies)[^.]*affiliate link/i.test(
    input,
  );
  const affiliateRequired = /affiliate link/i.test(input);
  const couponRequired = /coupon code/i.test(input);

  const igItems: Deliverable[] = [];
  if (/reel/.test(s)) {
    igItems.push({
      platform: 'Instagram',
      format: 'Reel',
      quantity: reelQty,
      requirements: null,
      affiliateLinkRequired: affiliateRequired && !affiliateInStories,
      couponCodeRequired: couponRequired && !affiliateInStories,
    });
  }
  if (storyFrameQty != null || /story frames?/i.test(input)) {
    igItems.push({
      platform: 'Instagram',
      format: 'Story set',
      quantity: 1,
      requirements: storyFrameQty ? `${storyFrameQty} frames` : 'Confirm number of frames',
      affiliateLinkRequired: affiliateInStories || (affiliateRequired && !/reel/.test(s)),
      couponCodeRequired: affiliateInStories || (couponRequired && !/reel/.test(s)),
    });
  } else if (/stor(?:y|ies)/.test(s)) {
    igItems.push({
      platform: 'Instagram',
      format: 'Stories',
      quantity: storyQty,
      requirements: null,
      affiliateLinkRequired: affiliateInStories || affiliateRequired,
      couponCodeRequired: affiliateInStories || couponRequired,
    });
  }
  const ttItems: Deliverable[] = /tiktok/.test(s)
    ? [
        {
          platform: 'TikTok',
          format: 'Post',
          quantity: tiktokQty,
          requirements: null,
          affiliateLinkRequired: false,
          couponCodeRequired: false,
        },
      ]
    : [];

  const deliverableGroups: DeliverableGroup[] = [];
  if (hasOr && igItems.length && ttItems.length) {
    deliverableGroups.push({ label: 'Option A', relation: 'required', items: igItems });
    deliverableGroups.push({ label: 'Option B', relation: 'or', items: ttItems });
  } else {
    const items = [...igItems, ...ttItems];
    if (items.length) deliverableGroups.push({ label: 'Required package', relation: 'required', items });
  }

  const deadlineMatch = /within\s+(\d+)\s+days?\s+(?:of|after)\s+(?:receiving\s+)?(?:the\s+)?product/i.exec(input);
  const deadline = deadlineMatch
    ? {
        relativeDuration: `${deadlineMatch[1]} days`,
        triggeringEvent: 'receiving the product',
        absoluteDate: null,
        display: `Within ${deadlineMatch[1]} days after receiving the product.`,
      }
    : {
        relativeDuration: null,
        triggeringEvent: null,
        absoluteDate: null,
        display: 'Not specified',
      };

  const perpetual = /perpetual|in perpetuity|unlimited|forever|indefinite/.test(s);
  const mentionsPaid = /paid (?:advertis(?:ing|ements?)|media|usage|rights)|ads? (?:usage|rights)|whitelisting|spark ads/.test(
    s,
  );
  const mentionsOrganic = /organic usage/i.test(input);
  const organicUsage = mentionsOrganic && perpetual ? perpetualRights('organic') : unspecifiedRights();
  const paidUsage = mentionsPaid && perpetual ? perpetualRights('paid') : mentionsPaid
    ? { specified: true, duration: null, summary: 'Paid usage mentioned; duration not specified' }
    : unspecifiedRights();
  const exclusivitySpecified = /exclusiv|non.?compete/.test(s);
  const exclusivity = exclusivitySpecified
    ? { specified: true, summary: 'Mentioned; scope needs review' }
    : { specified: false, summary: 'Not specified' };

  const hasAffiliate = commissionPercent != null || affiliateRequired;
  const hasGift = Boolean(giftedProduct);
  const hasCash = guaranteedCash != null;
  const compensationModel: Analysis['compensationModel'] = hasCash && (hasAffiliate || hasGift)
    ? 'hybrid'
    : hasCash
      ? 'flat_fee'
      : hasAffiliate && hasGift
        ? 'hybrid'
        : hasAffiliate
          ? 'affiliate'
          : hasGift
            ? 'gifted'
            : 'unknown';

  const risks: Analysis['risks'] = [];
  if (paidUsage.duration === 'perpetual') {
    risks.push({
      level: 'high',
      title: 'Perpetual paid usage',
      detail:
        'The brand may be seeking indefinite advertising rights. Recommend separating the posting fee from a defined, renewable paid license.',
    });
  }
  if (organicUsage.duration === 'perpetual') {
    risks.push({
      level: 'medium',
      title: 'Perpetual organic usage',
      detail: 'Clarify where the brand may repost or edit your content and whether a limited license is acceptable.',
    });
  }
  if (deliverableGroups.some((group) => group.relation === 'or')) {
    risks.push({
      level: 'info',
      title: 'Alternative deliverable packages',
      detail: 'The proposal appears to give options rather than require all deliverables. Price the alternatives separately.',
    });
  }
  if (exclusivity.specified) {
    risks.push({
      level: 'medium',
      title: 'Exclusivity scope',
      detail: 'Confirm category, competing brands, territory, and term before pricing.',
    });
  }
  if (futurePaidOpportunities.mentioned && !futurePaidOpportunities.guaranteed) {
    risks.push({
      level: 'info',
      title: 'Future paid work is not guaranteed',
      detail: 'Treat possible later paid partnerships as optional, not as part of this offer’s compensation.',
    });
  }

  const missing = [
    guaranteedCash == null && 'Guaranteed cash payment',
    !deliverableGroups.length && 'Specific deliverables',
    !mentionsPaid && 'Whether paid advertising rights are required',
    !mentionsOrganic && 'Organic usage rights and duration',
    !exclusivity.specified && 'Exclusivity terms',
    deadline.display === 'Not specified' && 'Delivery and posting dates',
    !/revision|rounds? of edit/.test(s) && 'Revision rounds',
  ].filter(Boolean) as string[];

  const recommendation = paidUsage.duration === 'perpetual'
    ? 'Counter with a base content/posting fee plus a separate 90-day paid advertising license. Offer renewal terms; request a materially higher buyout fee if perpetual rights are non-negotiable. Do not treat this as a verified market valuation.'
    : 'Quote separately for content production, distribution, and any usage license. First confirm missing rights and scope. Use your own results and comparable completed deals to calibrate the amount. Do not invent a market rate.';

  const draft = `Hi,\n\nThanks for reaching out${brand !== 'Unspecified brand' ? ' about the ' + brand + ' campaign' : ''}! I’d be interested in learning more.\n\nBefore confirming, could you clarify the expected deliverables, timeline, and whether a guaranteed flat fee is available in addition to any gifted product or affiliate commission? I typically price content creation/posting separately from paid advertising usage.\n\nBest,\n[Your name]`;

  const extracted: ExtractedAnalysis = {
    brand,
    compensationModel,
    guaranteedCash,
    commissionPercent,
    commissionConditions,
    followerDiscountPercent,
    giftedProduct,
    futurePaidOpportunities,
    deliverableGroups,
    deadline,
    organicUsage,
    paidUsage,
    exclusivity,
    evidence: [
      evidence('brand', snippet(input, /HLTH Code|Postmates/i)),
      evidence('guaranteedCash', snippet(input, /\$\s?[\d,]+(?:\.\d{2})?/)),
      evidence('commission', snippet(input, /\d+(?:\.\d+)?%\s*commission[^.]{0,60}/i)),
      evidence('commissionConditions', snippet(input, /qualifying new-customer orders/i)),
      evidence('followerDiscount', snippet(input, /followers[^.]*\d+(?:\.\d+)?%\s*off|\d+(?:\.\d+)?%\s*off/i)),
      evidence('giftedProduct', snippet(input, /(?:one\s+|a\s+|an\s+)?complimentary\s+[^.]{5,80}/i)),
      evidence(
        'futurePaidOpportunities',
        snippet(input, /future paid partnerships?[^.]{0,40}not guaranteed|not guaranteed/i),
      ),
      evidence(
        'deliverables',
        snippet(
          input,
          /1 Instagram Reel AND 2 Instagram Stories|one Instagram Reel and three Instagram Story frames OR one TikTok post/i,
        ) || snippet(input, /Instagram Reel|TikTok post|Instagram Stories/i),
      ),
      evidence('affiliateRequirements', snippet(input, /affiliate link and coupon code in the Stories/i)),
      evidence('deadline', snippet(input, /within\s+\d+\s+days?\s+(?:of|after)\s+(?:receiving\s+)?(?:the\s+)?product/i)),
      evidence('organicUsage', snippet(input, /organic usage rights in perpetuity/i)),
      evidence('paidUsage', snippet(input, /paid advertising usage rights in perpetuity/i)),
      evidence('exclusivity', snippet(input, /exclusiv(?:e|ity)|non-?compete/i)),
    ],
    risks,
    missing,
    recommendation,
    draft,
  };

  return toAnalysis(extracted, 'demo', input, preferences, creatorContext);
}
