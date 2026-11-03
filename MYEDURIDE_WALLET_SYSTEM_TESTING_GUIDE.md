# MyEduRide Wallet System — Quality Assurance & Testing Runbook
**Document Version:** 1.0  
**Target Specification:** Daisaf Industrial Services Co. Ltd. (MyEduRide Wallet Spec V1.0)  
**Classification:** Financial Ledger, Pay-As-You-Go, Gate/Escort Security & Maker-Checker Custody  
**Date:** October 30, 2026  

---

## 1. Overview & Testing Objectives

This testing runbook provides a complete, step-by-step verification methodology to evaluate the robustness, security, and financial integrity of the **MyEduRide Wallet System**. 

The system operates on:
1. **Zero-Loss Integer Kobo Financial Standard**: Zero floating-point arithmetic (`300 kobo` = ₦3.00, `2,500 kobo` = ₦25.00, `5,000 kobo` = ₦50.00, `1,000,000 kobo` = ₦10,000.00, `5,000 kobo/min` = ₦50/min delay penalty).
2. **5 Distinct Wallet Accounts**: Admin (School), Parent, Escort, Daisaf (Company Revenue), and Escrow Account.
3. **Automated Metering**: Gate Manager (₦3 in / ₦3 out), School Escort (₦25 pickup / ₦25 dropoff), 2% monthly service charge.
4. **GPS Geofence & Delay Penalty**: 150-meter arrival geofence, 2-minute grace period, 1-minute scan allowance, ₦50/min delay penalty into Escrow.
5. **Maker-Checker Custody**: Mandatory reason, Accountant vetting, Super Admin approval and disbursement.

---

## 2. Test Environment Setup & Pre-Flight Checks

### 2.1 Automated Test Suite Verification
Before conducting manual or API testing, verify that the 4-tier automated test suite passes 100%:

```bash
# In the project root (/home/ebordev/Documents/2026_jobs/EduRide-project/Eduride.com-codes/myeduride)
npm test
```

**Expected Result:**
```text
================================================================================
                          FINAL TEST EXECUTION SUMMARY                          
================================================================================
  ✔ PASS Tier UNIT        : 191/191 Passed
  ✔ PASS Tier INTEGRATION : 31/31 Passed
  ✔ PASS Tier E2E         : 14/14 Passed
  ✔ PASS Tier PERFORMANCE : 19/19 Passed
--------------------------------------------------------------------------------
  ALL 255 TESTS PASSED SUCCESSFULLY across all 4 formats!
--------------------------------------------------------------------------------
```

### 2.2 Local Dev Server
Ensure the development server is active:
```bash
npm run dev
# Running on http://localhost:3000
```

---

## 3. Comprehensive Test Matrix (10 Core Scenarios)

| Test ID | Scenario | Target Entity | Core Invariant | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | School Funding Minimum Limit | School Admin | Minimum funding: ₦10,000 | Amounts < ₦10,000 rejected with 400; $\ge$ ₦10,000 initiates SeerBit checkout. |
| **TC-02** | Gate Scan Sign-In Deductions | School / Gate Officer | ₦3.00 (300 kobo) debit per scan | Deducts ₦3 from school, credits ₦3 to Daisaf revenue wallet. |
| **TC-03** | Gate Scan Sign-Out Deductions | School / Gate Officer | ₦3.00 (300 kobo) debit per scan | Deducts ₦3 from school, credits ₦3 to Daisaf revenue wallet. |
| **TC-04** | Gate Insufficient Balance Lockout | Gate Officer | Fail-closed gate transit | If school balance < ₦3, scan is halted with `402 Payment Required`. |
| **TC-05** | Escort Arrival & GPS Geofence | Escort Officer | Haversine distance $\le 150\text{m}$ | "I Am Here for Pickup" validates device GPS within 150m of student doorstep. |
| **TC-06** | Pre-Pickup Wallet Check | Parent / Escort | Sufficient transit balance | Halts escort transit if parent wallet balance < ₦25; alerts parent to top up. |
| **TC-07** | 2-Min Grace & 1-Min Scan Timer | Escort / Parent | 3-minute grace threshold | Timer displays `02:00` countdown; zero penalty if boarded within 3 minutes. |
| **TC-08** | Trip Delay Penalty Calculation | Parent / Escort | ₦50.00 / minute past 3 mins | ₦50/min debited from parent available balance into Escrow. |
| **TC-09** | Pickup & Drop-Off Pay-As-You-Go | School / Escort | ₦25 pickup + ₦25 dropoff = ₦50 | ₦25 deducted at morning boarding, ₦25 at afternoon drop-off. |
| **TC-10** | Maker-Checker Dual Authorization | Escort / Accountant / Admin | Segregation of Duties | Escort submits with reason $\rightarrow$ Accountant vets $\rightarrow$ Super Admin disburses. |

