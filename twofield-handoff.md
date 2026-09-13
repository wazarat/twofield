# twofield handoff

Written 2026-09-13 for anyone picking the project up in a fresh AI IDE. Everything below is either in the public repo or is a fact confirmed on chain or in production. Secret values are never written down, only the names of the variables that hold them.

## 1. What twofield is

A buyer first marketplace for the ETHOnline 2026 hackathon. A user's existing agent (Claude Code, Cursor, a research bot) is good at staying on a project and bad at certifying specialist claims. Instead of inventing a threat model, compliance map, or personal brand plan, it hires a specialist agent on twofield for a scoped job and gets a receipt back. The buyer never touches web3. Wallets, escrow, identity, reputation and metered payments are all handled by the platform.

Six categories. Market and competitive intelligence. Software R&D. Marketing and social media. Security and risk research. Regulatory and compliance intelligence. Personal brand and career. Only the last one has sellers today.

## 2. Where things live

| Item | Value |
|---|---|
| Repo | https://github.com/wazarat/twofield, branch `main`, owner Wazarat Hussain |
| Local checkout | `~/twofield.dev`, app in `web/` |
| Live | https://twofield.dev (Vercel project `twofield.dev`, custom domain since 2026-09-06) |
| Fallback host | https://twofielddev.vercel.app |
| Database | Neon Postgres through the Vercel Storage integration, shared by local and production |
| Auth | Privy app `cmtphf3jc000k0cldwja3hxby`, email login only |
| Chain | Circle Arc testnet, chain id 5042002, RPC https://rpc.testnet.arc.io, explorer https://testnet.arcscan.app |
| Faucet | https://faucet.circle.com, 20 USDC every two hours |
| Model | Claude API, `claude-opus-5`, workspace scoped key |

## 3. Ground rules the owner set

These lived in a gitignored `CLAUDE.local.md` at the repo root and are not in the repo. Recreate that file from this section before doing anything in an AI IDE.

- Only the owner runs `git commit` and `git push`. The assistant never commits, pushes, tags, creates remote branches, opens PRs, or runs `gh` write commands unless explicitly asked in the current message. If asked to commit, no `Co-Authored-By` trailer and no "Generated with" text. Nothing on GitHub may show an AI tool authored or pushed it. Never touch git config, hooks or remotes.
- Work in small milestones. Before a milestone, state the scope in a few lines and wait for OK. After implementing, stop and ask the owner to verify live. Never bundle milestones or skip ahead.
- No emojis, no colons, no em dashes anywhere. UI copy, code comments, docs, commit messages. Use a period, a comma, or a new sentence.
- Frontend is Next.js, TypeScript, Tailwind in `web/`. Backend for the web app is TypeScript route handlers under `web/src/app/api`, approved on 2026-09-06 because Privy's server SDK is Node only. Any other tooling beyond Solidity uses Python unless the owner approves otherwise.
- Database is Neon Postgres with Drizzle ORM. Schema in `web/src/db/schema.ts`, migrations in `web/drizzle/`.
- The assistant never handles secret values. The owner pastes them into `web/.env.local` and the Vercel project. Non secret ids (wallet ids, addresses, DIDs, the app id) may be written by the assistant.
- Scope discipline. Do only what the current milestone asks. Report anything else and let the owner decide.

## 4. Stack and versions

Next.js 16.3 with the App Router and Turbopack, React 19, TypeScript, Tailwind 4 with `@theme inline` tokens, pnpm 12, Node 24. Libraries that matter. `@privy-io/react-auth` 3.x in the browser, `@privy-io/node` 0.34 on the server with `createViemAccount` from `@privy-io/node/viem`, `viem` 2.56 with the built in `arcTestnet` chain, `drizzle-orm` with `@neondatabase/serverless` (http driver, no transactions), `@anthropic-ai/sdk` 0.124, `@x402/core`, `@x402/evm`, `@x402/fetch` 2.25, `jose` for token verification.

Design tokens. Background `#f6f4f1`, text `#000000`, secondary text `rgba(0,0,0,0.6)`, cards `#ffffff` with `rgba(0,0,0,0.08)` borders, headings Space Grotesk 500 at tracking -0.03em, body Plus Jakarta Sans, mono DM Mono, wordmark Jost 600 lowercase as text until a logo lands at `web/public/logo.png`. Radius 16px cards, 24px panels, pill buttons. Primary buttons black fill, secondary 1px black border. Inspiration was fiscal.ai in a light palette.

## 5. Running it locally

```bash
cd ~/twofield.dev/web
pnpm install
cp .env.example .env.local
```

Fill `.env.local` with the values from the Vercel project. Then

```bash
pnpm dev
```

Useful scripts, all run from `web/`.

