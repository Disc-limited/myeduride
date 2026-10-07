/**
 * MyEduRide FinTech & Payment Gateway Type Definitions
 * Strict Integer Kobo Arithmetic (₦1 = 100 kobo). Floating-point prohibited.
 */

export type WalletEntityType = 'parent' | 'escort' | 'school' | 'platform_treasury';

export type WalletStatus = 'active' | 'frozen' | 'suspended';

export type PaymentIntentStatus =
  | 'INTENT_CREATED'
  | 'PENDING_GATEWAY'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export type TransactionType = 'CREDIT' | 'DEBIT';

export type TransactionChannel =
  | 'SEERBIT_CHECKOUT'
  | 'SEERBIT_VIRTUAL_ACCOUNT'
  | 'TRIP_RESERVE'
  | 'TRIP_FARE_PICKUP'
  | 'TRIP_FARE_DROPOFF'
  | 'ESCROW_RELEASE'
  | 'WAITING_CHARGE'
  | 'CANCELLATION_FEE'
  | 'UNNECESSARY_VISIT'
  | 'WITHDRAWAL_PAYOUT'
  | 'MAINTENANCE_FEE'
  | 'REGISTRATION_FEE'
  | 'VERIFICATION_FEE'
  | 'REFUND'
  | 'SYSTEM_ADJUSTMENT';

export type EscrowHoldStatus =
  | 'HELD'
  | 'RELEASED'
  | 'REFUNDED_TO_PARENT'
  | 'DISPUTED'
  | 'PARTIAL_RELEASE';

export interface WalletRecord {
  id: string;
  user_id: string;
  entity_type: WalletEntityType;
  school_id?: string | null;
  available_balance_kobo: number;
  reserved_balance_kobo: number;
  escrow_balance_kobo: number;
  locked_balance_kobo: number;
  pending_earnings_kobo: number;
  currency: string;
  seerbit_customer_id?: string | null;
  virtual_account_number?: string | null;
  virtual_bank_name?: string | null;
  virtual_account_name?: string | null;
  virtual_account_reference?: string | null;
  payout_bank_code?: string | null;
  payout_account_number?: string | null;
  payout_account_name?: string | null;
  payout_bank_verified?: boolean;
  status: WalletStatus;
  created_at: string;
  updated_at: string;
}

export interface WalletTransactionRecord {
  id: string;
  wallet_id: string;
  counterpart_wallet_id?: string | null;
  transaction_type: TransactionType;
  channel: TransactionChannel;
  amount_kobo: number;
  balance_before_kobo: number;
  balance_after_kobo: number;
  reference: string;
  payment_intent_id?: string | null;
  trip_id?: string | null;
  trip_leg_id?: string | null;
  student_id?: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  description: string;
  metadata?: Record<string, any>;
  previous_row_hash?: string | null;
  row_integrity_hash: string;
  created_at: string;
}

export interface PaymentIntentRecord {
  id: string;
  idempotency_key: string;
  wallet_id: string;
  user_id: string;
  amount_kobo: number;
  currency: string;
  payment_method: string;
  reference: string;
  seerbit_reference?: string | null;
  status: PaymentIntentStatus;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SeerbitCheckoutInitParams {
  amountNgn: number;
  email: string;
  fullName: string;
  phoneNumber?: string;
  reference: string;
  callbackUrl?: string;
  customization?: {
    theme?: {
      border_color?: string;
      background_color?: string;
      button_color?: string;
    };
    payment_method?: string[];
  };
}

export interface SeerbitVerifyResponse {
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  message: string;
  data?: {
    code: string;
    message: string;
    payments?: {
      amount: string | number;
      paymentReference: string;
      paymentType: string;
      gatewayMessage: string;
      gatewayCode: string;
      currency: string;
      status: string;
      channelType: string;
      customer: {
        customerEmail?: string;
        customerName?: string;
        customerMobile?: string;
      };
    };
  };
}

export interface SeerbitWebhookPayload {
  notificationType: string;
  event: string;
  data: {
    code?: string;
    message?: string;
    payments?: {
      amount: string | number;
      paymentReference: string;
      paymentType?: string;
      currency?: string;
      status: string;
      gatewayMessage?: string;
      channelType?: string;
    };
    customer?: {
      customerEmail?: string;
      customerName?: string;
      customerMobile?: string;
    };
  };
}
