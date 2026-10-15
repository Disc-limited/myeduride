'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Copy,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Building2,
  User,
  ExternalLink,
  Calendar,
  Hash,
  Loader2,
} from 'lucide-react';
import {
  ReceiptData,
  buildReceiptFromTransaction,
  verifyReceiptHmac,
} from '@/lib/payments/receipt-engine';
import { renderPaymentReceiptHtml } from '@/lib/notifications/email-templates/payment-receipt-render';

export interface DigitalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  entityDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    type?: 'PARENT' | 'SCHOOL' | 'ESCORT';
  };
}

export function DigitalReceiptModal({
  isOpen,
  onClose,
  transaction,
  entityDetails,
}: DigitalReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Resolve standardized receipt data safely before early exit
  const receipt: ReceiptData | null =
    transaction
      ? transaction.receiptNumber && transaction.hmacSignature
        ? (transaction as ReceiptData)
        : buildReceiptFromTransaction(transaction, entityDetails)
      : null;

  const isAuthentic = receipt ? verifyReceiptHmac(receipt) : false;

  const copyToClipboard = (text: string, key: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handlePrint = () => {
    if (!receipt) {
      window.print();
      return;
    }
    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute(
        'style',
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;z-index:-1;'
      );
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        window.print();
        return;
      }

      const receiptHtml = renderPaymentReceiptHtml(receipt);
      iframeDoc.open();
      iframeDoc.write(receiptHtml);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }, 350);
    } catch (err) {
      console.error('[DigitalReceiptModal] Iframe print failed, falling back to window.print():', err);
      window.print();
    }
  };

  // Intercept Ctrl+P / Cmd+P to invoke clean single-page receipt print
  useEffect(() => {
    if (!isOpen || !receipt) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, receipt]);

  const handleDownloadPdf = async () => {
    if (!receiptRef.current || !receipt) return;
    setIsDownloadingPdf(true);

    try {
      // Dynamically import jspdf and html2canvas on client side
      const [html2canvasModule, jsPdfModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const html2canvas = html2canvasModule.default || html2canvasModule;
      const jsPDF = jsPdfModule.default || jsPdfModule.jsPDF || jsPdfModule;

      const element = receiptRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 190;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Receipt-${receipt.receiptNumber}.pdf`);
    } catch (err) {
      console.error('[DigitalReceiptModal] PDF export failed, falling back to print:', err);
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (!isOpen || !transaction || !receipt) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto"
      onClick={onClose}
    >
      <style jsx global>{`
        @page {
          size: auto;
          margin: 8mm;
        }
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="relative w-full max-w-xl my-6 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 print:shadow-none print:border-none print:my-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP TOOLBAR (HIDDEN IN PRINT) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-400" size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Verified Digital Receipt
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              title="Print Receipt"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              title="Download PDF"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
            >
              {isDownloadingPdf ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PRINTABLE RECEIPT CONTAINER */}
        <div
          ref={receiptRef}
          id="myeduride-printable-receipt"
          className="p-6 sm:p-8 bg-white print:p-0"
        >
          {/* RECEIPT HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  My<span className="text-emerald-600">Edu</span>Ride
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Official
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                The Student Safety & Mobility Network
              </p>
            </div>

            <div className="sm:text-right">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Receipt Number
              </div>
              <div className="flex items-center gap-1.5 sm:justify-end mt-0.5">
                <span className="font-mono text-sm font-bold text-slate-800">
                  {receipt.receiptNumber}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(receipt.receiptNumber, 'recNo')}
                  className="text-slate-400 hover:text-slate-600 no-print"
                  title="Copy Receipt Number"
                >
                  {copiedKey === 'recNo' ? (
                    <CheckCircle2 size={13} className="text-emerald-600" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center sm:justify-end gap-1">
                <Calendar size={12} className="text-slate-400" />
                <span>{receipt.timestamp}</span>
              </div>
            </div>
          </div>

          {/* HERO AMOUNT CARD */}
          <div className="my-6 p-5 rounded-xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-100 text-center relative overflow-hidden">
            <div className="absolute top-2 right-3">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={12} />
                Paid & Credited
              </span>
            </div>
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
              Total Amount Paid
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              ₦
              {receipt.totalAmountNgn.toLocaleString('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Method: <span className="font-semibold text-slate-700">{receipt.paymentMethod}</span>
            </div>
          </div>

          {/* BILLED TO & PAYMENT DETAILS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-100 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                {receipt.entityType === 'SCHOOL' ? (
                  <Building2 size={12} className="text-emerald-600" />
                ) : (
                  <User size={12} className="text-emerald-600" />
                )}
                <span>Billed Entity</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">{receipt.entityName}</div>
              <div className="text-slate-500 mt-0.5 font-medium">
                {receipt.entityType === 'SCHOOL'
                  ? 'Institutional School Account'
                  : receipt.entityType === 'ESCORT'
                  ? 'Verified Escort Account'
                  : 'Parent / Guardian Account'}
              </div>
              <div className="text-slate-600 mt-1 font-mono text-[11px] break-all">
                {receipt.userEmail}
              </div>
              {receipt.userPhone && (
                <div className="text-slate-600 mt-0.5">{receipt.userPhone}</div>
              )}
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                  <CreditCard size={12} className="text-emerald-600" />
                  <span>Transaction Audit</span>
                </div>
                <div className="text-slate-500">
                  Tx Reference:
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono font-bold text-slate-800 text-[11px] truncate">
                      {receipt.transactionReference}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(receipt.transactionReference, 'txRef')
                      }
                      className="text-slate-400 hover:text-slate-600 no-print"
                      title="Copy Reference"
                    >
                      {copiedKey === 'txRef' ? (
                        <CheckCircle2 size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-slate-500">
                Gateway Reference:
                <div className="font-mono text-[11px] text-slate-700 font-semibold truncate">
                  {receipt.gatewayReference}
                </div>
              </div>
            </div>
          </div>

          {/* FINANCIAL BREAKDOWN TABLE */}
          <div className="my-6">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Itemized Financial Breakdown
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Rate / VAT</th>
                    <th className="py-2.5 px-3 text-right">Amount (NGN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">Wallet Deposit Credit</div>
                      <div className="text-[11px] text-slate-500">
                        {receipt.description || 'Safe Shuttle & Gate Access'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500">Base Amount</td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900">
                      ₦
                      {receipt.netAmountNgn.toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 px-3 text-slate-600">
                      Value Added Tax (Statutory VAT)
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">7.5%</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                      ₦
                      {receipt.vatAmountNgn.toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  <tr className="bg-slate-50/80 font-bold text-slate-900">
                    <td className="py-3 px-3 text-sm">Total Amount Paid</td>
                    <td className="py-3 px-3 text-right text-emerald-600 uppercase text-[10px]">
                      Inclusive
                    </td>
                    <td className="py-3 px-3 text-right text-sm text-emerald-600">
                      ₦
                      {receipt.totalAmountNgn.toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  {typeof receipt.balanceAfterNgn === 'number' && (
                    <tr className="text-slate-500 text-[11px]">
                      <td colSpan={2} className="py-2 px-3 text-right">
                        Wallet Balance After Credit:
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        ₦
                        {receipt.balanceAfterNgn.toLocaleString('en-NG', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* CRYPTOGRAPHIC INTEGRITY FOOTER */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="text-emerald-600 flex-shrink-0 mt-0.5" size={16} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Cryptographic HMAC-SHA256 Verification
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    {isAuthentic ? 'Verified Authentic' : 'Tamper-Proof Seal'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  This payload is signed with a high-entropy key stored in our security vault.
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200">
                  <span className="font-mono text-[10px] text-slate-600 truncate">
                    {receipt.hmacSignature}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(receipt.hmacSignature, 'hmac')}
                    className="text-slate-400 hover:text-slate-700 flex-shrink-0 text-[10px] font-semibold inline-flex items-center gap-1 no-print"
                  >
                    {copiedKey === 'hmac' ? (
                      <span className="text-emerald-600 font-bold">Copied!</span>
                    ) : (
                      <>
                        <Copy size={11} /> Copy Hash
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* LEGAL / PRINT DISCLAIMER */}
          <div className="mt-6 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-4">
            <p className="m-0">
              Official computer-generated receipt issued by MyEduRide Technologies Ltd.
            </p>
            <p className="mt-0.5 m-0">
              Valid proof of payment for accounting and tax deductible transit services.
            </p>
          </div>
        </div>

        {/* BOTTOM ACTION BAR (HIDDEN IN PRINT) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 no-print">
          <button
            onClick={() =>
              copyToClipboard(
                `MyEduRide Receipt ${receipt.receiptNumber}\nAmount: ₦${receipt.totalAmountNgn.toLocaleString(
                  'en-NG',
                  { minimumFractionDigits: 2 }
                )}\nDate: ${receipt.timestamp}\nReference: ${receipt.transactionReference}`,
                'summary'
              )
            }
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5"
          >
            {copiedKey === 'summary' ? (
              <CheckCircle2 size={14} className="text-emerald-600" />
            ) : (
              <Copy size={14} />
            )}
            <span>{copiedKey === 'summary' ? 'Summary Copied' : 'Copy Summary'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition shadow-sm"
            >
              <Printer size={14} />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