| Script | What it does |
|---|---|
| `pnpm lint` and `pnpm build` | Run both before every handover, both must pass |
| `pnpm db:generate` | Creates a migration from schema changes. Needs a TTY for rename prompts, `expect` was used when needed |
| `pnpm db:migrate` | Applies migrations to Neon. Reads `.env.local` through `loadEnvConfig` in `drizzle.config.ts` |
| `pnpm auth:key` | Generates the P-256 authorization keypair that owns every agent wallet. Already done, do not rerun |
| `pnpm wallet:master` and `pnpm wallet:evaluator` | Created the two platform wallets. Already done, do not rerun |
| `pnpm sellers:seed` | Seeds the ten demo sellers, idempotent by name |
| `pnpm sellers:refresh` | Recomputes each seller's cached rating from the Reputation Registry |

One off scripts run as `node --no-warnings --experimental-transform-types --env-file=.env.local --import ./scripts/register-alias.mjs <file>.ts` from inside `web/`. The alias hook maps `@/` to `web/src`. Temporary scripts must sit inside `web/` so packages resolve.

## 6. Environment variables

Names only. Every one of these is set in `web/.env.local` locally and in the Vercel project.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app id, public |
| `PRIVY_APP_SECRET` | Privy server secret |
| `DATABASE_URL` | Neon connection string |
| `PRIVY_AUTHORIZATION_KEY` | Private key of the authorization keypair that owns agent wallets |
| `PRIVY_AUTHORIZATION_PUBLIC_KEY` | Its public key, set as owner on every wallet and policy |
| `MASTER_WALLET_ID` and `MASTER_WALLET_ADDRESS` | Platform wallet that funds agents, relays x402 payments, receives sweeps |
| `EVALUATOR_WALLET_ID` and `EVALUATOR_WALLET_ADDRESS` | ERC-8183 evaluator, settles escrow and answers validation requests |
| `NEXT_PUBLIC_APP_URL` | `https://twofield.dev`, used to build agent URIs |
| `ANTHROPIC_API_KEY` | Workspace scoped key. An organization key needs `ANTHROPIC_WORKSPACE_ID` too |
| `ANTHROPIC_WORKSPACE_ID` | Optional, see above |
| `NEXT_PUBLIC_PLATFORM_OWNER_ID` | Privy DID of the owner, `did:privy:cmtpi4eew01im0cl8kgx1fx3z`, gates the review queue and attestation |

## 7. On chain facts

| Item | Address or value |
|---|---|
| USDC on Arc | `0x3600000000000000000000000000000000000000`, native gas token with 18 decimals in transactions and 6 on the ERC-20 interface, EIP-3009, EIP-712 domain name `USDC` version `2` |
| ERC-8004 Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 Validation Registry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| ERC-8183 AgenticCommerce escrow | `0x0747EEf0706327138c69792bF28Cd525089e4583`, proxy, implementation `0xA316fd02827242D537F84730F8a37D0BA5fd351a`, fees 0 |
| Master wallet | `0x85943076eCc04f27fA342b2891fF720b071CC312` |
| Evaluator wallet | `0xF06cc9748A6fBE17D0C6A1dBA4DA9364fca18A85` |
| Seller identities | ERC-8004 ids 893012 to 893021 |
| Owner's buyer agent | Fintech Research, id 892987, wallet `0x5B0cC41Cf809c1142db72501Eb0cfEaad0E19E88` |

Escrow behaviour confirmed from the verified source. `complete` needs status Submitted and the evaluator. `reject` works from Funded or Submitted by the evaluator and refunds the client in the same call. Neither checks expiry. `claimRefund` is client only after `expiredAt`, which is 24 hours after creation. Jobs are described on chain as `twofield job <uuid>`.

Registry quirks. `getSummary` on the Reputation Registry reverts on an empty client list, so reads use `readAllFeedback` with the buyer wallet addresses spelled out. `getValidationStatus` reverts for an unknown hash. Agent owners cannot rate their own agent, which is why the buyer wallet rates the seller.

## 8. Wallets and policies

Every agent, buyer or seller, and both platform wallets are Privy server wallets owned by the authorization public key. The backend signs with `authorization_context.authorization_private_keys`. Each wallet carries one Privy policy named `twofield <kind> <first 8 chars of id>`, the 50 character name limit bit once.

Buyer policy, version 5 in `web/src/lib/policies.ts`, allows on chain 5042002 only. Identity Registry calls up to the per job cap in value. USDC `approve` where the spender is the escrow and the amount is at most the per job cap in 6 decimals, checked through an `ethereum_calldata` condition. Escrow and Reputation Registry calls with zero value. Plain transfers to the master wallet with no cap, used for archive sweeps. One `eth_signTypedData_v4` rule for EIP-3009 `TransferWithAuthorization` on USDC capped at 0.01 USDC for x402 previews. Two lessons. A chain id domain condition next to a message condition makes Privy deny every request, and the types map must match the signing request exactly without `EIP712Domain`. `policyVersion` on the agent row tracks which version a wallet carries and `syncBuyerPolicy` rewrites it when the cap changes.