---

## 4. Step-by-Step Manual UI Testing Guide

### Scenario 1: School Wallet Minimum Funding (₦10,000 Threshold)
1. **Navigate to:** `http://localhost:3000/dashboard/school-admin/wallet`
2. **Observe UI Tariff Banner:**
   - Verify that the **Daisaf Spec V1.0 Tariff** card is visible.
   - Verify the displayed rates: Gate Scan In: `₦3.00`, Gate Scan Out: `₦3.00`, School Escort: `₦50.00`, Service Charge: `2.0%`.
3. **Open Deposit Modal:** Click **"Fund School Wallet"**.
4. **Negative Test (< ₦10,000):**
   - Enter `₦5,000` in the custom amount input.
   - Click **Proceed to Pay**.
   - **Expected Result:** Toast error: *"Minimum school wallet funding amount is ₦10,000 (Daisaf Spec Section 2.1)"*. Form submission is blocked.
5. **Positive Test ($\ge$ ₦10,000):**
   - Click the preset `₦10,000` or `₦25,000` button.
   - Click **Proceed to Pay**.
   - **Expected Result:** Spinner appears ("Connecting..."), initiates checkout, and redirects to SeerBit payment portal.

---

### Scenario 2: Escort Dashboard — "I Am Here for Pickup" & Grace Countdown
1. **Navigate to:** `http://localhost:3000/dashboard/escort`
2. **Select Mode:** Ensure trip mode is set to **"Morning Pickup"**.
3. **Locate Student Card:** Find any student in the **PICKUP QUEUE**.
4. **Trigger Arrival:**
   - Tap the amber **"I'm Here"** button.
   - The browser requests geolocation access (or utilizes pinned coordinates).
   - The system calls `POST /api/escort/confirm`.
5. **Observe Immediate UI Transitions:**
   - The **"I'm Here"** button transforms into a live countdown badge.
   - **00:00 – 02:00:** Green badge: `🟢 Grace: 01:58` (pulsing timer).
   - **02:00 – 03:00:** Amber badge: `🟡 Buffer: 00:45` (1-minute scan allowance).
   - **> 03:00:** Red badge: `🔴 +1m Delay (₦50/m)`.
6. **Confirm Boarding:**
   - Tap **"Board"** or **"Scan ID"**.
   - **Expected Result:** Boarding confirmed, student moves from Queue to **ON BOARD**, ₦25 pickup fee is debited, and any delay penalty is locked into Escrow.

---

### Scenario 3: Parent Safety Connect — Arrival Alert & Grace Countdown
1. **Navigate to:** `http://localhost:3000/dashboard/parent?tab=safety-connect` (or `School Escort` pillar).
2. **When Escort Taps "I'm Here":**
   - **Top Banner Appears:**
     ```text
     🚐 Escort Arrived at Your Residence
     "Your escort has arrived. You have 2 minutes to bring your child."
     ```
   - **Countdown Timer:** Live ticking countdown displays remaining grace time (`01:45`).
   - **Handover Code:** Student's 4-digit daily handover PIN is displayed prominently.
3. **If Parent Delays Past 3 Minutes:**
   - Banner changes to crimson warning:
     ```text
     ⚠️ Delay Penalty Active (₦50/min)
     "Delay penalty of ₦50/min is now active (1 min delay). ₦50.00 held in transit escrow."
     ```

---

## 5. API Testing Runbook (cURL Commands)

Use the following copy-pasteable `curl` commands to test the endpoints directly.

### 5.1 Check Wallet Balances
```bash
curl -X GET "http://localhost:3000/api/wallet/balance?entity_type=school&school_id=SCH-GREENWOOD" \
  -H "Content-Type: application/json" \
  -b "myeduride_session={\"user_id\":\"test-admin-id\",\"roles\":[{\"role\":\"school_admin\",\"school_id\":\"SCH-GREENWOOD\"}]}"
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "wallet_id": "...",
  "school_id": "SCH-GREENWOOD",
  "entity_type": "school",
  "currency": "NGN",
  "available_balance_kobo": 1000000,
  "available_balance_ngn": 10000.0,
  "reserved_balance_kobo": 0,
  "escrow_balance_kobo": 0,
  "status": "active"
}
```

