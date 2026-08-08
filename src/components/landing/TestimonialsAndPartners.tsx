'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Shield } from 'lucide-react';

export default function TestimonialsAndPartners() {
  const testimonials = [
    {
      quote: "MyEduRide gives me peace of mind knowing my children are safe every day.",
      name: "Mrs. Adeaze M.",
      role: "Parent",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    },
    {
      quote: "Managing transport and attendance has never been this easy.",
      name: "Mr. Chinedu O.",
      role: "School Administrator",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    },
  ];

  const defaultRegisteredSchools = [
    {
      name: 'FORTUNE SPRINGS MONTESSORI',
      city: 'Idimu Ikotun, Lagos',
      badge: '/api/photo?path=logos/cc1928a7-caac-4b17-8142-57e11351a593.png',
    },
    {
      name: 'CANAAN GATE SCHOOLS',
      city: 'Shasha, Akowonjo, Lagos',
      badge: '/api/photo?path=logos/92664733-5f60-4bdc-9b0f-0f9ab6dff1e4.png',
    },
    {
      name: 'UNIQUE INTEGRITY COLLEGE',
      city: 'Bammeke Shasha, Lagos',
      badge: '/api/photo?path=logos/1c7770ae-ab6d-4447-82d1-fa3b118aa8c8.jpg',
    },
    {
      name: 'CRADLE HOME CHILDREN SCHOOL',
      city: 'Idimu Titun, Lagos',
      badge: '/api/photo?path=logos/a4dad90e-726a-48d4-86c5-26aa440be864.png',
    },
    {
      name: 'DAMZY SCHOOL',
      city: 'Orisunbare, Idimu, Lagos',
      badge: '/api/photo?path=logos/b9e6ba87-d471-4081-b10f-759e139ccdc9.jpg',
    },
    {
      name: 'Solid Stone Kiddies Academy',
      city: 'Idimu, Lagos',
      badge: '/api/photo?path=logos/c1ac8ead-c011-4f03-a216-28d6b354e12a.png',
    },
  ];

  const [partnerSchools, setPartnerSchools] = useState(defaultRegisteredSchools);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/public/schools');
        const data = await res.json();
        if (res.ok && Array.isArray(data.schools) && data.schools.length > 0) {
          const formatted = data.schools
            .filter((s: any) => s.name && !/^[a-zA-Z]{15,}$/.test(s.name))
            .map((s: any) => ({
              name: s.name,
              city: s.city || 'Lagos',
              badge: s.logo_url || '/images/landing/school_badge_1.png',
            }));

          if (formatted.length > 0) {
            setPartnerSchools(formatted);
          }
        }
      } catch (err) {
        console.error('Failed to fetch public schools list:', err);
      }
    })();
  }, []);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="py-20 bg-slate-50 border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Testimonials Column */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100">
              Community Testimonials
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-poppins">
              What Parents & Schools Say
            </h2>

            {/* Testimonial Card */}
            <div className="bg-white rounded-3xl p-7 shadow-md border border-slate-200/80 relative">
              <Quote className="w-8 h-8 text-emerald-100 absolute top-6 right-6" />

              <p className="text-slate-700 text-sm sm:text-base font-medium italic leading-relaxed mb-6">
                "{testimonials[currentIndex].quote}"
              </p>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex items-center gap-3">
                  <img
                    src={testimonials[currentIndex].avatar}
                    alt={testimonials[currentIndex].name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 font-poppins">
                      {testimonials[currentIndex].name}
                    </h4>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {testimonials[currentIndex].role}
                    </span>
                  </div>
                </div>

                {/* Slider Navigation Arrows */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevSlide}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Trusted Partners Badges Grid with Real Registered Schools */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-900 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm">
              Extensive Institution Reach
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-poppins">
              Trusted by Leading Schools & Partners
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {partnerSchools.slice(0, 6).map((school, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group"
                >
                  <div className="w-14 h-14 rounded-xl p-1 bg-slate-50 flex items-center justify-center border border-slate-100 mb-2 group-hover:scale-105 transition-transform overflow-hidden">
                    {school.badge ? (
                      <img
                        src={school.badge}
                        alt={school.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Fallback if image load fails
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Shield className="w-8 h-8 text-emerald-600" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900 font-poppins line-clamp-1">
                    {school.name}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    {school.city}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
