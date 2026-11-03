# N.S. Construction — Project & Content Platform

Premium, responsive construction-company website and admin workspace built with Next.js App Router, TypeScript, PostgreSQL and Prisma.

## What is in the platform

- Public company site with project consultation wizard, services, project archive, article journal, verified-only testimonials, WhatsApp and contact links.
- Project case studies with publication controls, featured placement and full-screen image galleries.
- Editorial workflow with drafts, publishing, unpublishing, editing and deletion.
- Enquiry CRM with status pipeline, customer/project details, attachments, assignment, private notes, activity history, follow-up dates and email delivery status/retry.
- Team accounts with `ADMIN`, `EDITOR` and `SALES` roles; database accounts use scrypt password hashes and disabled accounts lose access immediately.
- Cloudinary media library with server-side signed uploads and deletion protection for files in use.
- Website contact settings stored in PostgreSQL; secrets remain in environment variables.
- Consent-gated GA4 and Meta Pixel scripts, SEO metadata, JSON-LD, sitemap, robots rules, responsive error states and admin integration checks.
- Material-driven quotation builder with administrator-configured package rates, catalogue options, explicit per-square-foot upgrade rules, itemised estimates, CRM-linked customer records, quotation status/revision tracking and a print-to-PDF proposal.

No sample projects, testimonials, reviews, followers or performance statistics are seeded. Project imagery used in the public design is clearly labelled as illustrative; replace it with permission-cleared company photographs.

## Requirements

- Node.js 20.9 or later
- PostgreSQL 14 or later
- Windows CMD or PowerShell

## Windows CMD setup

Open CMD in the project directory:

```cmd
cd /d C:\CURRENT-PROJECTS\ns-construction-platform
if not exist .env copy .env.example .env
notepad .env
npm install
npx prisma generate
```

Set a reachable PostgreSQL `DATABASE_URL`, a unique `ADMIN_EMAIL` and strong `ADMIN_PASSWORD`, and an `ADMIN_SESSION_SECRET` of at least 32 characters. Generate a session secret with:

```cmd
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

**If you already have data in the original four tables:** take a provider-side backup first and verify the existing table/column layout matches the original Prisma schema. The original project had no migration history. Mark only the baseline as applied (this does not execute or change data), then run the additive migration:

```cmd
npx prisma migrate resolve --applied 20261103110000_baseline
npx prisma migrate deploy
npx prisma generate
```

Do not mark the baseline as applied on a new/empty database. For an empty database, run:

```cmd
npx prisma migrate deploy
npx prisma generate
```

The second migration only adds nullable/defaulted enquiry and team fields, a default-published flag for existing projects, and new CRM, media, settings, rate-limit and audit tables. The quotation migration adds customer/quotation/material-pricing tables and seeds the explicitly requested Essential rate of ₹1,750/sq. ft., plus unset Premium and Luxury packages and category names. It does not delete existing records. Review migration SQL and take a database-provider backup before applying it to production. Never use `prisma db push` as a production migration substitute.

## Run and verify

```cmd
npm run dev
```

Visit `http://localhost:3000`, then run in a second CMD window:

```cmd
cd /d C:\CURRENT-PROJECTS\ns-construction-platform
npm run typecheck
npm run lint
npm run build
npm run start
```

Public routes: `/`, `/quote`, `/quote/[secure-token]`, `/projects`, `/projects/[slug]`, `/blog`, `/blog/[slug]`, `/privacy`. Admin routes: `/admin/login`, `/admin`, `/admin/enquiries`, `/admin/quotations`, `/admin/quotations/[id]/print`, `/admin/projects`, `/admin/blog`, `/admin/media`, `/admin/integrations`, `/admin/team`, `/admin/testimonials`, `/admin/settings`, `/admin/notifications`.

## Quotations and material pricing

- The quotation builder uses administrator-configured package rates and server-side calculations. Essential starts at ₹1,750/sq. ft.; Premium and Luxury begin unset and are not offered with a price until an administrator configures them.
- The quotation migration seeds the initial Essential, Premium and Luxury package rows. Public quotation-option requests are read-only; apply the migration before using the builder. The migration never overwrites package rates after it has been applied.
- Material category names are provided as an empty catalogue framework. Add approved specifications, brands, package-included defaults and package-specific per-square-foot adjustments in Admin → Quotations & pricing. No material brands, product prices, package inclusions or payment terms are fabricated.
- Selecting a material not configured as the package default requires an explicit pricing rule for that package. Calculations identify non-included items, show the per-square-foot impact, compare an appropriate package grade when possible, and require customer confirmation before submission.
- GST, additional fixed/percentage charges, validity, inclusions, exclusions and milestone percentages are separately configurable per package. Rates and totals are recomputed server-side; client-submitted prices are ignored.
- Quotations connect to a reusable customer record and existing enquiry CRM, record activity and preserve revision snapshots. Only draft quotations may be deleted; issued quotations remain available for audit. Public quotation links are unlisted bearer links; anyone receiving a link can view that estimate.
- Use **Print / Save as PDF** in the browser to create a branded PDF. The printed proposal is an indicative estimate, not a final fixed-price contract.

