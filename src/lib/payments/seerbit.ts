import { SeerbitCheckoutInitParams, SeerbitVerifyResponse } from './types';

export class SeerBitClient {
  private static apiUrl = process.env.SEERBIT_API_URL || 'https://seerbitapi.com/api/v2';
  private static publicKey = process.env.SEERBIT_PUBLIC_KEY || '';
  private static secretKey = process.env.SEERBIT_SECRET_KEY || '';
  private static callbackUrl = process.env.SEERBIT_CALLBACK_URL || 'https://myeduride.com/dashboard/parent?tab=wallet';

  private static cachedToken: string | null = null;
  private static tokenExpiresAt: number = 0;

  /**
   * Retrieves or refreshes Bearer Auth Token from SeerBit encrypted token API
   */
  public static async getAuthToken(): Promise<string> {
    if (!this.secretKey) {
      console.warn('[SeerBit] SEERBIT_SECRET_KEY not set. Using test mock token.');
      return 'TEST_MOCK_BEARER_TOKEN';
    }

    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    try {
      const res = await fetch(`${this.apiUrl}/encrypt/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `${this.secretKey}.${this.publicKey}` }),
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        throw new Error(`Failed to authenticate with SeerBit: ${res.statusText}`);
      }

      const data = await res.json();
      const token = data.data?.EncryptedSecKey?.encryptedKey || data.data?.token || '';
      if (!token) {
        throw new Error('No encrypted token returned from SeerBit');
      }

      this.cachedToken = token;
      // Cache token for 15 minutes
      this.tokenExpiresAt = Date.now() + 15 * 60 * 1000;
      return token;
    } catch (err: any) {
      console.warn('[SeerBit] Auth token request warning, falling back to SecretKey direct:', err.message);
      return this.secretKey;
    }
  }

  /**
   * Initializes a standard SeerBit Checkout session for Card, USSD, or Bank Transfer
   */
  public static async initializePayment(params: SeerbitCheckoutInitParams): Promise<{
    success: boolean;
    reference: string;
    checkoutUrl?: string;
    publicKey: string;
    error?: string;
  }> {
    const pubKey = this.publicKey || 'SBTESTPUBK_MOCK_KEY';

    const targetCallback = params.callbackUrl || this.callbackUrl;
    const separator = targetCallback.includes('?') ? '&' : '?';

    // If sandbox / test mock environment
    if (!this.secretKey || this.secretKey.startsWith('SBTESTSECK_MOCK')) {
      return {
        success: true,
        reference: params.reference,
        checkoutUrl: `${targetCallback}${separator}reference=${params.reference}&mock_success=true`,
        publicKey: pubKey,
      };
    }

    try {
      const token = await this.getAuthToken();
      const sanitizedFullName =
        (params.fullName || 'MyEduRide User')
          .replace(/[^a-zA-Z\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim() || 'MyEduRide Customer';

      const payload = {
        publicKey: pubKey,
        amount: params.amountNgn.toFixed(2),
        currency: 'NGN',
        country: 'NG',
        paymentReference: params.reference,
        email: params.email,
        fullName: sanitizedFullName,
        mobileNumber: params.phoneNumber || '',
        callbackUrl: params.callbackUrl || this.callbackUrl,
        customization: params.customization || {
          theme: {
            border_color: '#059669',
            background_color: '#FFFFFF',
            button_color: '#059669',
          },
          payment_method: ['card', 'account', 'transfer', 'ussd'],
        },
      };

      const res = await fetch(`${this.apiUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'SUCCESS') {
        const errorMsg = data.data?.message || data.message || 'SeerBit checkout initialization failed';
        console.error('[SeerBit] Checkout init failed response:', data);
        return {
          success: false,
          reference: params.reference,
          publicKey: pubKey,
          error: errorMsg,
        };
      }

      return {
        success: true,
        reference: params.reference,
        checkoutUrl: data.data?.payments?.redirectLink || data.data?.redirectLink,
        publicKey: pubKey,
      };
    } catch (err: any) {
      console.error('[SeerBit] initializePayment exception:', err);
      return {
        success: false,
        reference: params.reference,
        publicKey: pubKey,
        error: err.message || 'Payment provider communication error',
      };
    }
  }

  /**
   * Verifies transaction status directly from SeerBit server-to-server API
   */
  public static async verifyPayment(paymentReference: string): Promise<SeerbitVerifyResponse> {
    if (!this.secretKey || this.secretKey.startsWith('SBTESTSECK_MOCK')) {
      // Mock sandbox verification
      return {
        status: 'SUCCESS',
        message: 'Mock payment verified successfully',
        data: {
          code: '00',
          message: 'Approved',
          payments: {
            amount: 5000,
            paymentReference,
            paymentType: 'CARD',
            gatewayMessage: 'Approved by Financial Network',
            gatewayCode: '00',
            currency: 'NGN',
            status: 'SUCCESS',
            channelType: 'CARD',
            customer: {
              customerEmail: 'parent@myeduride.com',
              customerName: 'MyEduRide Parent',
            },
          },
        },
      };
    }

    try {
      const token = await this.getAuthToken();
      const res = await fetch(`${this.apiUrl}/payments/query/${encodeURIComponent(paymentReference)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          status: 'FAILED',
          message: data.message || 'Verification failed on gateway',
        };
      }

      return data as SeerbitVerifyResponse;
    } catch (err: any) {
      console.error('[SeerBit] verifyPayment exception:', err);
      return {
        status: 'FAILED',
        message: err.message || 'Network exception verifying payment',
      };
    }
  }

  /**
   * Generates a dedicated Virtual NUBAN Bank Account for parent/school bank transfer deposits
   * Official SeerBit API Endpoint: POST https://seerbitapi.com/api/v2/virtual-accounts
   */
  public static async createVirtualAccount(params: {
    fullName: string;
    email: string;
    phoneNumber?: string;
    reference: string;
    bvn?: string;
  }): Promise<{
    accountNumber?: string;
    bankName?: string;
    accountName?: string;
    reference: string;
  }> {
    if (!this.secretKey || this.secretKey.startsWith('SBTESTSECK_MOCK')) {
      return {
        accountNumber: `081${Math.floor(1000000 + Math.random() * 9000000)}`,
        bankName: undefined,
        accountName: undefined,
        reference: params.reference,
      };
    }

    try {
      const token = await this.getAuthToken();
      const res = await fetch(`${this.apiUrl}/virtual-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          publicKey: this.publicKey,
          fullName: params.fullName.trim(),
          bankVerificationNumber: params.bvn?.trim() || '',
          currency: 'NGN',
          country: 'NG',
          reference: params.reference,
          email: params.email.trim(),
        }),
        signal: AbortSignal.timeout(8000),
      });