Seller policy allows the four marketplace contracts with zero value. Evaluator policy allows escrow and Validation Registry with zero value.

Funding. A buyer wallet is funded from the master wallet with max total budget plus 0.1 USDC gas on creation, and topped up by the difference when the total is raised. Sellers get 0.05 USDC gas, the evaluator 0.2. The master wallet keeps a 0.02 reserve.

## 9. Data model

Schema in `web/src/db/schema.ts`, eleven migrations applied, 0000 to 0010.

- `users`. `id` is the Privy DID, `username` unique, lowercase, 3 to 24 characters, cannot be edited.
- `agents`. Both buyers and sellers. `kind`, budgets (`max_budget_per_job`, `max_jobs`, `jobs_period` hour day week, `max_total_budget`), `status` draft then wallet_ready then registered, Privy `policy_id`, `wallet_id`, `wallet_address`, ERC-8004 `onchain_agent_id`, `metadata_uri`, seller fields (`category_slug`, `price_usdc`, `tagline`, `persona`), attestation fields, cached `reputation_count` and `reputation_score`, `policy_version`, `archived_at`, `sweep_tx`, `top_up_tx`. Sellers have `owner_id` equal to `platform`.
- `jobs`. `status` pending, created, budgeted, funded, generating, submitted, approved, rejected, refunded, disputed, failed. One column per transaction (`create_tx`, `budget_tx`, `approve_tx`, `fund_tx`, `submit_tx`, `settle_tx`, `refund_tx`, `feedback_tx`, `validation_tx`), `onchain_job_id`, `brief`, `context`, `deliverable`, `deliverable_hash` (keccak256 of the text, what the seller submitted on chain), `rating` 1 to 5, `review_note`, `last_error` for resumable steps.
- `job_files`. Text files attached to a job, name, bytes, content.
- `previews`. Every paid x402 pitch with brief, pitch, amount, payment tx.

## 10. Code map

Route handlers under `web/src/app/api`, one folder per resource. Pages under `web/src/app`. Components under `web/src/components`. Everything with chain or database logic sits in `web/src/lib`.

| File | Role |
|---|---|
| `lib/arc.ts` | Chain constants, public client, USDC unit helpers, explorer links |
| `lib/privy.ts` | Privy client, authorization context, master and evaluator wallet refs |
| `lib/auth.ts`, `lib/platform.ts` | Bearer token verification through Privy JWKS, platform owner check |
| `lib/wallets.ts` | Policy, wallet and funding creation, `topUp`, `sweepToMaster` |
| `lib/policies.ts` | Buyer, seller and evaluator rule sets, `syncBuyerPolicy` |
| `lib/identity.ts`, `lib/metadata.ts` | ERC-8004 registration and the registration file served at `/api/agents/<id>/metadata` |
| `lib/escrow.ts` | ERC-8183 ABI and the create, setBudget, approve, fund calls |
| `lib/jobs.ts` | `openJob` validation, rate limit window, `fundJob` resumable escrow steps |
| `lib/work.ts` | Claude API deliverable generation with the seller persona and buyer context |
| `lib/settlement.ts` | `submitWork`, `rateJob`, `approveJob`, `rejectJob` |
| `lib/reputation.ts` | `recordFeedback`, `refreshReputation`, `attestSeller`, `recordVerdict` |
| `lib/x402.ts`, `lib/preview.ts`, `lib/buyer-preview.ts` | In process x402 facilitator, seller side 402 flow, buyer side paid fetch |
| `lib/context.ts` | Attachment limits, validation and the prompt block |
| `lib/agents.ts`, `lib/agent-updates.ts`, `lib/archive.ts` | Input validation shared with the browser, edits with policy rewrite and top up, archiving |
| `lib/users.ts`, `lib/username.ts` | Account lookup and username rules |
| `lib/history.ts`, `lib/public-job.ts`, `lib/public-seller.ts` | Shapes sent to the browser |
| `lib/sellers.ts` | The ten seller seeds with personas and the niche pack section list |
| `components/user-context.tsx` | Fetches the account once per session, feeds the username gate and nav |

## 11. Flows

**Sign in.** Privy email login. The username gate asks once, then every members only page renders.

**Agent.** Add an agent with three budgets. Create wallet creates the policy, the wallet and the funding transfer, each step saved so a retry resumes. Register writes `register(uri)` on the Identity Registry from the agent wallet. Budgets are editable afterwards. Archive refuses while a job is open, then sweeps the balance to the master wallet.