## Database troubleshooting

The admin dashboard, project archive, enquiry submissions and quotation options require the PostgreSQL database configured by `DATABASE_URL`. Startup validates the URL on first database access and rejects missing or obvious placeholder hosts without logging or returning the connection string. A placeholder or unreachable database host prevents these features from loading; the application cannot safely accept enquiries or create estimates without durable storage. The operator must privately update the existing `.env` with the actual reachable PostgreSQL connection string. Then check migration status, review the exact pending migrations and current schema/data state, and apply only verified pending migrations:

```cmd
npx prisma migrate status
npm run prisma:deploy
npm run prisma:generate
```

Do not run `prisma migrate deploy` until a real database is configured and the pending migration list has been verified; take a database-provider backup before production migration. For PowerShell installations that block `npm.ps1`, run the same commands with `npm.cmd`. Never paste database credentials into issue reports or source control. The admin login configured with `ADMIN_EMAIL` and `ADMIN_PASSWORD` can authenticate without an admin-user database lookup, but dashboard data still requires PostgreSQL. APIs report database configuration/connectivity/schema failures as safe JSON `{ "code": "...", "error": "..." }` responses.

## Environment and integrations

Never copy over an existing `.env`, commit it, or put provider secrets in `NEXT_PUBLIC_*` variables.

| Capability | Configuration | What can be verified |
|---|---|---|
| Admin owner | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Sign-in uses an HTTP-only, signed, 8-hour cookie. |
| Enquiry email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ENQUIRY_NOTIFY_EMAIL` | Admin can test Resend credentials. This test does not send an email; notifications and customer acknowledgements are tracked after actual submissions. Use a verified sending domain. |
| Secure media | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Admin can test credentials; uploads and deletion call Cloudinary from the server. |
| WhatsApp | `NEXT_PUBLIC_WHATSAPP_NUMBER` or Website Settings | Click-to-chat link only; not the WhatsApp Business API. |
| Maps and social | Admin → Website Settings | Public links only; no Maps or Meta publishing API is claimed. Confirm the official map pin and account URLs. |
| Google Analytics 4 | `NEXT_PUBLIC_GA_ID` | Loads only after optional analytics consent; ID presence is not proof of event delivery. |
| Meta Pixel | `NEXT_PUBLIC_META_PIXEL_ID` | Loads only after optional analytics consent; ID presence is not proof of event delivery. |
| Search Console | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Adds the verification metadata tag; ownership must be confirmed in Search Console. |
| Site URL | `NEXT_PUBLIC_SITE_URL` | Set the real canonical HTTPS URL before production; this drives canonical metadata, sitemap and robots URLs. |

Integration status distinguishes configured credentials from actual connection tests. Facebook/Instagram are links only; follower counts and Meta APIs are intentionally absent. Cloudinary and Resend credentials are not present in the repository template and must be supplied by the operator.

## Operational notes

- Lead submissions are server-validated, rate-limited, idempotent and recorded before email delivery. Email failures are tracked for CRM retry; delivery history is retained per enquiry.
- Enquiry attachment uploads accept PDF/JPG/PNG/WebP under the documented size limits and require Cloudinary credentials. Submissions without attachments do not require Cloudinary.
- Follow-up reminders are due-date alerts in the admin notification centre; automatic scheduled email reminders require a separately configured job runner.
- The privacy policy is a draft and requires business/legal review, including retention periods and a privacy contact, before production use.
- Confirm business scope, public phone number, official social links and map pin. Replace representative stock photography with company-owned or licensed images.
- The configured PostgreSQL service must be reachable for migrations, CRM and content management. Admin dashboard errors are surfaced explicitly when the database is unavailable.

## Production checklist

1. Configure and test a production PostgreSQL database and take a backup.
2. Apply migrations with the correct baseline procedure for the database.
3. Configure secure admin owner credentials and provider secrets in the deployment platform.
4. Configure the canonical HTTPS site URL, public contact settings and verified Google Maps location.
5. Test a real enquiry, attachment, Resend notification/acknowledgement, CRM update and retry.
6. Replace illustrative images and review the privacy policy and business details.
7. Test responsive layouts, admin roles, production build and provider health checks in the target deployment environment.
