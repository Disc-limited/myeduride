# National Identification Number (NIN) Verification API Integration Document
**Project:** EduRide Platform (`myeduride`)  
**Document Type:** Technical & Commercial Implementation Architecture Plan  
**Target Audience:** Engineering Team, Product Managers, Exec Board  
**Date:** August 2026  
**Status:** Draft / Proposal  

---

## 1. Executive Summary & Purpose

The **EduRide Platform** requires robust identity verification for platform participants—specifically **Escorts, Drivers, School Staff, and Parents**. Verifying users via Nigeria's **National Identification Number (NIN)** ensures student safety, prevents impersonation at school gate check-ins, and complies with national security standards and the **Nigeria Data Protection Act (NDPA)**.

This document details:
1. **API Vendor Comparison & Pricing** (Per-verification cost breakdown in NGN and USD across top Nigerian KYC providers).
2. **Integration Architecture** for the Next.js / Supabase EduRide codebase.
3. **API Technical Specs & Endpoints** (Request/Response schemas).
4. **Database Schema & Data Privacy (NDPR Compliance)**.
5. **UI/UX Integration** into existing registration wizards (e.g., `EscortRegistrationWizard.tsx`).
6. **Implementation Roadmap & Estimated Costs**.

---

## 2. API Provider Comparison & Pricing Breakdown

In Nigeria, direct access to the **National Identity Management Commission (NIMC)** database is regulated and typically accessed through licensed Identity Verification Service Providers (IVSPs). The top 5 market-tested identity verification providers for NIN verification are:

| Provider | Supported Verification Modes | Pricing per Successful Verification (NGN) | USD Equivalent (Approx) | Billing Model / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Prembly (Identitypass)** *(Recommended)* | - Standard 11-digit NIN<br>- Virtual NIN (vNIN)<br>- NIN + Face Match (Biometrics) | **₦50 – ₦150** / verification | **$0.03 – $0.10** | • Pay-As-You-Go & Tiered Volume Discounts<br>• Free Sandbox for testing<br>• Fast response time (~800ms) |
| **Dojah.io** | - vNIN Lookup<br>- Standard NIN<br>- NIN + Selfie Biometric | **₦60 – ₦180** / verification | **$0.04 – $0.12** | • Pay-As-You-Go<br>• **₦50,000** initial wallet top-up required<br>• Webhook notifications supported |
| **Smile ID (Smile Identity)** | - Basic NIN Check<br>- Enhanced NIN + Facial Recognition (SmartSelfie™) | **₦80 – ₦250** / verification | **$0.05 – $0.16** | • High accuracy face matching<br>• Ideal for high-risk verification (Escorts/Drivers) |
| **QoreID (VerifyMe)** | - vNIN & Standard NIN<br>- NIN + Address Verification bundle | **₦60 – ₦200** / verification | **$0.04 – $0.13** | • Enterprise pricing tiers<br>• Includes detailed verification audit logs |
| **Monnify (Moniepoint)** | - Basic NIN / vNIN Verification | **₦60** flat / verification | **$0.04** | • Transparent flat-rate pricing<br>• Integrated with payment gateway wallet |

### 💡 Recommendation for EduRide

1. **Primary Provider:** **Prembly (Identitypass)** — Best balance of pricing (₦50–₦100/call at scale), speed, and comprehensive support for both **Virtual NIN (vNIN)** and **Face Verification**.
2. **Secondary / Fallback Provider:** **Dojah.io** or **Monnify** — Ensures high uptime via automatic fallback if NIMC or Prembly experiences upstream downtime.

---

## 3. Financial & Cost Projections

| User Type | Estimated Monthly Verifications | Recommended Verification Tier | Cost per Unit | Estimated Monthly Spend |
| :--- | :--- | :--- | :--- | :--- |
| **Escorts (Riders/Guards)** | 500 / month | NIN + Face Match (Prembly/Smile ID) | ~₦120 | ₦60,000 ($40 USD) |
| **School Drivers** | 200 / month | NIN + Face Match (Prembly/Smile ID) | ~₦120 | ₦24,000 ($16 USD) |
| **Parents** | 2,000 / month | Basic vNIN Lookup (Prembly/Monnify) | ~₦60 | ₦120,000 ($80 USD) |
| **School Staff / Admins** | 100 / month | Basic vNIN Lookup | ~₦60 | ₦6,000 ($4 USD) |
| **Total Estimated Monthly Cost** | **2,800 checks** | — | — | **₦210,000 (~$140 USD)** |

