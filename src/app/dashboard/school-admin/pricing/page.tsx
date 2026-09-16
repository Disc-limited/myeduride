'use client';

import { CityPricingReadOnlyPanel } from '@/components/shared/CityPricingPanel';

export default function SchoolAdminPricingPage() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <CityPricingReadOnlyPanel title="City Transport Pricing (Read-only)" />
    </div>
  );
}
