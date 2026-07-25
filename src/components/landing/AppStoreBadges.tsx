'use client';

interface AppStoreBadgesProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function AppStoreBadges({ className = '', size = 'md' }: AppStoreBadgesProps) {
  const isSmall = size === 'sm';
  const paddingClass = isSmall ? 'px-3 py-1.5' : 'px-4 py-2.5';
  const iconSize = isSmall ? 'w-5 h-5' : 'w-6 h-6';
  const subTextSize = isSmall ? 'text-[8px]' : 'text-[9px]';
  const mainTextSize = isSmall ? 'text-xs' : 'text-sm';

  const handlePreventClick = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      
      {/* Official Google Play Store Badge (Non-responsive static element) */}
      <button
        type="button"
        onClick={handlePreventClick}
        className={`inline-flex items-center gap-3 bg-black text-white rounded-xl shadow-md border border-slate-800 cursor-default select-none ${paddingClass}`}
        aria-label="Get it on Google Play"
      >
        {/* Official Google Play Multicolor Triangle Logo */}
        <svg className={iconSize} viewBox="0 0 512 512" fill="none">
          <path
            d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1z"
            fill="#00F076"
          />
          <path
            d="M47 38.6C41.7 44.1 38.6 52.3 38.6 62.7v386.6c0 10.4 3.1 18.6 8.4 24.1l12.7 12.7L280.9 265 60.3 38.6H47z"
            fill="#00D2FF"
          />
          <path
            d="M325.3 277.7l60.1 60.1L104.6 499l220.7-221.3z"
            fill="#FF3A44"
          />
          <path
            d="M465.3 239.3l-80-46.2-59.9 59.9 59.9 59.9 80.1-46.2c22.9-13.2 22.9-34.2-.1-47.4z"
            fill="#FFD200"
          />
        </svg>

        <div className="text-left font-sans">
          <div className={`${subTextSize} uppercase tracking-wider font-semibold text-slate-300 leading-tight`}>
            GET IT ON
          </div>
          <div className={`${mainTextSize} font-bold leading-tight font-poppins text-white`}>
            Google Play
          </div>
        </div>
      </button>

      {/* Official Apple App Store Badge (Non-responsive static element) */}
      <button
        type="button"
        onClick={handlePreventClick}
        className={`inline-flex items-center gap-3 bg-black text-white rounded-xl shadow-md border border-slate-800 cursor-default select-none ${paddingClass}`}
        aria-label="Download on the App Store"
      >
        {/* Official White Apple Logo */}
        <svg className={`${iconSize} fill-white`} viewBox="0 0 170 170">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-5.01.12-9.87-1.99-14.57-6.35-3.2-2.76-7.07-7.44-11.62-14.04-6.36-9.14-11.22-19.46-14.59-30.98-3.37-11.52-5.06-22.38-5.06-32.58 0-14.57 3.53-26.68 10.59-36.32 7.06-9.64 16.03-14.56 26.91-14.76 4.9.12 10.02 1.25 15.37 3.39 5.35 2.14 9.3 3.28 11.85 3.4 2.14 0 6.13-1.14 11.96-3.4 5.83-2.27 10.8-3.33 14.92-3.19 11.27.61 20.31 4.88 27.12 12.81-9.92 6.01-14.77 14.28-14.56 24.81.21 8.22 3.37 15.22 9.48 21 6.11 5.78 13.43 8.89 21.97 9.33-2.1 6.2-4.55 12.38-7.34 18.55zM119.22 31.87c0-6.73 2.45-13.12 7.34-19.17 4.9-6.05 10.97-9.76 18.22-11.13.21.84.32 1.76.32 2.76 0 6.6-2.45 13.04-7.34 19.32-4.9 6.28-11.02 10.04-18.35 11.28-.07-.95-.19-2.01-.19-3.06z" />
        </svg>

        <div className="text-left font-sans">
          <div className={`${subTextSize} uppercase tracking-wider font-semibold text-slate-300 leading-tight`}>
            Download on the
          </div>
          <div className={`${mainTextSize} font-bold leading-tight font-poppins text-white`}>
            App Store
          </div>
        </div>
      </button>

    </div>
  );
}
