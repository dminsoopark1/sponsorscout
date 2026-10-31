import { z } from 'zod';

export const EXAMPLE = `Hi! We're reaching out about an upcoming Postmates creator campaign. We'd love to offer $250 for one Instagram Reel and three Instagram Story frames OR one TikTok post. We require organic usage rights in perpetuity and paid advertising usage rights in perpetuity. Please let us know if you're interested!`;

export const packageItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  platform: z.enum(['Instagram', 'TikTok', 'YouTube', 'Other', 'Unspecified']),
});

export const packageSchema = z.object({
  label: z.string(),
  isOrAlternative: z.boolean(),
  items: z.array(packageItemSchema),
});

export const fieldEvidenceSchema = z.object({
  field: z.enum([
    'brand',
    'compensation',
    'deliverables',
    'platform',
    'organicRights',
    'paidRights',
    'exclusivity',
  ]),
  status: z.enum(['extracted', 'unknown']),
  quote: z.string().nullable(),
});

export const extractedAnalysisSchema = z.object({
  brand: z.string(),
  offered: z.number().nullable(),
  platform: z.enum(['Instagram', 'TikTok', 'Mixed', 'Unspecified']),
  packages: z.array(packageSchema),
  organicRights: z.string(),
  paidRights: z.string(),
  exclusivity: z.string(),
  fieldEvidence: z.array(fieldEvidenceSchema),
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
  deliverables: z.array(z.string()).min(1),
  evidence: z.array(z.string()),
  confidence: z.enum(['Limited', 'Moderate']),
  mode: z.enum(['demo', 'ai']),
});

export type PackageItem = z.infer<typeof packageItemSchema>;
export type DeliverablePackage = z.infer<typeof packageSchema>;
export type FieldEvidence = z.infer<typeof fieldEvidenceSchema>;
export type ExtractedAnalysis = z.infer<typeof extractedAnalysisSchema>;
export type Analysis = z.infer<typeof analysisSchema>;

export const FIELD_LABELS: Record<FieldEvidence['field'], string> = {
  brand: 'Brand',
  compensation: 'Compensation',
  deliverables: 'Deliverables',
  platform: 'Platform',
  organicRights: 'Organic usage',
  paidRights: 'Paid usage',
  exclusivity: 'Exclusivity',
};

export function formatDeliverables(packages: DeliverablePackage[]): string[] {
  if (!packages.length) return ['Not clearly specified'];
  return packages.map((pkg, index) => {
    const joined = pkg.items
      .map((item) => {
        if (item.quantity === null) return item.description;
        return `${item.quantity} ${item.description}`;
      })
      .join(' + ');
    const relation = index === 0 ? '' : pkg.isOrAlternative ? 'OR ' : 'AND ';
    const andNote = pkg.items.length > 1 ? ' (AND)' : '';
    return `${relation}${pkg.label}${andNote}: ${joined}`;
  });
}

export function toAnalysis(extracted: ExtractedAnalysis, mode: Analysis['mode']): Analysis {
  const quotes = extracted.fieldEvidence
    .filter((item) => item.status === 'extracted' && item.quote)
    .map((item) => `${FIELD_LABELS[item.field]}: “${item.quote}”`);
  return analysisSchema.parse({
    ...extracted,
    deliverables: formatDeliverables(extracted.packages),
    evidence: quotes.length
      ? [...quotes, 'No verified comparable market transactions supplied']
      : ['Offer text provided by the creator', 'No verified comparable market transactions supplied'],
    confidence: 'Limited',
    mode,
  });
}

function quote(input: string, pattern: RegExp): string | null {
  const match = input.match(pattern);
  if (!match) return null;
  return match[0].replace(/\s+/g, ' ').trim().slice(0, 220);
}

function evidenceFor(
  field: FieldEvidence['field'],
  snippet: string | null,
): FieldEvidence {
  return snippet
    ? { field, status: 'extracted', quote: snippet }
    : { field, status: 'unknown', quote: null };
}

