'use client';

import { Suspense, useState } from 'react';
import { CityManagerPricingView } from '@/components/shared/CityPricingPanel';

export default function CityManagerPricingPage() {
  const [selectedCity, setSelectedCity] = useState('LAGOS');

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading City Pricing Adjuster...</div>}>
      <div className="space-y-6">
        <CityManagerPricingView
          selectedCity={selectedCity}
          onCityChange={(city) => setSelectedCity(city)}
        />
      </div>
    </Suspense>
  );
}
