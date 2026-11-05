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

## Materials marketplace and procurement (2026-11-04)

The project now includes a materials catalogue foundation:

- Public catalogue: `/materials`
- Public product detail: `/materials/[slug]`
- Admin product catalogue: `/admin/materials`
- Admin suppliers: `/admin/suppliers`
- Admin material-rate approval: `/admin/rates`

### Database migration

The additive migration is `prisma/migrations/20261104170000_materials_marketplace_procurement`.

After reviewing the migration and confirming the intended database target, run these Windows CMD commands from the project root:

```cmd
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npm run typecheck
npm run lint
npm run build
```

Do not use `prisma db push` or `prisma migrate reset`. The migration is not applied automatically by this code package. Ensure `DATABASE_URL` points to the intended Neon database before running deployment commands.

Products are private drafts by default (`active=false`). Only explicitly published products appear in the public catalogue. Material rates are created with `PENDING` status and only approved, effective, unexpired rates are returned by `/api/material-rates`. No market rates or inventory are seeded.
\n## Construction operations (Phase 5)

The authenticated `/admin/operations` workspace connects project delivery records without repurposing the public portfolio `Project` model.

- Construction jobs can optionally link to an existing customer and quotation.
- BOQ items calculate line estimates as quantity × unit rate and can optionally reference a currently approved material-rate record. The server resolves the approved rate and snapshots it onto the BOQ line.
- Direct costs are categorized as material, labour, equipment, transport, subcontract or other.
- Supplier quotations retain supplier, material, unit, rate, minimum order and validity details.
- Purchase orders contain supplier-linked line items, tax and totals. Delivery receipts retain per-delivery item quantities, track cumulative received quantities and prevent over-receipt.
- Customer receipts support pending, cleared, failed and refunded statuses.
- Site progress updates retain percentage, narrative, blockers and optional photo URLs.
- Actual expenditure is calculated from direct job costs plus received purchase-order quantities. Unreceived purchase-order value is reported separately as procurement commitment. Avoid recording the same PO delivery again as a direct material cost.

### Phase 5 migration and deployment

Back up the database, then from the project root run:

```cmd
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm run typecheck
npm run lint
npm run build
```

The new additive migration is `20261104180000_construction_operations`. Apply it only after reviewing the target database and existing migration status. Do not run `prisma db push` against production as a substitute for the migration history.


## Construction control, workforce and finance (Phase 6)

The `/admin/operations` workspace now includes the following additive workflows:

- **BOQ editing and approval:** add up to three estimate lines in one batch, edit draft/rejected lines, submit the job BOQ for review, and have the Super Admin approve/reject pending lines. Approved and pending-review lines are locked against editing.
- **Area-based quantity calculation:** set the project's built-up area in square feet. BOQ lines may use `PROJECT_AREA`, with the estimator entering a material factor per square foot; the server calculates `quantity = projectAreaSqFt × areaFactor`. This is a configurable estimator factor, not an automatically inferred engineering quantity.
- **Labour attendance:** maintain contractor/trade records, record full-day and half-day headcount by project/date, calculate labour accrual, and require Super Admin approval before attendance enters actual project cost.
- **Contractor settlement:** record pending/paid contractor payments and prevent settlement above approved attendance earnings less existing payment commitments. Payments are treated as settlement of labour accrual, not an additional expense.
- **Supplier comparison:** compare recorded supplier quotations grouped by product, unit and specification, sorted by quoted rate. A selected current quote can prefill supplier, item, unit and rate on a new purchase order; the quote reference is retained in the PO notes. Verify delivery terms, tax and quality before selection.
- **Purchase-order approval:** each new PO line must map to an approved BOQ item and the aggregate ordered quantity cannot exceed the approved BOQ quantity. Submit for approval; the creator cannot approve their own PO. Admin approval is limited to the configurable `PURCHASE_ORDER_SUPER_ADMIN_THRESHOLD` (default ₹1,00,000); larger POs require Super Admin approval. Approved POs can then be marked sent.
- **Delivery / GRN:** record multi-line partial deliveries, delivery challan reference, receiver and notes. Each receipt has a printable `/admin/operations/grn/[id]` document; use the browser's Print / Save as PDF control to download it. Delivery quantities are protected against concurrent over-receipt.
- **Customer payment schedule and receipts:** create dated milestones whose total cannot exceed contract value, allocate customer receipts to milestones, prevent over-collection, and print receipts at `/admin/operations/receipt/[id]`.
- **Daily site reports:** capture work done, blockers, weather, crew count, materials, equipment, safety notes and up to four JPEG/PNG/WebP photographs. Photographs use the existing server-side Cloudinary integration under `ns-construction/site-reports`.
- **Project and monthly finance views:** project lifetime contribution compares contract value with recorded costs. `/admin/operations/reports` provides month-scoped direct costs, approved labour accrual, received procurement, cleared customer collections and contractor cash paid.

