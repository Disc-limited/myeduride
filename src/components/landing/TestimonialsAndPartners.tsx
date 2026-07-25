'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

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

  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  const partnerSchools = [
    { name: 'Oakwood Academia', city: 'Lekki, Lagos', badge: '/images/landing/school_badge_1.png' },
    { name: 'Lyceum of Learning', city: 'Ikoyi, Lagos', badge: '/images/landing/school_badge_2.png' },
    { name: "St. Andrew's Prep", city: 'Victoria Island', badge: '/images/landing/school_badge_3.png' },
    { name: 'Riverdale High', city: 'Ikeja GRA, Lagos', badge: '/images/landing/school_badge_4.png' },
    { name: 'Montserrat College', city: 'Anthony, Lagos', badge: '/images/landing/school_badge_5.png' },
    { name: 'Beacon Academy', city: 'Surulere, Lagos', badge: '/images/landing/school_badge_6.png' },
  ];

  return (
    <section className="py-20 bg-slate-50 border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Testimonials Column */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-extrabold uppercase tracking-widest text-brand-green bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100">
              Community Testimonials
            </span>
            <h2 className="text-3xl font-extrabold text-navy-900 font-poppins">
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
                    className="w-11 h-11 rounded-full object-cover border-2 border-brand-green shadow-sm"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-navy-900 font-poppins">
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

          {/* Trusted Partners Badges Grid with Generated School Crests */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-extrabold uppercase tracking-widest text-navy-900 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm">
              Extensive Institution Reach
            </span>
            <h2 className="text-3xl font-extrabold text-navy-900 font-poppins">
              Trusted by Leading Schools & Partners
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {partnerSchools.map((school, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group"
                >
                  <div className="w-14 h-14 rounded-xl p-1 bg-slate-50 flex items-center justify-center border border-slate-100 mb-2 group-hover:scale-105 transition-transform">
                    <img
                      src={school.badge}
                      alt={school.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="text-xs font-bold text-navy-900 font-poppins line-clamp-1">
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
