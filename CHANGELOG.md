# Changelog

## 2026-11-04 — Materials marketplace and procurement foundation

- Added additive Prisma models for suppliers, products, supplier quotations and material-rate history.
- Added migration `20261104170000_materials_marketplace_procurement`.
- Added public materials catalogue API with search/category/brand filtering and active-product visibility.
- Added public product-detail API and product detail page.
- Added approved-only public material-rate API. Pending, rejected and expired rates are never exposed.
- Added authenticated admin APIs for product CRUD/archive, supplier create/read/update, and material-rate submission/approval.
- Added admin pages for catalogue, suppliers and rate approvals, linked from the existing dashboard.
- Added public `/materials` catalogue and homepage navigation links.
- Product publication and stock availability remain explicit administrator-controlled values; no stock, market rate or supplier data is fabricated.

## 2026-11-04 — Construction operations

- Added a separate `ConstructionJob` operational record linked optionally to existing customers and quotations; the public portfolio `Project` model remains unchanged.
- Added additive migration `20261104180000_construction_operations` with eight operational models and five workflow enums.
- Added BOQ line items with quantity × unit-rate estimate calculations and optional references to currently approved material-rate records; approved rates are resolved server-side and retained as rate snapshots.
- Added direct job costs across materials, labour, equipment, transport, subcontract and other categories.
- Added supplier quotation capture with validity dates, minimum-order information and a recent quotation register.
- Added job creation from an existing customer or quotation, plus editable approved budget and contract values.
- Added purchase orders with supplier linkage, itemized values, tax totals, status controls and per-line partial delivery receipts.
- Added per-delivery item history and delivery quantity validation to prevent receiving more than the ordered quantity; draft/closed orders cannot receive items, and purchase orders cannot be marked fully received until every line is complete.
- Added customer payment receipts with pending/cleared/failed/refunded reconciliation.
- Added site progress updates with percentage, notes, blockers and optional photo URLs.
- Added an authenticated operations API and `/admin/operations` workspace.
- Actual expenditure includes direct recorded costs plus the value of received PO quantities; open procurement commitment reflects unreceived order value. This separates actual spend from outstanding commitments.
- No demo jobs, costs, supplier quotations, payments or progress records are seeded.

## Verification status

- Source and migration changes reviewed locally.
- Dependency installation could not complete because the package registry timed out / required packages were not cached.
- Prisma validation, TypeScript checks, lint and production build therefore remain pending and must be run after `npm ci` in the project environment.
- The new migration has NOT been applied to the production database.

## 2026-11-04 — Phase 6 construction control, workforce and finance

- Added additive migration `20261104190000_construction_control_finance` with BOQ approval states, PO approval metadata, project area, labour contractors/attendance/settlements, customer payment schedules and richer site report fields.
- Added batch BOQ entry, line editing, Super Admin approval/rejection and area-factor calculations based on project built-up area.
- Added contractor register, full/half-day attendance calculation, Super Admin attendance approval and settlement caps based on approved earned labour.
- Added like-for-like supplier quote comparison by product, unit and specification, with valid quote prefill and quote-reference retention on new POs.
- Added PO-to-approved-BOQ linkage, aggregate quantity limits, submit/approve/reject flow, creator self-approval prevention and configurable Super Admin approval threshold (default ₹1,00,000).
- Added multi-line delivery receipts, challan references and printable GRN documents; added atomic outstanding-quantity updates to prevent over-receipt races.
- Added customer milestone schedules, contract-value schedule cap, receipt allocation and over-collection checks; added printable customer receipt documents.
- Added Cloudinary-backed site report photo uploads and daily report fields for work, crew, weather, materials, equipment and safety.
- Added month-filtered operational financial reports and project-wise lifetime cost/contribution summaries with accounting limitations documented.
- No synthetic contractors, attendance, receipts, payments, supplier quotes or project data were seeded.


## Phase 6.1 — Release hardening and lead integrations

- Fixed nullable product catalogue fields by explicitly mapping nullable database values into form-safe strings and preserving all editable product fields.
- Removed the remaining unused-variable and conditional-expression lint findings; switched public material imagery to `next/image` with unoptimized remote rendering.
- Added optional official WhatsApp Business Cloud API enquiry alerts using an approved template, with a read-only credential/phone-number connection test.
- Added optional authenticated Google Sheets lead sync through a Google Apps Script web app, including a non-row-writing test event and setup documentation.
- Enquiry persistence remains independent from provider delivery; WhatsApp and Sheets delivery outcomes are recorded in the activity log.