---

### 5.2 School Deposit (Enforcing ₦10,000 Minimum)
```bash
# Negative Test (₦5,000 - Below Minimum)
curl -X POST "http://localhost:3000/api/wallet/deposit" \
  -H "Content-Type: application/json" \
  -b "myeduride_session={\"user_id\":\"test-admin-id\",\"roles\":[{\"role\":\"school_admin\",\"school_id\":\"SCH-GREENWOOD\"}]}" \
  -d '{
    "amount_ngn": 5000,
    "entity_type": "school",
    "school_id": "SCH-GREENWOOD"
  }'
```
**Expected Response (400 Bad Request):**
```json
{
  "error": "Minimum school wallet funding amount is ₦10,000"
}
```

```bash
# Positive Test (₦10,000 - Valid Funding)
curl -X POST "http://localhost:3000/api/wallet/deposit" \
  -H "Content-Type: application/json" \
  -b "myeduride_session={\"user_id\":\"test-admin-id\",\"roles\":[{\"role\":\"school_admin\",\"school_id\":\"SCH-GREENWOOD\"}]}" \
  -d '{
    "amount_ngn": 10000,
    "entity_type": "school",
    "school_id": "SCH-GREENWOOD"
  }'
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "reference": "MYEDU-SCH-...",
  "entity_type": "school",
  "amount_ngn": 10000,
  "amount_kobo": 1000000,
  "checkout_url": "https://seerbitapi.com/checkout/..."
}
```

---

### 5.3 Gate Scan Metering (₦3.00 Pay-As-You-Go)
```bash
curl -X POST "http://localhost:3000/api/gate/scan" \
  -H "Content-Type: application/json" \
  -b "myeduride_session={\"user_id\":\"test-gate-officer-id\",\"roles\":[{\"role\":\"school_admin\",\"school_id\":\"SCH-GREENWOOD\"}]}" \
  -d '{
    "school_id": "SCH-GREENWOOD",
    "student_id": "STU-001",
    "scan_direction": "sign_in"
  }'
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "scan_direction": "sign_in",
  "fee_kobo": 300,
  "fee_ngn": 3.0,
  "payer_type": "school",
  "new_balance_ngn": 9997.0
}
```

---

### 5.4 Escort Arrival ("I Am Here for Pickup")
```bash
curl -X POST "http://localhost:3000/api/escort/confirm" \
  -H "Content-Type: application/json" \
  -b "myeduride_session={\"user_id\":\"test-escort-id\",\"full_name\":\"Officer Adeyemi\",\"roles\":[{\"role\":\"escort\"}]}" \
  -d '{
    "student_id": "STU-001",
    "current_lat": 6.4533,
    "current_lng": 3.3960
  }'
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "arrival_id": "...",
  "student_id": "STU-001",
  "distance_meters": 35.4,
  "geofence_passed": true,
  "message": "Your escort has arrived. You have 2 minutes to bring your child."
}
```

---

### 5.5 Morning Pickup Verification (₦25 Deduction & Delay Finalization)
```bash
curl -X POST "http://localhost:3000/api/escort/pickup" \
  -H "Content-Type: application/json" \
  -b "myeduride_session={\"user_id\":\"test-escort-id\",\"full_name\":\"Officer Adeyemi\",\"roles\":[{\"role\":\"escort\"}]}" \
  -d '{
    "student_id": "STU-001"
  }'
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "action": "morning_pickup",
  "student_id": "STU-001",
  "fee_deducted_kobo": 2500,
  "fee_deducted_ngn": 25.0,
  "message": "Morning pickup confirmed successfully."
}
```

---

### 5.6 Afternoon Drop-Off Verification (₦25 Deduction & Ride Completion)
```bash
curl -X POST "http://localhost:3000/api/escort/dropoff" \
  -H "Content-Type: application/json" \
  -b "myeduride_session={\"user_id\":\"test-escort-id\",\"full_name\":\"Officer Adeyemi\",\"roles\":[{\"role\":\"escort\"}]}" \
  -d '{
    "student_id": "STU-001"
  }'
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "action": "afternoon_dropoff",
  "student_id": "STU-001",
  "fee_deducted_kobo": 2500,
  "fee_deducted_ngn": 25.0,
  "both_legs_completed": true,
  "message": "Afternoon doorstep drop-off confirmed successfully."
}
```

---

