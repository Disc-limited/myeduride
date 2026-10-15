# MyEduRide Unified Multi-Entity Wallet & Automated Financial System
## Comprehensive Implementation, Engineering Architecture, Cybersecurity Vault Hardening & Phase Tracking Plan

**Target System:** MyEduRide School Mobility & Financial Vault  
**Document Reference:** `WALLET_SYSTEM_IMPLEMENTATION_AND_TRACKING_PLAN.md`  
**Security Reference:** `CYBERSECURITY_AND_FINANCIAL_VAULT_HARDENING_PLAN.md`  
**Standard:** Zero-Trust Architecture, CBN FinTech Guidelines, PCI-DSS Level 1 Alignments, OWASP Top 10 (2025/2026), NDPR Compliance  
**Author:** Antigravity Senior Fullstack, FinTech & Cybersecurity Systems Architect  
**Status:** In Progress / Tracking Document  

---

## 1. Executive Summary & Core Business Principles

This document establishes the end-to-end implementation and phase-by-phase execution tracking for the **Unified Multi-Entity Wallet System** (serving Parents, Schools, and Escorts), incorporating all zero-trust defense, anti-fraud, and financial vault hardening protocols defined in the [Cybersecurity & Financial Vault Hardening Plan](file:///home/ebordev/Documents/2026_jobs/EduRide-project/Eduride.com-codes/myeduride/CYBERSECURITY_AND_FINANCIAL_VAULT_HARDENING_PLAN.md).

### Fundamental Financial & Operational Invariants:
1. **Daily Pay-As-You-Go Funding (Zero Monthly Lock-in)**:
   - MyEduRide does **not** collect monthly fixed lump sums.
   - Parents and Schools fund their accounts continuously; charges occur on a pay-as-you-go daily basis.
2. **Dual-Entity Active Wallets**:
   - **Parents**: Fund wallets for daily child transport, extra lessons, and emergency rides.
   - **Schools**: Maintain an active institutional wallet for daily gate system access, visitor clearances, terminal licensing, and transit operational fees.
3. **Dual-Channel Instant Deposit Confirmation**:
   - Deposits (via SeerBit card checkout or dynamic NUBAN virtual bank transfers) reflect in real time.
   - A standardized tax invoice / digital receipt is issued via **both** the user's **registered email** and an **in-app printable receipt modal**.
4. **Gate System Daily Billing & Attendance Intelligence**:
   - Platform automatically deducts the daily gate management & security clearance fee from the school's active wallet balance each operational school day.
   - The school administrator receives automated daily intelligence detailing **present students and staff** (with exact check-in timestamps) and **absentees**.
5. **Transport Daily Escrow & Automated 7:00 PM Escort Settlement**:
   - In the morning (upon pickup cutoff), transport fare is held in safe escrow (`escrow_holds`).
   - If the parent canceled before cutoff, the escrow was already waived and refunded.
   - At **7:00 PM Lagos Time (WAT)**, the settlement engine verifies completed trips (`morning_picked_up` + `afternoon_dropped_off`) and releases the driver fare share directly into the escort's wallet.
6. **6:00 PM Night-Before Pre-Flight Balance Audit**:
   - Everyday at **6:00 PM Lagos Time (WAT)**, the system audits all parents whose children have scheduled rides for the next day.
   - **Sufficient Balance**: Sends a **Credibility Confirmation** notification confirming access to tomorrow's escort movement.
   - **Low / Insufficient Balance**: Sends an immediate **Balance Reminder & Top-Up Advisory** stating the exact required amount to ensure uninterrupted morning pickup.

---

## 2. 7-Layer Cybersecurity & Financial Vault Defense Integration

The wallet system is fortified by the **7-Layer Defensive Ring** from our Cybersecurity Architecture:

```
[ LAYER 7: CLIENT & EDGE ] ──► Cloudflare WAF, DDoS Mitigation, Velocity Rate Limiting, CSP Headers
[ LAYER 6: INGESTION ]     ──► Constant-Time HMAC Signature Check (timingSafeEqual), IP Whitelisting, Anti-Replay
[ LAYER 5: API & IDENTITY ]──► Zero-IDOR Enforcement, Cryptographic Context Binding, Strict RBAC Middleware
[ LAYER 4: BUSINESS LOGIC ]──► Financial Finite State Machine, 3-Tier Error Taxonomy, Invariant Validation
[ LAYER 3: TREASURY GOVERN]──► Maker-Checker Dual Custody, Velocity Limits (₦500k max deposit), Circuit Breaker
[ LAYER 2: DATABASE ENGINE]──► Pessimistic Row-Level Locks (SELECT FOR UPDATE), Non-Negative Constraints
[ LAYER 1: DATA AT REST ]  ──► Tamper-Evident SHA-256 Hash-Chaining, Supabase RLS Lockdown (No direct client writes)
```

### Key Security Invariants Enforced in Code & Database:
- **Integer Kobo Precision**: All balances stored as `BIGINT kobo` (`1 NGN = 100 kobo`) to eliminate floating-point rounding errors.
- **Database Mathematical Constraints**:
  - `CHECK (available_balance_kobo >= 0)`
  - `CHECK (reserved_balance_kobo >= 0)`
  - `CHECK (escrow_balance_kobo >= 0)`
  - `CHECK (locked_balance_kobo >= 0)`
  - `CHECK (amount_kobo > 0)`
- **Cryptographic Hash-Chained Ledger**:
  $$\text{Row Hash} = \text{SHA256}(\text{PrevHash} + \text{WalletID} + \text{TxType} + \text{Amount} + \text{BalanceAfter} + \text{Timestamp})$$
  Any manual SQL alteration breaks the chain and halts payouts.
- **Timing-Safe Webhook Verification**: `crypto.timingSafeEqual` prevents microsecond side-channel signature attacks.
- **Maker-Checker Dual Custody**: School and escort bank withdrawals require City Manager review with mandatory TOTP 2FA, with superadmin dual sign-off for amounts > ₦100,000.
- **Treasury Circuit Breaker**: Auto-trips if hourly platform outflow exceeds ₦3,000,000 or hash mismatches occur, preventing unauthorized capital flight.

---

## 3. Gap Analysis Matrix (Current State vs. Required Architecture)

| Component | Current State in Codebase | Required State | Vault Hardening Pillar | Tracking Status |
|---|---|---|---|:---:|
| **Parent Wallet System** | Live SeerBit card deposit, balance display, transaction history, kobo constraints. | Retain current vault integrity; add automated email receipt dispatch and printable invoice viewer. | Invariant validation & Integer kobo arithmetic | `PARTIALLY COMPLETE` |
| **School Wallet System** | Database-backed institutional wallet (`wallets` row with `entity_type='school'`), live balance, funding flows, transaction ledger. | Live database-backed school wallet (`wallets` row with `entity_type='school'`), live balance, funding flows, transaction ledger. | Zero-IDOR context binding & pessimistic locking | `COMPLETE (Phase 1)` |
| **Deposit Receipt Issuance** | In-app notification only; no email receipt or formatted tax invoice document. | Dual-channel: In-app receipt modal + automated styled HTML tax receipt emailed via `email-service.ts`. | Cryptographic receipt verification hash | `PENDING PHASE 2` |
| **Gate Daily Deduction** | Attendance check-ins logged; no automated daily platform service fee deduction from school wallet. | Automated daily deduction stored procedure; charges active school wallet per operational school day. | Non-negative constraint & idempotent deduction | `PENDING PHASE 3` |
| **Daily Attendance Digest** | Raw data in `attendance_records`; school admin must manually browse records. | Automated consolidated daily roll-call report: present students/staff with timestamps vs. absentees sent to school email & app. | Role-based tenant isolation & audit trail | `PENDING PHASE 3` |
| **7:00 PM Escort Payout** | `process_trip_fare_release` exists for individual manual trigger. | Automated 7:00 PM Lagos Time cron worker: scans completed trips and batch-credits escort wallets with push alert. | Zero-loss reconciliation assertion & escrow lock | `PENDING PHASE 4` |
| **6:00 PM Pre-Flight Audit** | Insufficient balance warning only appears when attempting morning booking. | Automated 6:00 PM Lagos Time cron worker: pre-flight audit for tomorrow's rides; sends Credibility pass or Low Balance reminder. | Financial state machine & proactive notification | `PENDING PHASE 5` |
| **Vault & Anti-Fraud Hardening** | Documented in `CYBERSECURITY_AND_FINANCIAL_VAULT_HARDENING_PLAN.md`. | Tamper-evident ledger hashing, timing-safe webhook HMAC, velocity limits, and circuit breaker implementation. | Full 7-Layer Zero-Trust Architecture | `PENDING PHASE 6` |

---

## 4. Detailed Development Phases & Task Checklist

### Phase 1: Activate School Wallet System (Live DB, APIs & Portal UI) - [COMPLETED]
- [x] **1.1 School Wallet Auto-Provisioning & Row Lockdown**:
  - Implemented `getOrCreateSchoolWallet(schoolId: string)` in `src/lib/school/school-wallet.ts`.
  - Migration 031 applied: partial unique index `idx_wallets_school_entity_unique`, column `daily_gate_fee_kobo`, stored procedure `get_or_create_school_wallet`, and backfilled 16 active schools.
  - *Hardening:* Enforced `chk_available_balance_non_negative` and non-negative constraints.
- [x] **1.2 School Wallet Backend APIs**:
  - Created `GET /api/schools/wallet`: Real-time available balance, reserved balance, monthly gate expenditure, and transaction ledger with Zero-IDOR isolation.
  - Created `POST /api/schools/wallet/deposit`: Initializes SeerBit checkout or generates dedicated virtual NUBAN account for institutional bank transfer funding with ₦5,000,000 velocity cap.
  - Created `POST /api/schools/wallet/verify`: Verifies bank/card deposit with SeerBit server and credits school wallet using atomic stored procedure `execute_atomic_wallet_credit`.
- [x] **1.3 School Admin Wallet UI Overhaul**:
  - Replaced static mock data in `src/app/dashboard/school-admin/wallet/page.tsx` with live data fetching, auto-verification of redirect checkout parameters, and Sonner toast notifications.
  - Wired dynamic balance toggle, dedicated NUBAN copy card, live transaction history table with credit/debit filters, SeerBit modal, and printable institutional receipt modal.
  - Verified with 5 unit tests in `tests/unit/school-wallet-invariants.test.ts` (193/193 overall suite tests passing).

---

### Phase 2: Instant Dual-Channel Deposit Receipts (Email + In-App Modal)
- [ ] **2.1 Standardized Cryptographic Receipt Engine**:
  - Create `src/lib/payments/receipt-engine.ts` to generate receipt data:
    - Receipt Number (`REC-YYYYMMDD-XXXX`), Transaction Reference, Gateway Ref.
    - Entity Name (Parent Full Name / School Name), User Email, Phone.
    - Net Amount, VAT (7.5%), Total Amount Paid (NGN).
    - Payment Method (`Card Checkout`, `Virtual Account Transfer`, `USSD`).
    - Formatted Timestamp (`dd MMM yyyy, hh:mm A` in `Africa/Lagos`).
    - *Hardening:* Compute SHA-256 HMAC verification hash over the receipt payload to guarantee authenticity against tampering.
- [ ] **2.2 Styled Email Receipt Template**:
  - Build `src/lib/notifications/email-templates/payment-receipt.ts` with brand typography, transaction breakdown, and printable invoice styling.
  - Integrate with `sendEmail()` in `src/lib/notifications/email-service.ts`.
- [ ] **2.3 Payment Verification & Webhook Dispatch**:
  - Update `src/app/api/parent/wallet/verify/route.ts` and `src/app/api/webhooks/seerbit/route.ts` to automatically dispatch the email receipt upon deposit success.
  - Update school deposit verification route to trigger institutional email receipts.
- [ ] **2.4 In-App Digital Receipt Modal**:
  - Build `src/components/shared/DigitalReceiptModal.tsx` allowing parents and school admins to view, print, or download official receipts for any past credit transaction.

---

### Phase 3: Gate System Daily Deduction & Daily Attendance Digest
- [ ] **3.1 Gate Fee Migration & Stored Procedure**:
  - Create migration `migrations/031_school_gate_daily_billing.sql`:
    - Add `daily_gate_fee_kobo` column to `schools` (configurable per school, default e.g. ₦2,500/day or tier-based).
    - Implement stored procedure `public.execute_daily_school_gate_deduction(p_school_id, p_date)`.
    - *Hardening:* Uses pessimistic row lock (`SELECT FOR UPDATE`) on the school wallet. Deducts fee and writes immutable `DEBIT` ledger row (`GATE_SYSTEM_DAILY_ACCESS`).
- [ ] **3.2 Automated Daily Attendance Roll-Call Engine**:
  - Create `src/lib/attendance/daily-roll-call.ts`:
    - Queries all enrolled students for the school: identifies Present (with arrival timestamps) vs. Absent.
    - Queries all active staff members: identifies Signed-In (with timestamps) vs. Absent.
    - Computes attendance rates, on-time arrivals, and late arrivals.
- [ ] **3.3 Daily School Digest Dispatch Worker**:
  - Create endpoint `src/app/api/cron/daily-gate-digest/route.ts`:
    - Runs at morning gate closure (10:00 AM Lagos Time) and end-of-day (4:00 PM Lagos Time).
    - Executes the daily gate fee deduction.
    - Dispatches a consolidated Attendance & Absentee intelligence report to school administrators via in-app alert and email.

---

### Phase 4: Transport Daily Escrow & Automated 7:00 PM Escort Settlement
- [ ] **4.1 Escrow Hold Lifecycle Enforcement**:
  - Morning pickup cutoff: Daily transport fare is held in `escrow_holds` (`status = 'HELD'`).
  - Pre-cutoff cancellation: Escrow is waived and refunded immediately to parent (`status = 'REFUNDED'`).
  - *Hardening:* Strict assertion: `(driver_share_kobo + platform_kobo) == gross_amount_kobo` enforced before escrow commitment.
- [ ] **4.2 Automated 7:00 PM Settlement Cron Worker**:
  - Create `src/app/api/cron/evening-escrow-settlement/route.ts` (triggered at 7:00 PM Lagos Time / WAT).
  - Queries all `escort_student_daily_trips` for today:
    - Verifies completion: `morning_picked_up = true` AND `afternoon_dropped_off = true` (or single-way completed leg).
    - Calls `process_trip_fare_release(studentId, tripId, escortWalletId)`:
      - Parent escrow balance deducted.
      - Platform treasury credited with platform commission & VAT.
      - Driver fare share credited to assigned escort's wallet available balance.
  - Sends high-priority push/in-app notification to the escort:
    `"💰 Daily Payout Dropped: ₦[Amount] has been credited to your available balance for today's completed rides."`
- [ ] **4.3 Exception Handling & Incomplete Trip Vaulting**:
  - Any trip that was started but not fully marked dropped off is flagged with `SETTLEMENT_HELD_FOR_REVIEW`, alerting City Manager without risking erroneous payouts.

---

### Phase 5: 6:00 PM Night-Before Pre-Flight Balance Audit & Credibility Alerts
- [ ] **5.1 6:00 PM Pre-Flight Audit Worker**:
  - Create `src/app/api/cron/pre-flight-balance-audit/route.ts` (triggered at 6:00 PM Lagos Time / WAT).
- [ ] **5.2 Next-Day Transport Requirement Calculation**:
  - Identifies tomorrow's operational school day.
  - Queries active student transport bookings for tomorrow.
  - Computes total required transport fee across all children belonging to each parent.
- [ ] **5.3 Credibility vs. Top-Up Reminder Logic**:
  - **Branch A — Credibility Confirmed (Balance >= Tomorrow's Fare)**:
    - Insert in-app notification & send email:
      - **Title**: `"✅ Escort Credibility Confirmed for Tomorrow"`
      - **Message**: `"Your wallet balance of ₦[Balance] is sufficient for tomorrow's scheduled school transport for [Children Names]. Your escort pickup is fully confirmed."`
  - **Branch B — Low Balance Top-Up Advisory (Balance < Tomorrow's Fare)**:
    - Insert urgent in-app notification & send email:
      - **Title**: `"⚠️ Top-Up Required: Fund Wallet for Tomorrow's Ride"`
      - **Message**: `"Your MyEduRide balance is ₦[Balance], which is below tomorrow's required fare of ₦[Fare]. MyEduRide operates on daily funding—please top up your wallet tonight to avoid morning pickup disruption."`
      - **Action Link**: Direct CTA opening `ParentWalletView` funding modal.

---

### Phase 6: Financial Vault Hardening & Anti-Fraud Infrastructure
- [ ] **6.1 Cryptographic Hash-Chained Ledger Trigger**:
  - Implement database trigger `trg_ledger_hash_chain` on `wallet_transactions` computing `row_integrity_hash` and `previous_row_hash` using HMAC-SHA256.
  - Provide database function `public.verify_ledger_chain(wallet_id)` to audit ledger integrity.
- [ ] **6.2 Timing-Safe Webhook Verification**:
  - Implement `verifySeerbitWebhookSignature` in `src/lib/security/webhook-security.ts` using Node.js `crypto.timingSafeEqual`.
  - Add IP allowlist validation and 5-minute timestamp anti-replay skew checks.
- [ ] **6.3 Maker-Checker Dual Custody for Bank Withdrawals**:
  - Create `withdrawal_requests` table with statuses: `PENDING_REVIEW`, `APPROVED_BY_CHECKER`, `REJECTED`, `EXECUTED`.
  - Integrate TOTP 2FA verification for City Manager approvals.
  - High-value withdrawals (> ₦100k for escorts, > ₦500k for schools) require secondary SuperAdmin approval.
- [ ] **6.4 Treasury Circuit Breaker & Velocity Limits**:
  - Implement `src/lib/security/financial-circuit-breaker.ts`:
    - Maximum single parent deposit limit: ₦500,000.
    - Maximum platform hourly payout outflow: ₦3,000,000.
    - Automated kill-switch: pauses outbound payouts if velocity limit exceeded or hash mismatches detected.

---

### Phase 7: Automated Testing & Zero-Loss Verification
- [ ] **7.1 Unit Test Suite (`tests/unit/`)**:
  - `school-wallet-invariants.test.ts`: Validates school wallet provisioning, balance non-negative constraints, and integer kobo precision.
  - `receipt-engine.test.ts`: Verifies receipt number generation, VAT breakdown, and cryptographic row integrity.
  - `evening-escrow-settlement.test.ts`: Validates 7:00 PM payout conditions (full completion vs partial trip vs canceled trip).
  - `preflight-balance-audit.test.ts`: Tests 6:00 PM threshold calculations, credibility passes, and low-balance warnings.
  - `vault-security-invariants.test.ts`: Tests constant-time HMAC check, velocity limit rejections, and tamper-evident hash chaining.
- [ ] **7.2 End-to-End Simulation**:
  - Run full simulation: Deposit ➔ Receipt Generation (Email + In-app) ➔ 6:00 PM Audit ➔ Morning Escrow Hold ➔ Afternoon Drop-off ➔ 7:00 PM Escort Settlement.
- [ ] **7.3 TypeScript & Build Verification**:
  - Clean `npx tsc --noEmit` validation.

---

## 5. Operational Schedule & Cron Execution Timetable

| Time (Lagos / WAT) | Operational Worker | Responsible Engine | Purpose |
|---|---|---|---|
| **06:00 PM (Daily)** | Pre-Flight Balance Audit | `pre-flight-balance-audit/route.ts` | Checks parent balances for tomorrow's rides; sends Credibility pass or Top-Up reminder. |
| **07:15 AM (Morning)** | Pickup Cutoff & Fee Commitment | `pickup-cutoff.ts` & `TripFareEngine` | Locks cancellation window; holds morning transport fee in escrow. |
| **10:00 AM (Morning)** | Gate Daily Deduction & Roll-Call | `daily-gate-digest/route.ts` | Deducts school gate platform fee; sends morning attendance & absentee summary. |
| **04:00 PM (Afternoon)** | End-of-Day Gate Digest | `daily-gate-digest/route.ts` | Sends final student/staff departure & safe arrival digest to school admin. |
| **07:00 PM (Evening)** | Daily Escrow Settlement | `evening-escrow-settlement/route.ts` | Batch releases completed trip escrow into escort wallets with instant notification. |
| **11:59 PM (Nightly)** | Ledger Integrity Audit | `verify_ledger_chain()` cron | Verifies tamper-evident SHA-256 hash chains across all active wallets. |

---

## 6. Progress Tracking Log

| Date | Phase / Milestone | Status | Details |
|---|---|:---:|---|
| *2026-10-14* | **Plan Approved & Documented** | ✅ Completed | Comprehensive architecture & cybersecurity integration document created. |
| *2026-10-14* | **Phase 1: School Wallet System** | ⏳ In Queue | Provisioning database tables, school wallet endpoints, and live UI overhaul. |
| *2026-10-14* | **Phase 2: Deposit Receipts** | ⏳ In Queue | Dual-channel receipt engine, email invoice delivery, and in-app printable receipt modal. |
| *2026-10-14* | **Phase 3: Gate Deductions & Digest**| ⏳ In Queue | Daily gate fee stored procedure and present/absentee intelligence roll-call engine. |
| *2026-10-14* | **Phase 4: 7:00 PM Escrow Settlement**| ⏳ In Queue | Evening escrow settlement worker, completion checks, and driver wallet drop. |
| *2026-10-14* | **Phase 5: 6:00 PM Pre-Flight Audit** | ⏳ In Queue | Next-day movement balance audit, credibility confirmation, and top-up reminders. |
| *2026-10-14* | **Phase 6: Vault Hardening & Anti-Fraud** | ⏳ In Queue | Tamper-evident ledger hash trigger, timing-safe HMAC, maker-checker TOTP, circuit breaker. |
| *2026-10-14* | **Phase 7: Testing & Verification** | ⏳ In Queue | Automated unit/integration test suites, ledger reconciliation, and TypeScript build clean. |