export function analyzeOffer(input: string): Analysis {
  const s = input.toLowerCase();
  const money = [...input.matchAll(/(?:\$\s?)([\d,]+(?:\.\d{2})?)/g)].map((m) =>
    Number(m[1].replaceAll(',', '')),
  );
  const brand = /postmates/i.test(input)
    ? 'Postmates'
    : (/(?:from|for|with|at)\s+([A-Z][\w&'.-]+(?:\s+[A-Z][\w&'.-]+){0,2})/.exec(input)?.[1] ||
      'Unspecified brand');
  const instagram = /instagram|\breel\b|\bstor(?:y|ies)\b/.test(s);
  const tiktok = /tiktok/.test(s);
  const platform: Analysis['platform'] =
    instagram && tiktok ? 'Mixed' : instagram ? 'Instagram' : tiktok ? 'TikTok' : 'Unspecified';

  const reelQtyMatch = /(?:(\d+|one|an|a)\s+)?(?:instagram\s+)?reels?/i.exec(input);
  const storyQtyMatch =
    /(\d+|one|two|three|four|five|six)\s*(?:-?\s*)?(?:frame\s+)?(?:instagram\s+)?stor(?:y|ies)/i.exec(input);
  const tiktokQtyMatch = /(?:(\d+|one|a|an)\s+)?tiktok(?:\s+post)?/i.exec(input);
  const hasOr = /\bor\b/.test(s);

  const wordToNumber: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  const parseQty = (raw: string | undefined, fallback: number | null) => {
    if (!raw) return fallback;
    const keyed = wordToNumber[raw.toLowerCase()];
    if (keyed) return keyed;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const packages: DeliverablePackage[] = [];
  const igItems: PackageItem[] = [];
  if (/reel/.test(s)) {
    igItems.push({
      description: 'Instagram Reel',
      quantity: parseQty(reelQtyMatch?.[1], 1),
      platform: 'Instagram',
    });
  }
  if (/stor(?:y|ies)|story frames?/.test(s)) {
    igItems.push({
      description: storyQtyMatch ? 'Instagram Story frames' : 'Instagram Stories (confirm number of frames)',
      quantity: parseQty(storyQtyMatch?.[1], null),
      platform: 'Instagram',
    });
  }
  const ttItems: PackageItem[] = tiktok
    ? [
        {
          description: 'TikTok post',
          quantity: parseQty(tiktokQtyMatch?.[1], 1),
          platform: 'TikTok',
        },
      ]
    : [];

  if (hasOr && igItems.length && ttItems.length) {
    packages.push({ label: 'Option A', isOrAlternative: false, items: igItems });
    packages.push({ label: 'Option B', isOrAlternative: true, items: ttItems });
  } else {
    const items = [...igItems, ...ttItems];
    if (items.length) packages.push({ label: 'Required package', isOrAlternative: false, items });
  }

  const perpetual = /perpetual|in perpetuity|unlimited|forever|indefinite/.test(s);
  const mentionsPaid = /paid (?:advertis(?:ing|ements?)|media|usage|rights)|ads? (?:usage|rights)|whitelisting|spark ads/.test(
    s,
  );
  const mentionsOrganic = /organic/.test(s);
  const paidRights = mentionsPaid
    ? perpetual
      ? 'Perpetual / indefinite (verify exact clause)'
      : 'Mentioned; duration unclear'
    : 'Not stated';
  const organicRights = mentionsOrganic
    ? perpetual
      ? 'Perpetual / indefinite (verify exact clause)'
      : 'Mentioned; duration unclear'
    : 'Not stated';
  const exclusivity = /exclusiv|non.?compete/.test(s) ? 'Mentioned; scope needs review' : 'Not stated';

  const risks: Analysis['risks'] = [];
  if (mentionsPaid && perpetual) {
    risks.push({
      level: 'high',
      title: 'Perpetual paid usage',
      detail:
        'The brand may be seeking indefinite advertising rights. Recommend separating the posting fee from a defined, renewable paid license.',
    });
  } else if (mentionsPaid) {
    risks.push({
      level: 'medium',
      title: 'Paid usage terms unclear',
      detail: 'Confirm duration, placement, geography, edit rights, and whether ads run through your account.',
    });
  }
  if (perpetual && mentionsOrganic) {
    risks.push({
      level: 'medium',
      title: 'Perpetual organic usage',
      detail: 'Clarify where the brand may repost or edit your content and whether a limited license is acceptable.',
    });
  }
  if (packages.some((pkg) => pkg.isOrAlternative)) {
    risks.push({
      level: 'info',
      title: 'Alternative deliverable packages',
      detail:
        'The proposal appears to give options rather than require all deliverables. Price the alternatives separately.',
    });
  }
  if (exclusivity.startsWith('Mentioned')) {
    risks.push({
      level: 'medium',
      title: 'Exclusivity scope',
      detail: 'Confirm category, competing brands, territory, and term before pricing.',
    });
  }

  const offered = money.length ? money[0] : null;
  const missing = [
    !money.length && 'Guaranteed compensation',
    !packages.length && 'Specific deliverables',
    !mentionsPaid && 'Whether paid advertising rights are required',
    !/\d+\s*(?:day|month|year)/.test(s) && 'Usage duration / start date',
    !/revision|rounds? of edit/.test(s) && 'Revision rounds',
    !/deadline|due date|post by|live by/.test(s) && 'Delivery and posting dates',
    !/whitelisting|spark ads|partnership ads/.test(s) && 'Account-level ad permissions',
  ].filter(Boolean) as string[];

  const recommendation =
    mentionsPaid && perpetual
      ? 'Counter with a base content/posting fee plus a separate 90-day paid advertising license. Offer renewal terms; request a materially higher buyout fee if perpetual rights are non-negotiable. Do not treat this as a verified market valuation.'
      : 'Quote separately for content production, distribution, and any usage license. First confirm missing rights and scope. Use your own results and comparable completed deals to calibrate the amount.';

  const draft = `Hi,\n\nThanks for reaching out${brand !== 'Unspecified brand' ? ' about the ' + brand + ' campaign' : ''}! I’d be interested in learning more.\n\nBefore confirming a rate, could you clarify the expected deliverables, timeline, and the scope of organic and paid usage rights? I typically price content creation/posting separately from paid advertising usage, with an initial 90-day license and an option to renew.\n\nIf a limited licensing term works, I’d be happy to put together a package that fits the campaign goals.\n\nBest,\n[Your name]`;

  const fieldEvidence: FieldEvidence[] = [
    evidenceFor('brand', quote(input, /Postmates|[A-Z][\w&'.-]+(?:\s+[A-Z][\w&'.-]+){0,2} creator campaign/)),
    evidenceFor('compensation', quote(input, /\$\s?[\d,]+(?:\.\d{2})?/)),
    evidenceFor(
      'deliverables',
      quote(
        input,
        /(?:one |an |a |\d+\s+)?(?:Instagram Reel|TikTok post)[\s\S]{0,80}?(?:OR one TikTok post|TikTok post|Instagram Reel)/i,
      ) || quote(input, /Instagram Reel|TikTok post|Story frames?/i),
    ),
    evidenceFor('platform', quote(input, /Instagram|TikTok/i)),
    evidenceFor('organicRights', quote(input, /organic usage rights[^.]{0,60}/i)),
    evidenceFor('paidRights', quote(input, /paid advertising usage rights[^.]{0,60}/i)),
    evidenceFor('exclusivity', quote(input, /exclusiv(?:e|ity)|non-?compete/i)),
  ];

  return toAnalysis(
    {
      brand,
      offered,
      platform,
      packages,
      organicRights,
      paidRights,
      exclusivity,
      fieldEvidence,
      risks,
      missing,
      recommendation,
      draft,
    },
    'demo',
  );
}
