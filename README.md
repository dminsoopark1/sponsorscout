# SponsorScout — Creator Deal Intelligence

A working MVP for sponsorship-offer analysis. Paste a proposal, extract its terms, flag licensing issues, and draft a response. **It deliberately does not invent a market-value estimate.**

## Quick start

Requirements: Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and select **Try an example**. No API key is necessary to test deterministic demo mode.

## Optional AI mode

Set `ANTHROPIC_API_KEY` in `.env.local`. The server-side `/api/analyze` handler calls the Anthropic Messages API with structured JSON output. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`. Never place an API key in a `NEXT_PUBLIC_` variable. If the model API errors or the response fails schema validation, the server returns the deterministic fallback.

## Deploy publicly

1. Push this folder to a GitHub repository.
2. Import the repository into Vercel as a Next.js project.
3. Add `ANTHROPIC_API_KEY` and (optionally) `ANTHROPIC_MODEL` under server environment variables.
4. Deploy and test on the assigned URL.

**Not production-hardened.** Before public traffic, add rate limiting, bot controls, authentication or anonymous quotas, content moderation, per-user budgets, audit logging with privacy safeguards, and a clear privacy policy. Configure your API project's budgets and monitor usage. Don't publish a live app with unlimited anonymous API access.

## Current features

- Text input with a Postmates-inspired test example.
- Basic compensation, platform and deliverable extraction.
- Flags for perpetual paid and organic rights, and alternative deliverable bundles.
- Identifies missing deal terms.
- Drafts a clarification/negotiation email with copy action.
- Optional server-side AI extraction with structured response format.
- Explicitly labels confidence as limited when no comparable transaction dataset is available.

## Known limitations

- Demo mode is heuristic, so complex email phrasing, multiple dollar amounts and company-name extraction can be wrong.
- AI mode can still make extraction mistakes; users must validate against the original contract.
- Doesn't estimate fair market value, import platform analytics, or ingest actual comparable deal data.
- Not legal advice, and no contract document parsing yet.
- No persistence, authentication, tests or outreach workflows in this initial MVP.

## Next milestones

1. Add creator account and saved offers in Supabase (row-level security).
2. Add documents and screenshots with privacy controls.
3. Introduce a versioned benchmark library and creator historical-deal table with sources, rights normalization, sample sizes and recency.
4. Add explainable pricing scenarios based on creator-chosen floors and evidence-backed comparables.
5. Build evaluation tests for extraction, unsupported claims, and rights detection.
6. Add outbound brand prospecting and human-approved outreach.

## Portfolio narrative

Built a creator-focused AI sponsorship negotiation assistant integrating structured LLM extraction, deterministic fallback, rights-risk detection and human-reviewed communication drafting; designed to separate supported deal facts from unverified pricing estimates.
