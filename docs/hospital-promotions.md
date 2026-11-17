# Hospital promotional pop-ups

## User-approved production demonstration (2026-11-17)

The user explicitly requested a fictional demo on production after the initial implementation. It is live on Vercel project **saharacare3**, team `team_ivDrjfjscZBYiCacLqqGKxPJ`, project `prj_zJAmJKHQKJAsrrsnMocqjOwmnj6X`:

- Public demo: **https://saharacare3.vercel.app/hospital-demo** (no sign-in/database access required).
- Destination: **https://saharacare3.vercel.app/hospital-demo?details=1**, clearly fictional, no booking/payment and no destination popup.
- Deployment `dpl_J5ND9RU6w7dDhR4xUVC1y5NxbwWL`, application commit `7183b2e4c0a811a91dcd618d00d0fbd8655b30d7`, READY with the production domain assigned. Built directly from the feature commit in the existing connected `cmswqw/saharacare` repository; the same feature commits are pushed to Codefest/PR #3. No PR merge was required or performed.
- Three server-only nonsecret settings were added for production/preview: `HOSPITAL_PROMOTIONS_DEMO=true`, `HOSPITAL_PROMOTIONS_ALLOW_PRODUCTION_DEMO=true`, `HOSPITAL_PROMOTIONS_DEMO_URL=https://saharacare3.vercel.app/hospital-demo?details=1`. No credential, `.env.local`, Supabase row/schema, provider-verification state or legal approval was changed. Normal production stays empty when either demo flag is false.
- PASS local typecheck, lint, 131 tests and production build. PASS `node tests/flows/promotions-live-browser.mjs https://saharacare3.vercel.app/hospital-demo`: actual public production page at 390x844, fictional label, no horizontal overflow, correct safe links, close/scroll restoration, reload rotation and working destination without another popup. A production screenshot was visually inspected. This check uses no auth substitutes, but it does not test real sign-in/clinical workflows or physical devices; no database writes were made.
- Turn off either demo flag and redeploy to disable the fictional campaign. Existing clinical-review and provider-approval requirements are unchanged. Demo permission is not real medical-advertising clearance.

## Content and approval

`lib/promotions/config.ts` is the centralized, server-owned configuration. It starts with **no approved records**, so production displays nothing. Authorized repository maintainers add/update records through code review using the existing GitHub permissions. No browser writes, new admin role/UI, database table, migration, credentials, advertising SDK or tracking system is introduced. The existing paid clinical directory is not repurposed as an ad database.

Before adding a real hospital: obtain approved factual text, hospital-authorized imagery/destination and appropriate Nepal medical-advertising/legal review. The promotion label is disclosure, **not legal clearance or clinical endorsement**. Do not invent offers, URLs, credentials, partnerships or images. Do not activate paid doctor-ranking or referral commissions through this feature.

Each record requires a unique nonempty `id`, `hospitalName`, `imageUrl`, `destinationUrl`, `isActive: true` and finite numeric `priority`. Optional fields: description, promotionalMessage, imageAlt, location and up to six gallery images with alt text. Strings are length-bounded. Invalid/inactive records are excluded; duplicate IDs are suppressed. Destinations must be absolute HTTPS without embedded credentials; javascript/data/file/http destinations are rejected. Images must be HTTPS or flat local `/promotions/<filename>` assets, not traversal/protocol-relative URLs. Use approved image hosts and consider patient privacy before embedding third-party media. Requests use no-referrer; no click tracking is added.

Keep IDs stable when updating images/text. Sorting is priority descending, then ID ascending. Each launch rotates to the item after the persisted last ID, wrapping to the beginning. Priority is **ordering, not exclusive/weighted frequency**. Missing/deactivated/removed last ID restarts at the first eligible record. Storage key: `saharacare-hospital-promotion-v1`, a JSON string containing the last actually presented ID. Corrupt/blocked storage falls back to the first item without crashing; rotation across reloads cannot persist when storage is unavailable.

## Launch/readiness contract

This is a **web** feature: one launch is one Document (full load/reload), not a route, mount, visibility change or return from a link. The root-layout host survives client navigation. Document-keyed launch state prevents Strict Mode/remount duplication. Loading never blocks server/page startup and has no network request in this configuration-backed milestone.

