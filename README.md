# SponsorScout — Creator Deal Intelligence

A working MVP for sponsorship-offer analysis. Paste a proposal, extract its terms, flag licensing issues, and draft a response. **It deliberately does not invent a market-value estimate.**

## Quick start

Requirements: Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and select **Try an example**. No API key is necessary to test deterministic demo mode. Offer analysis stays available without an account.

## Optional AI mode

Set `ANTHROPIC_API_KEY` in `.env.local`. The server-side `/api/analyze` handler calls the Anthropic Messages API with structured JSON output. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`. Never place an API key in a `NEXT_PUBLIC_` variable. If the model API errors or the response fails schema validation, the server returns the deterministic fallback.

`POST /api/analyze` also applies a basic in-memory rate limit: 8 anonymous requests per 10 minutes per address, 30 requests per 10 minutes for a signed-in user, and 60 anonymous requests per minute across the process. Restarting the server clears the counters. This does not coordinate across multiple instances, and `X-Forwarded-For` is only as trustworthy as the proxy in front of the app. Replace it with a shared store before public traffic.

## Accounts

Signed-in creators get a dashboard of saved analyses and an account page. Guests can still analyze offers.

1. Create a Supabase project.
2. In Authentication → Providers, enable Email. For Google, create an OAuth client and paste its client id and secret into Supabase. In Google Cloud, the authorized redirect URI is Supabase's callback, `https://<project-ref>.supabase.co/auth/v1/callback`, not the app URL.
3. In Authentication → URL configuration, set the site URL to `http://localhost:3000` for local development. Add redirect URLs `http://localhost:3000/auth/callback` and, when you deploy, `https://<your-domain>/auth/callback`.
4. Run `supabase/migrations/20261101120000_creator_profiles_and_saved_analyses.sql` in the Supabase SQL editor, or apply it with the Supabase CLI.
5. Copy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.example` into `.env.local`. Use the publishable key (or the legacy anon key). Do not add the service-role key to this app. Restart `npm run dev` after changing environment variables.

Email confirmation and Google sign-in both return to `/auth/callback`. The app then continues only to a same-site path. Protected pages and `/api/profile` and `/api/analyses` read the user id from the verified session. A user id in the request body is rejected.

Automated tests cover those application checks and the migration text. They do not connect to a live Supabase project, so Google OAuth, email delivery, and the database policies are not verified until the steps above are finished in your project.

## Deploy publicly

1. Push this folder to a GitHub repository.
2. Import the repository into Vercel as a Next.js project.
3. Add `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as environment variables. Do not add a Supabase service-role key.
4. Deploy and test on the assigned URL.

**Not production-hardened.** Basic auth and an in-memory analysis limit are in place. Before public traffic, add a shared rate-limit store, bot controls, content moderation, per-user budgets, audit logging with privacy safeguards, and a clear privacy policy. Configure your API project's budgets and monitor usage.

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
- Accounts and saved analyses require a configured Supabase project and the migration in this repo. The in-memory analysis rate limit is per server process.

## Next milestones

1. Confirm the Supabase migration and OAuth redirect URLs in the live project.
2. Add documents and screenshots with privacy controls.
3. Introduce a versioned benchmark library and creator historical-deal table with sources, rights normalization, sample sizes and recency.
4. Add explainable pricing scenarios based on creator-chosen floors and evidence-backed comparables.
5. Build evaluation tests for extraction, unsupported claims, and rights detection.
6. Add outbound brand prospecting and human-approved outreach.

## Portfolio narrative

Built a creator-focused AI sponsorship negotiation assistant integrating structured LLM extraction, deterministic fallback, rights-risk detection and human-reviewed communication drafting; designed to separate supported deal facts from unverified pricing estimates.