> 💰 **Cost Recovery Strategy:**  
> • **Escorts & Drivers:** Verification fee can be deducted from onboarding/registration fees or absorbed as operational safety budget.  
> • **Parents:** Included in the annual/termly EduRide school safety portal licensing fee.

---

## 4. Technical Integration Architecture

### System Flow Diagram

```
[User / Escort / Parent]
        │
        ▼ (Submits vNIN / NIN + Consent)
[EduRide Client (React / TSX)]
        │
        ▼ (POST /api/v1/verification/nin)
[EduRide API Middleware (Next.js Server)]
   ├── 1. Validates Auth Token & Rate Limits
   ├── 2. Sanitizes input & Logs Consent Timestamp
   ├── 3. Calls Prembly API (Server-to-Server)
   │        │
   │        ├─── [Success] ──► Returns Masked Data & Photo Match Score
   │        └─── [Downtime Fail] ──► Auto Fallback to Dojah / Monnify API
   │
   ├── 4. Stores Masked Result in Supabase (`escorts` / `parents` table)
   └── 5. Returns Verification Response to Client
```

---

## 5. Next.js Backend Implementation Specifications

### Environment Variables setup (`.env.local`)

```env
# NIN Verification Gateway Config
NIN_VERIFICATION_PROVIDER=prembly # prembly | dojah | monnify
PREMBLY_BASE_URL=https://api.prembly.com
PREMBLY_APP_ID=your_prembly_app_id
PREMBLY_SECRET_KEY=your_prembly_secret_key

# Secondary Fallback Provider
DOJAH_BASE_URL=https://api.dojah.io
DOJAH_APP_ID=your_dojah_app_id
DOJAH_SECRET_KEY=your_dojah_secret_key
```

### Proposed API Route: `src/app/api/v1/verification/nin/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface NinVerificationBody {
  ninNumber: string; // Can be 11-digit NIN or 16-character vNIN
  userType: 'escort' | 'parent' | 'driver' | 'staff';
  targetUserId: string;
  userConsent: boolean;
  userLivePhotoUrl?: string; // Optional for Face Matching
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized request' }, { status: 401 });
    }

    const body: NinVerificationBody = await req.json();

    if (!body.ninNumber || !body.userConsent) {
      return NextResponse.json(
        { error: 'NIN number and explicit user consent are required' },
        { status: 400 }
      );
    }

    // 1. Sanitize input (strip spaces/dashes)
    const cleanedNin = body.ninNumber.replace(/\D/g, '');

    // 2. Call Prembly Verification API (Server-side)
    const premblyResponse = await fetch(`${process.env.PREMBLY_BASE_URL}/identitypass/verification/nin`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.PREMBLY_SECRET_KEY || '',
        'app-id': process.env.PREMBLY_APP_ID || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: cleanedNin,
      }),
    });

    const result = await premblyResponse.json();

    if (!premblyResponse.ok || !result.status) {
      // Log failure & trigger fallback provider if applicable
      console.error('[NIN-Verify] Prembly error:', result);
      return NextResponse.json(
        { 
          success: false, 
          message: result.detail || 'NIN Verification failed. Please verify input details.' 
        },
        { status: 422 }
      );
    }

    const ninData = result.data; // Includes firstName, lastName, dob, gender, photo, maskedNIN

    // 3. Mask NIN for Storage compliance (NDPR)
    const maskedNin = `NIN-****-${cleanedNin.slice(-4)}`;

    // 4. Update Database Record
    const updateTable = body.userType === 'escort' ? 'escorts' : 'parents';
    const { error: dbError } = await supabase
      .from(updateTable)
      .update({
        nin_masked: maskedNin,
        nin_verified: true,
        nin_verification_ref: result.reference || `REF-${Date.now()}`,
        nin_verified_at: new Date().toISOString(),
        first_name: ninData.firstname || undefined,
        last_name: ninData.lastname || undefined,
      })
      .eq('id', body.targetUserId);

    if (dbError) {
      console.error('[NIN-Verify] Database update error:', dbError);
    }

    return NextResponse.json({
      success: true,
      maskedNin,
      verificationStatus: 'VERIFIED',
      matchedData: {
        firstName: ninData.firstname,
        lastName: ninData.lastname,
        gender: ninData.gender,
        verifiedAt: new Date().toISOString(),
      },
    });

  } catch (err: any) {
    console.error('[NIN-Verify] Server exception:', err);
    return NextResponse.json(
      { error: 'Internal server error processing verification' },
      { status: 500 }
    );
  }
}
```

---

## 6. Database Schema Updates (Supabase / PostgreSQL)

To store verification state without violating NDPR raw PII storage rules, execute the following SQL migration:

```sql
-- Migration: Add NIN Verification Columns to Users/Escorts/Parents