The first authenticated AppShell's `#main-content` is the readiness boundary; login/signup/onboarding screens without it cannot present promotions. Existing authenticated layouts enforce roles before rendering AppShell. Dialogs already in the DOM defer presentation. Pointer, keyboard, touch or wheel activity after main readiness skips any still-pending promotion for the rest of that launch; so dismissing another blocking dialog through interaction also defers to the next launch. Route changes while loading and pagehide likewise defer. Normal auth interaction before main readiness does not consume the launch. No eligible records means no modal, request loop or interruption.

Only the Radix dialog's actual open-auto-focus event advances persistence. Selection/loading alone does not. Dismissal, external-tab return, rerenders and remounts do not repeat a promotion. No timer, countdown, forced delay, autoplay or auto-dismissal exists. Closing is available throughout entry animation. Backdrop/Escape/close work with Radix focus containment, background hiding/scroll lock and restored application focus after exit. Normal fades/scales use 240ms entry/160ms exit; reduced motion removes scale/translation and dismisses immediately. Shared Modal's added presentation/focus/reduced-motion hooks are optional for existing callers. Settings storage was made defensive because AppProvider previously threw when localStorage was denied, before the promotion could run.

Image space is reserved at 4:3 with contain sizing. A broken image becomes linked local SaharaCare branding/alt text; the destination is unchanged. Main image, fallback, gallery and CTA share one validated HTTPS destination. Links use native anchors with new-tab/noopener/noreferrer semantics (no JS popup detector that mistakes successful noopener windows for failures). Browser-level network errors, offline destinations and browser-enforced blocking are handled by the external browser; the app cannot verify an unrelated site's availability. The modal stays dismissible and never assumes a successful hospital visit. Manual gallery controls are separate from the link.

## Development preview

Set `HOSPITAL_PROMOTIONS_DEMO=true` in local development and restart the Next development server. The flag alone is ignored in production. Following explicit user approval for a deployed fictional demo, production additionally requires `HOSPITAL_PROMOTIONS_ALLOW_PRODUCTION_DEMO=true`. Both flags must be true; ordinary production remains empty by default. Set `HOSPITAL_PROMOTIONS_DEMO_URL` to the deployed HTTPS `/hospital-demo?details=1` URL so sample artwork/CTA opens the clearly fictional information page. Without that override the sample uses intentionally non-resolving `https://example.invalid/saharacare-demo`. Three visibly fictional hospitals rotate using authored local `/promotions/demo.svg`. No clinical verification or legal approval is inferred from these demo flags. Delete/reset the rotation storage key if starting the sequence over. No real-data seed or database changes are required.

`/hospital-demo` is an explicitly public, data-free demonstration screen with the readiness marker; no sign-in is required there. `/hospital-demo?details=1` omits the readiness marker so following the CTA does not start another popup in the destination tab. Reload/See the next demo performs a fresh page load. Normal patient/doctor/caregiver authentication remains unchanged. Turn off either flag and redeploy to remove the fictional popups.

Isolated preview without sign-in/backend calls:

```text
node tests/flows/promotions-server.mjs
node tests/flows/promotions-browser.mjs
```

Preview: `http://127.0.0.1:4176`; Nepali: `?lang=ne`; `?broken` tests fallback; `?empty` tests no content. This uses real presentation, Radix, Framer Motion, Next Image and launch controller, with synthetic content and simulated navigation. It is **not a real authenticated Next/onboarding flow**. Do not copy fixture data into approved production configuration.

## Verification

Unit tests cover URLs/invalid records, deterministic rotation/list changes, storage failures and production sample gating. Browser checks cover 390x844 EN, 320x800 NE/reduced motion, 844x390 landscape and 1366x768 desktop; keyboard focus containment/Escape, immediate close, focus/scroll restoration, strict remount/navigation suppression, reload rotation, safe links, broken images, empty results, late data, failed retrieval, blocking dialogs, denied storage and enlarged text. Screenshots are generated in the OS temporary folder and inspected separately; browser emulation is not physical-device or full screen-reader certification. Real approved content, native devices and actual external destination behavior remain manual acceptance items. No merge or deployment is authorized by this implementation.
