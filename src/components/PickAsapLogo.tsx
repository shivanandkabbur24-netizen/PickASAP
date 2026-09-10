import React from 'react';

interface PickAsapLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  dark?: boolean;
}

export const PickAsapLogo: React.FC<PickAsapLogoProps> = ({
  className = '',
  size = 'md',
  showWordmark = true,
}) => {
  const dimensions = {
    sm: { width: 34, height: 26, text: 'text-lg', sub: 'text-[9px]' },
    md: { width: 48, height: 36, text: 'text-2xl', sub: 'text-[10px]' },
    lg: { width: 68, height: 50, text: 'text-3xl', sub: 'text-xs' },
    xl: { width: 96, height: 72, text: 'text-4xl', sub: 'text-sm' },
  }[size];

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* SVG recreating the uploaded cart + M + f bag + smile logo */}
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="0 0 160 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 transition-transform duration-300 hover:scale-105 drop-shadow-sm"
      >
        <defs>
          {/* Gradients for the M ribbon */}
          <linearGradient id="mGradientLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E91E63" />
            <stop offset="50%" stopColor="#FF4081" />
            <stop offset="100%" stopColor="#FF6E40" />
          </linearGradient>
          <linearGradient id="mGradientRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6E40" />
            <stop offset="50%" stopColor="#9C27B0" />
            <stop offset="100%" stopColor="#673AB7" />
          </linearGradient>
          {/* Flipkart bag gradient */}
          <linearGradient id="fBagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD600" />
            <stop offset="100%" stopColor="#FFB300" />
          </linearGradient>
          {/* Amazon smile arrow gradient */}
          <linearGradient id="smileGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF9900" />
            <stop offset="100%" stopColor="#FFA41C" />
          </linearGradient>
        </defs>

        {/* Shopping Cart Shadow Grounding */}
        <ellipse cx="80" cy="115" rx="48" ry="4" fill="currentColor" opacity="0.08" />

        {/* Flipkart Bag (yellow box with blue f) */}
        <g id="flipkart-bag">
          <path
            d="M98 32 L128 34 C132 34 135 37 134 41 L124 95 C123 98 120 100 117 100 L86 100 C83 100 81 97 81 94 L87 36 C87 33 90 32 93 32 Z"
            fill="url(#fBagGrad)"
          />
          {/* Bag flap notch */}
          <path
            d="M106 33 L106 43 C106 44 109 46 112 44 L118 40 L118 33 Z"
            fill="#FFA000"
            opacity="0.9"
          />
          {/* Blue 'f' */}
          <path
            d="M102 44 C108 44 113 46 113 54 L113 56 L124 56 L122 65 L113 65 L110 93 L97 93 L100 65 L92 65 L93 56 L101 56 L102 52 C102 49 104 44 110 44 Z"
            fill="#0055FF"
          />
          {/* Blue speed trails */}
          <path d="M125 50 L146 50 C147.5 50 148 52 146 53 L125 53 Z" fill="#0066FF" />
          <path d="M126 58 L142 58 C143.5 58 144 60 142 61 L126 61 Z" fill="#0066FF" />
          <path d="M124 66 L136 66 C137 66 137.5 68 136 69 L124 69 Z" fill="#0066FF" />
        </g>

        {/* Stylized Myntra 'M' Ribbon */}
        <g id="myntra-m">
          {/* Left loop */}
          <path
            d="M48 84 C38 65 42 36 63 28 C74 24 84 35 77 62 C73 75 66 84 56 86 C52 87 49 86 48 84 Z"
            fill="url(#mGradientLeft)"
          />
          {/* Right loop */}
          <path
            d="M66 52 C71 36 82 27 92 31 C104 36 106 63 94 81 C88 90 77 91 71 83 C66 75 64 63 66 52 Z"
            fill="url(#mGradientRight)"
          />
        </g>

        {/* Amazon Curved Smile Arrow */}
        <g id="amazon-smile">
          <path
            d="M42 64 C64 91 106 87 114 69 C115 67 113 66 111 67 C103 79 66 82 44 62 C43 61 41 62 42 64 Z"
            fill="url(#smileGrad)"
          />
          {/* Arrowhead */}
          <path
            d="M107 68 C111 67 116 66 120 70 C120.5 70.5 120 72 119 72 C114 74 109 76 106 73 C105 72 105.5 68.5 107 68 Z"
            fill="url(#smileGrad)"
          />
        </g>

        {/* Shopping Cart Outline (Handle, Frame, Wheels) */}
        <g id="cart-frame">
          {/* Handle bar & frame */}
          <path
            d="M16 28 H34 L40 50 L50 85 C51 90 55 93 60 93 H104 C108 93 111 90 112 87 L114 79"
            stroke="currentColor"
            className="text-neutral-900 dark:text-neutral-200"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Left wheel */}
          <circle cx="56" cy="104" r="8.5" fill="currentColor" className="text-neutral-900 dark:text-neutral-200" />
          <circle cx="56" cy="104" r="3" fill="#FFFFFF" />
          {/* Right wheel */}
          <circle cx="98" cy="104" r="8.5" fill="currentColor" className="text-neutral-900 dark:text-neutral-200" />
          <circle cx="98" cy="104" r="3" fill="#FFFFFF" />
        </g>
      </svg>

      {/* Brand Name Typography */}
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-serif-editorial font-bold tracking-tight text-neutral-900 dark:text-neutral-50 ${dimensions.text}`}
          >
            Pick<span className="text-[#FF6E40] font-sans font-extrabold tracking-normal">ASAP</span>
          </span>
          <span
            className={`font-sans tracking-[0.22em] uppercase font-semibold text-neutral-600 dark:text-neutral-400 mt-0.5 ${dimensions.sub}`}
          >
            Curated Affiliate Edit
          </span>
        </div>
      )}
    </div>
  );
};