ALTER TABLE escorts
ADD COLUMN IF NOT EXISTS nin_masked VARCHAR(20),
ADD COLUMN IF NOT EXISTS nin_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS nin_verification_ref VARCHAR(100),
ADD COLUMN IF NOT EXISTS nin_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS nin_confidence_score NUMERIC(5,2);

ALTER TABLE parents
ADD COLUMN IF NOT EXISTS nin_masked VARCHAR(20),
ADD COLUMN IF NOT EXISTS nin_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS nin_verification_ref VARCHAR(100),
ADD COLUMN IF NOT EXISTS nin_verified_at TIMESTAMPTZ;

-- Index for fast lookup on verification state
CREATE INDEX IF NOT EXISTS idx_escorts_nin_verified ON escorts(nin_verified);
CREATE INDEX IF NOT EXISTS idx_parents_nin_verified ON parents(nin_verified);
```

---

## 7. Data Privacy & NDPR Compliance Checklist

Under the **Nigeria Data Protection Regulation (NDPR)** and **NDPA 2023**:

1. ✅ **Explicit Consent:** A mandatory consent checkbox must be presented to the user:
   > *"I consent to EduRide verifying my National Identification Number with NIMC for safety and security purposes."*
2. ✅ **No Plaintext NIN Storage:** Only store `nin_masked` (e.g., `NIN-****-5829`) and the provider `verification_ref`. Never store raw 11-digit NINs in static database tables.
3. ✅ **Encrypted In-Transit:** All requests between EduRide client, server, and IVSP APIs must use HTTPS / TLS 1.3.
4. ✅ **Audit Trail:** Maintain log records of who requested verification, timestamp, and verification status for compliance audits.

---

## 8. Frontend Integration Plan (e.g. `EscortRegistrationWizard.tsx`)

In **Step 3 (Identity Verification)** of `EscortRegistrationWizard.tsx`:

1. User selects **ID Type: National Identification Number (NIN / vNIN)**.
2. User enters **11-digit NIN** or **16-digit vNIN**.
3. User checks the mandatory **NDPR Consent Checkbox**.
4. User clicks **"Verify NIN"**.
5. UI displays an active verification indicator.
6. Upon HTTP 200 response:
   - Displays a green badge: **"Verified with NIMC Database"**.
   - Auto-fills verified First Name, Last Name, and Date of Birth.
   - Disables editing on verified fields to prevent fraud.

---

## 9. Implementation Roadmap & Timeline

| Phase | Task | Duration | Deliverable |
| :--- | :--- | :--- | :--- |
| **Phase 1: Setup** | Sign up with Prembly / Dojah; acquire Sandbox & Production API keys; top up wallet. | Day 1 - 2 | API Keys & Secret Management in Vercel / `.env` |
| **Phase 2: Backend** | Create Next.js API route `/api/v1/verification/nin` + Supabase database migration. | Day 3 - 4 | Tested Server API endpoint with rate limiting |
| **Phase 3: Frontend** | Integrate API call into `EscortRegistrationWizard.tsx` & `ParentRegistrationWizard.tsx`. | Day 5 - 6 | Interactive verification step in onboarding wizards |
| **Phase 4: QA & Live** | Test sandbox mock cases (Valid NIN, Invalid NIN, Network Failure) and switch to Production keys. | Day 7 | Production live deployment |

---

## 10. Summary Recommendation

By deploying **Prembly (Identitypass)** as the primary provider with **Dojah** as an automated fallback:
- **Cost per verification:** ~**₦50 – ₦100** per verified identity.
- **Monthly estimated budget (2,800 verifications):** ~**₦210,000 NGN ($140 USD)**.
- **Security Rating:** High (Fully NDPR compliant with masked data storage and server-side secret management).
