'use client';

import Link from 'next/link';
import { Shield, Phone, Mail, MapPin, Facebook, Instagram, Twitter, Linkedin, Youtube, Heart } from 'lucide-react';
import AppStoreBadges from '@/components/landing/AppStoreBadges';

export default function Footer() {
  return (
    <footer id="footer" className="bg-navy-950 text-white border-t border-navy-800">
      
      {/* Main Multi-Column Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          
          {/* Brand Info (Col 1-4) */}
          <div className="lg:col-span-4 space-y-5">
            <Link href="/" className="inline-block bg-white px-3.5 py-2 rounded-xl shadow-sm hover:scale-105 transition-transform">
              <img
                src="/images/eduride_logo.png"
                alt="MyEduRide Logo"
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </Link>

            <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-sm">
              We are committed to ensuring safe, comfortable and reliable journeys for every student through automated gate verification and real-time transportation intelligence.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              <a href="#facebook" aria-label="Facebook" className="w-9 h-9 rounded-xl bg-navy-900 hover:bg-brand-green text-slate-300 hover:text-white flex items-center justify-center transition-colors">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#instagram" aria-label="Instagram" className="w-9 h-9 rounded-xl bg-navy-900 hover:bg-brand-green text-slate-300 hover:text-white flex items-center justify-center transition-colors">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#twitter" aria-label="Twitter" className="w-9 h-9 rounded-xl bg-navy-900 hover:bg-brand-green text-slate-300 hover:text-white flex items-center justify-center transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#linkedin" aria-label="LinkedIn" className="w-9 h-9 rounded-xl bg-navy-900 hover:bg-brand-green text-slate-300 hover:text-white flex items-center justify-center transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#youtube" aria-label="YouTube" className="w-9 h-9 rounded-xl bg-navy-900 hover:bg-brand-green text-slate-300 hover:text-white flex items-center justify-center transition-colors">
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Company Links (Col 5-6) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-poppins">Company</h4>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
              <li><Link href="#about" className="hover:text-brand-green transition-colors">About Us</Link></li>
              <li><a href="#careers" className="hover:text-brand-green transition-colors">Careers</a></li>
              <li><a href="#blog" className="hover:text-brand-green transition-colors">Blog</a></li>
              <li><a href="#press" className="hover:text-brand-green transition-colors">Press</a></li>
              <li><Link href="#contact" className="hover:text-brand-green transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Solutions Links (Col 7-8) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-poppins">Solutions</h4>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
              <li><Link href="#roles" className="hover:text-brand-green transition-colors">For Parents</Link></li>
              <li><Link href="#roles" className="hover:text-brand-green transition-colors">For Schools</Link></li>
              <li><a href="#drivers" className="hover:text-brand-green transition-colors">For Drivers & Escorts</a></li>
              <li><a href="#businesses" className="hover:text-brand-green transition-colors">For Businesses</a></li>
              <li><a href="#government" className="hover:text-brand-green transition-colors">For Government</a></li>
            </ul>
          </div>

          {/* Resources Links (Col 9-10) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-poppins">Resources</h4>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
              <li><a href="#help" className="hover:text-brand-green transition-colors">Help Center</a></li>
              <li><a href="#safety" className="hover:text-brand-green transition-colors">Safety</a></li>
              <li><a href="#terms" className="hover:text-brand-green transition-colors">Terms of Service</a></li>
              <li><a href="#privacy" className="hover:text-brand-green transition-colors">Privacy Policy</a></li>
              <li><a href="#faqs" className="hover:text-brand-green transition-colors">FAQs</a></li>
            </ul>
          </div>

          {/* Contact Us & Official App Store Badges Column (Col 11-12) */}
          <div id="contact" className="lg:col-span-2 space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-poppins">Contact Us</h4>
            <ul className="space-y-3 text-xs font-semibold text-slate-400">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-brand-green flex-shrink-0" />
                <span>+234 901 234 5678</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-brand-green flex-shrink-0" />
                <span>support@myeduride.com</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-brand-green flex-shrink-0 mt-0.5" />
                <span>3, Saibu Adeolu Street, Church Bus-Stop, Idimu, Lagos State, Nigeria.</span>
              </li>
            </ul>

            {/* 
            <div className="pt-2">
              <span className="block text-[10px] font-bold uppercase text-slate-400 mb-2.5">Download Our App</span>
              <AppStoreBadges size="sm" />
            </div>
            */}
          </div>

        </div>
      </div>

      {/* Bottom Footer Bar */}
      <div className="border-t border-navy-900 bg-navy-950/80 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-400">
          <div>
            © 2026 MyEduRide. All rights reserved.
          </div>
          <div className="flex items-center gap-1">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            <span>in Nigeria</span>
          </div>
        </div>
      </div>

    </footer>
  );
}