      const data = await res.json();
      if (!res.ok || (data.status && data.status !== 'SUCCESS')) {
        console.warn('[SeerBit] Virtual account creation response status:', data);
      }

      const paymentsObj = data.data?.payments || data.data?.wallet || data.data;
      const accountNumber =
        paymentsObj?.accountNumber || paymentsObj?.wallet || data.data?.accountNumber;
      const bankName = paymentsObj?.bankName ? String(paymentsObj.bankName).trim() : undefined;
      const accountName = paymentsObj?.walletName || paymentsObj?.accountName
        ? String(paymentsObj.walletName || paymentsObj.accountName).trim()
        : undefined;

      if (res.ok && (data.status === 'SUCCESS' || accountNumber)) {
        return {
          accountNumber: accountNumber ? String(accountNumber) : undefined,
          bankName,
          accountName,
          reference: params.reference,
        };
      }
    } catch (e) {
      console.warn('[SeerBit] createVirtualAccount error:', e);
    }

    // Graceful fallback - strictly generated by SeerBit, no hardcoded bankName or accountName
    return {
      accountNumber: undefined,
      bankName: undefined,
      accountName: undefined,
      reference: params.reference,
    };
  }

  /**
   * Retrieves virtual account details from SeerBit by payment/merchant reference
   * Official SeerBit API Endpoint: GET https://seerbitapi.com/api/v2/virtual-accounts/{{paymentreference}}
   */
  public static async getVirtualAccount(reference: string): Promise<{
    accountNumber?: string;
    bankName?: string;
    accountName?: string;
    reference: string;
    status?: string;
  } | null> {
    if (!this.secretKey || this.secretKey.startsWith('SBTESTSECK_MOCK')) {
      return null;
    }

    try {
      const token = await this.getAuthToken();
      const res = await fetch(`${this.apiUrl}/virtual-accounts/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8000),
      });

      const data = await res.json();
      if (!res.ok) {
        console.warn('[SeerBit] getVirtualAccount failed:', data);
        return null;
      }

      const paymentsObj = data.data?.payments || data.data?.wallet || data.data;
      const accountNumber =
        paymentsObj?.accountNumber || paymentsObj?.wallet || data.data?.accountNumber;

      const bankName = paymentsObj?.bankName ? String(paymentsObj.bankName).trim() : undefined;

      const accountName = paymentsObj?.walletName || paymentsObj?.accountName
        ? String(paymentsObj.walletName || paymentsObj.accountName).trim()
        : undefined;

      return {
        accountNumber: accountNumber ? String(accountNumber) : undefined,
        bankName,
        accountName,
        reference: paymentsObj?.reference || reference,
        status: data.status,
      };
    } catch (err: any) {
      console.warn('[SeerBit] getVirtualAccount error:', err);
      return null;
    }
  }
}
