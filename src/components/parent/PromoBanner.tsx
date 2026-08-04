'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck, ArrowUpRight } from 'lucide-react';

const PROMO_SLIDES = [
  {
    title: '20% OFF Escort Verification',
    desc: "Ensure your child's safety this term with background-verified school pickup guardians.",
    validTill: 'Offer valid till 31st July, 2026.',
    badge: 'DISCL Integrated Services',
    bgColor: 'from-slate-900 via-indigo-950 to-slate-900',
    imgUrl:
      'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80',
  },
  {
    title: 'Live GPS Shuttle Corridor',
    desc: 'Real-time vehicle tracking, driver credentials, and geofenced speed alerts for total peace of mind.',
    validTill: 'Active for all school bus routes.',
    badge: 'E-DRiVE Protection',
    bgColor: 'from-slate-900 via-emerald-950 to-slate-900',
    imgUrl:
      'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&q=80',
  },
];

export default function PromoBanner() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? PROMO_SLIDES.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === PROMO_SLIDES.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    const interval = setInterval(nextSlide, 7000);
    return () => clearInterval(interval);
  }, []);

  const slide = PROMO_SLIDES[currentSlide];

  return (
    <div className={`relative rounded-3xl overflow-hidden bg-gradient-to-r ${slide.bgColor} border border-slate-800 shadow-lg text-white p-6 sm:p-8 min-h-[160px] flex items-center justify-between transition-all duration-500`}>
      {/* Background Graphic */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/80 to-transparent z-10" />
      <div
        className="absolute right-0 top-0 bottom-0 w-1/2 bg-cover bg-center opacity-30 pointer-events-none transition-all duration-500"
        style={{ backgroundImage: `url("${slide.imgUrl}")` }}
      />

      {/* Content */}
      <div className="relative z-20 max-w-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {slide.badge}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">{slide.validTill}</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-snug">
          {slide.title}
        </h3>
        <p className="text-xs text-slate-300 mt-1 max-w-md leading-relaxed hidden sm:block">
          {slide.desc}
        </p>

        <button
          type="button"
          className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md"
        >
          <span>Learn More</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Controls */}
      <div className="relative z-20 flex flex-col items-end gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevSlide}
            className="w-8 h-8 rounded-full bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700 text-white flex items-center justify-center transition-colors"
            title="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            className="w-8 h-8 rounded-full bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700 text-white flex items-center justify-center transition-colors"
            title="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-1.5">
          {PROMO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all ${
                currentSlide === idx ? 'w-5 bg-emerald-400' : 'w-1.5 bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