**Hire.** From a seller card. Validation checks the price against the per job cap, the trailing window against max jobs per period, and the wallet balance. Then, in order, createJob from the buyer wallet with the seller as provider and the evaluator as evaluator, setBudget from the seller wallet, approve and fund from the buyer wallet. Status funded. The job page starts work on first open, the deliverable is generated and its hash submitted from the seller wallet. Status submitted.

**Rating.** The buyer rates 1 to 5 on the job page. 3 to 5 calls complete from the evaluator wallet and pays the seller at once. 1 or 2 sets disputed and holds escrow. Either way the buyer wallet writes the score to the Reputation Registry with tag1 `personal-brand` and tag2 `rating-5`. Earlier entries under `niche-pack` are ignored on purpose.

**Dispute.** The review queue at `/review`, owner only, lists disputed and stuck jobs. Pay the specialist calls complete, Refund the buyer calls reject. Then the seller wallet files `validationRequest` with the job URL and the evaluator answers `validationResponse` 100 or 0 tagged `dispute-review`, with the deliverable hash as response hash. Retry through `POST /api/jobs/<id>/verdict`.

**Preview.** `GET /api/sellers/<id>/preview?brief=` answers 402 with x402 requirements until a `PAYMENT-SIGNATURE` header arrives. The buyer route signs an EIP-3009 authorization for 0.01 USDC from the buyer wallet, the in process facilitator verifies and settles it with the master wallet as relayer, the pitch comes back and the preview is saved. Public facilitators do not cover Arc, which is why settlement is in process.

**Attestation.** Owner only button on a seller page. Seller wallet files a validation request, evaluator answers 100 tagged `human-reviewed`.

## 12. Milestone history

| Milestone | Delivered | Date |
|---|---|---|
| 0 | Repo bootstrap, rules file, gitignore | 2026-09-05 |
| 1 | Next.js scaffold, theme, landing, categories | 2026-09-06 |
| 2 | Privy login gating categories | 2026-09-06 |
| 3 | Neon and Drizzle, agents table, authenticated API | 2026-09-06 |
| 4 | Per agent Privy wallets with budgets, master wallet funding | 2026-09-06 |
| 5 | ERC-8004 identity registration and metadata endpoint | 2026-09-06 |
| 6 | Ten demo sellers with wallets and identities | 2026-09-06 |
| 7 | Jobs with ERC-8183 escrow, evaluator wallet | 2026-09-06 |
| 8 | Claude API work generation, review queue, settlement | 2026-09-07 |
| 9 | Reputation feedback and human attestation | 2026-09-07 |
| 10 | x402 seller preview with in process facilitator | 2026-09-07 |
| 11 | Email only sign in, usernames | 2026-09-07 |
| 12 | Archive agents, balance sweep | 2026-09-07 |
| 13 | Budget edits, max jobs as a rate per period | 2026-09-07 |
| 14 | Job context, pasted text and text files | 2026-09-07 |
| 15 | History page, saved previews, unique agent names, owner on receipts | 2026-09-07 |
| 16 | Buyer rating 1 to 5 driving settlement | 2026-09-07 |
| 17 | Dispute review, verdict on the Validation Registry | 2026-09-07 |

Latest commit at handover is `95a664b dispute review & validation registry verdicts`.

## 13. Known loose ends

- The status pill next to a job title reads "Rejected, buyer refunded" for a settled dispute while the timeline reads "Dispute settled, buyer refunded". One line in `web/src/lib/history.ts` if the pill should match.
- The cap error message in `web/src/lib/jobs.ts` prints the raw numeric, "0.200000 USDC", where `formatUsdc` would print "0.2 USDC".
- The Anthropic key was created with a 30 day expiry around 2026-09-07 and will need replacing.
- The Neon http driver has no transactions. A job insert followed by a failed file insert leaves a pending job with no escrow, which the owner sees as stalled and can retry.
- Previews bought before Milestone 15 were never stored.
- The buyer wallet policy allows `claimRefund`, but there is no UI for a buyer to reclaim escrow after the 24 hour expiry.

## 14. Queued work, not started

- MCP server per registered agent so an external host such as Claude Code or Cursor can hire through a registered identity without the web UI. This was the original next step in the roadmap.
- Sellers in the other five categories.
- Seller onboarding for other users.
- Username edits.
- Buyer initiated refunds after expiry.
- Hackathon track and sponsor prizes are still undecided. The logo file is still to be dropped at `web/public/logo.png`.

## 15. How each milestone was verified

Locally, `pnpm lint`, `pnpm build`, a grep of touched files for emojis and dashes, the migration applied, unauthenticated curl calls returning 401, and where possible a one off script inside `web/` exercising the library function against Arc. Then the owner pushed, Vercel deployed, and the owner verified the flow on https://twofield.dev with ArcScan open for every transaction. That pattern is worth keeping.
