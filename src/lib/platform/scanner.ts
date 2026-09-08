/**
 * MyEduRide Cross-Platform Barcode & QR Scanner
 * Unifies Native Camera Barcode scanning and WebRTC video scanning for Gate Officers & Escorts.
 */

import { isNativePlatform } from './device';
import { triggerHapticNotification } from './haptics';

export interface ScanResult {
  hasContent: boolean;
  content: string;
  format?: string;
}

export class PlatformScanner {
  private isScanning: boolean = false;

  public async checkPermissions(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (isNativePlatform()) {
      try {
        // Try importing native community barcode scanner if available
        const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner');
        const status = await BarcodeScanner.checkPermission({ force: true });
        return !!status.granted;
      } catch (err) {
        console.warn('[Scanner] Native scanner permission check fallback:', err);
        return false;
      }
    }

    // Web camera permission check
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach((t) => t.stop());
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  public async startNativeScan(
    onScan: (result: ScanResult) => void
  ): Promise<void> {
    if (!isNativePlatform()) return;

    try {
      const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner');
      await BarcodeScanner.hideBackground(); // Make webview transparent
      document.body.classList.add('barcode-scanner-active');
      this.isScanning = true;

      const result = await BarcodeScanner.startScan();
      if (result.hasContent) {
        await triggerHapticNotification('SUCCESS');
        onScan({
          hasContent: true,
          content: result.content,
        });
      }
    } catch (err) {
      console.error('[Scanner] Native scan error:', err);
    } finally {
      await this.stopNativeScan();
    }
  }

  public async stopNativeScan(): Promise<void> {
    if (!isNativePlatform() || !this.isScanning) return;

    try {
      const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner');
      await BarcodeScanner.showBackground();
      await BarcodeScanner.stopScan();
      document.body.classList.remove('barcode-scanner-active');
    } catch (err) {
      console.warn('[Scanner] Stop scan warning:', err);
    } finally {
      this.isScanning = false;
    }
  }

  public get scanning(): boolean {
    return this.isScanning;
  }
}

export const platformScanner = new PlatformScanner();