### 5.7 Emergency Withdrawal (Maker-Checker Step 1: User Request)
```bash
curl -X POST "http://localhost:3000/api/wallet/withdraw" \
  -H "Content-Type: application/json" \
  -b "myeduride_session={\"user_id\":\"test-escort-id\",\"full_name\":\"Officer Adeyemi\",\"roles\":[{\"role\":\"escort\"}]}" \
  -d '{
    "amount_ngn": 5000,
    "entity_type": "escort",
    "bank_code": "058",
    "bank_name": "Guaranty Trust Bank",
    "account_number": "0123456789",
    "account_name": "Adeyemi Babatunde",
    "reason": "Emergency medical treatment for spouse"
  }'
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Withdrawal request submitted successfully for compliance vetting.",
  "request": {
    "id": "REQ-WITHDRAW-...",
    "status": "PENDING_CHECKER",
    "amount_kobo": 500000,
    "amount_ngn": 5000.0,
    "reason": "Emergency medical treatment for spouse"
  }
}
```

---

### 5.8 Maker-Checker Step 2: Accountant Vetting
```bash
curl -X POST "http://localhost:3000/api/admin/approve-withdrawal" \
  -H "Content-Type: application/json" \
  -b "myeduride_session={\"user_id\":\"test-accountant-id\",\"roles\":[{\"role\":\"accountant\"}]}" \
  -d '{
    "request_id": "REQ-WITHDRAW-...",
    "action": "vet"
  }'
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "stage": "vet",
  "status": "CHECKER_APPROVED",
  "message": "Withdrawal request vetted successfully. Now pending Super Admin approval & disbursement."
}
```

---

### 5.9 Maker-Checker Step 3: Super Admin Final Approval & Payout
```bash
curl -X POST "http://localhost:3000/api/admin/approve-withdrawal" \
  -H "Content-Type: application/json" \
  -b "myeduride_session={\"user_id\":\"test-superadmin-id\",\"roles\":[{\"role\":\"super_admin\"}]}" \
  -d '{
    "request_id": "REQ-WITHDRAW-...",
    "action": "approve"
  }'
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "stage": "approve",
  "status": "DISBURSED",
  "message": "Withdrawal approved and bank payout initiated successfully."
}
```

---

## 6. Edge Cases & Robustness Assertions

| Vulnerability / Edge Case | Attack / Anomaly Vector | System Guard & Invariant | Status |
| :--- | :--- | :--- | :---: |
| **Floating Point Drift** | Submitting fractional kobo (`₦2.999`) | System converts all inputs to strict integer kobo via `Math.round(val * 100)`. | **PROTECTED** |
| **Negative Amount Theft** | Submitting `amount_ngn: -50000` to credit wallet | Filtered by `isNaN(val) \|\| val <= 0` returning 400 Bad Request. | **PROTECTED** |
| **GPS Spoofing** | Escort tapping arrival while 5km away | System calculates Haversine distance; flags if $> 150\text{m}$. | **PROTECTED** |
| **Segregation of Duties Breach** | Escort attempting to vet or approve own withdrawal | Checks `maker_user_id !== reviewer_user_id` preventing self-authorization. | **PROTECTED** |
| **Double-Spending Withdrawal** | Double-clicking withdrawal to drain wallet twice | Available balance is deducted into `reserved_balance_kobo` atomically upon request creation. | **PROTECTED** |
| **Gate Transit Deficit** | School scanning students with ₦0 balance | Pre-check enforces balance $\ge$ ₦3.00, returning `402 Payment Required` to block turnstile. | **PROTECTED** |

---

## 7. QA Sign-Off Checklist

- [ ] All 255 automated tests run cleanly via `npm test`.
- [ ] School Wallet UI displays ₦10,000 minimum deposit guidance and rejects sub-threshold inputs.
- [ ] Gate scan correctly debits ₦3 from school and credits ₦3 to Daisaf revenue.
- [ ] Gate scanner halts with funding prompt when school balance drops below ₦3.
- [ ] Escort Dashboard displays "I'm Here" button with working 2-minute countdown timer.
- [ ] Parent Safety Connect reflects live escort arrival and 2-minute grace alert.
- [ ] Delay penalty (₦50/min) is debited into Escrow when child is delayed beyond 3 minutes.
- [ ] Pickup (₦25) and Drop-off (₦25) are deducted and credited to Escrow/Daisaf.
- [ ] Evening 7:00 PM batch settlement releases escrowed earnings to Escort available balance.
- [ ] Withdrawal requests enforce mandatory reasons, Accountant vetting, and Super Admin approval.