### Financial interpretation

Actual project cost includes direct `JobCost` entries, the value of received purchase-order quantities (including proportionally allocated PO tax), and approved labour attendance. Contractor payments settle labour accrual and are not added again as a second cost. Avoid entering a labour attendance expense again as a manual labour `JobCost` line.

The project contribution figure is an operational estimate (`contract value - recorded lifetime costs`), not a statutory accounting P&L. Monthly collections less contractor payments is a partial cash movement view; supplier invoice payments and other cash settlements are not represented as a complete cash ledger.

### Phase 6 migration and deployment

New additive migration: `20261104190000_construction_control_finance`.

Back up the Neon database and check the migration history before deployment. From the project root in Windows CMD:

```cmd
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm run typecheck
npm run lint
npm run build
```

The site-report photo upload needs the existing Cloudinary credentials configured in the Vercel project environment. Do not commit real `.env` files or credentials.


### Optional lead integrations: WhatsApp Cloud API and Google Sheets

New website enquiries can be delivered to the business WhatsApp number through the official Meta WhatsApp Business Cloud API and mirrored into a Google Sheet through a secured Google Apps Script web app. Both integrations are optional; the enquiry is saved to PostgreSQL even when either provider is not configured or temporarily unavailable. Delivery outcomes are recorded in the activity log.

**WhatsApp Cloud API setup**

1. Create/configure a WhatsApp Business app in Meta for Developers and add a WhatsApp Business phone number.
2. Create a long-lived system-user access token with the required WhatsApp messaging permissions. Keep it server-side only.
3. Make sure the business notification recipient has opted in to receive WhatsApp messages. Create and get approval for a utility template named `new_enquiry_alert` (or set another template name). Its body must contain exactly five text placeholders, in this order: customer name, customer phone, project type, project location, enquiry ID. The app sends a template to the business notification number; it does not initiate free-form customer conversations.
4. Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`, `WHATSAPP_NOTIFY_PHONE`, `WHATSAPP_TEMPLATE_NAME`, and `WHATSAPP_TEMPLATE_LANGUAGE` in the deployment environment. `WHATSAPP_NOTIFY_PHONE` must include the country code and digits only (for example, `91...`).
5. Open Admin → Integrations and test the connection. The test reads the registered phone-number profile and does not send a WhatsApp message. Submit a real test enquiry to verify template delivery.

**Google Sheets setup**

1. Create a Google Sheet and open Extensions → Apps Script.
2. Add the script below. In Project Settings → Script Properties, add `NS_WEBHOOK_SECRET` with a long random value. Keep the same value in `GOOGLE_SHEETS_WEBHOOK_SECRET` on the server.
3. Deploy as a Web app, execute as yourself, and allow access to anyone. The secret in the request body authenticates the webhook. Copy the `/exec` URL into `GOOGLE_SHEETS_WEBHOOK_URL`.
4. Test from Admin → Integrations. The `integration.test` event is intentionally acknowledged without adding a row. Submit a real test enquiry to confirm the `Enquiries` tab receives a row.

```javascript
function doPost(e) {
  const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
  const expected = PropertiesService.getScriptProperties().getProperty("NS_WEBHOOK_SECRET");
  if (!expected || payload.secret !== expected) return json({ ok: false, error: "Unauthorized" });
  if (payload.event === "integration.test") return json({ ok: true, test: true });
  if (payload.event !== "enquiry.created" || !payload.enquiry) return json({ ok: false, error: "Unsupported event" });

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Enquiries") ||
    SpreadsheetApp.getActiveSpreadsheet().insertSheet("Enquiries");
  if (sheet.getLastRow() === 0) sheet.appendRow([
    "Enquiry ID", "Created At", "Name", "Phone", "Email", "Project Type", "Location",
    "Area", "Floors", "Budget", "Services", "Timeline", "Message", "Source"
  ]);
  const q = payload.enquiry;
  const idColumn = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat() : [];
  if (idColumn.includes(q.id)) return json({ ok: true, duplicate: true });
  const safeCell = (value) => {
    const text = String(value == null ? "" : value);
    return /^[=+@\-\t\r]/.test(text) ? "\u0027" + text : text;
  };
  sheet.appendRow([
    q.id, q.createdAt, safeCell(q.name), safeCell(q.phone), safeCell(q.email), safeCell(q.projectType), safeCell(q.location),
    safeCell(q.projectArea), safeCell(q.floors), safeCell(q.budget), safeCell((q.services || []).join(", ")),
    safeCell(q.timeline), safeCell(q.message), safeCell(q.source || "Website")
  ]);
  return json({ ok: true });
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Do not put provider tokens, webhook secrets, or database credentials in `NEXT_PUBLIC_*` variables or client-side code. Rotate any secret that has been shared publicly. Provider delivery is best-effort and does not block enquiry creation.
