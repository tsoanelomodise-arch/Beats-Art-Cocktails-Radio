import React from 'react';
import { motion } from 'motion/react';

export default function Logo({ className = "w-12 h-12", variant = 'default' }: { className?: string, variant?: 'default' | 'light' | 'dark' }) {
  const cream = "#f2e7d5";
  const accent = "#a82329";
  const deep = "#5c191c";

  return (
    <motion.div 
      className={`relative ${className} flex items-center justify-center`}
      animate={{ rotate: 360 }}
      transition={{ 
        duration: 12, 
        repeat: Infinity, 
        ease: "linear" 
      }}
    >
      <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Vinyl Record */}
        <circle cx="200" cy="200" r="180" fill={deep} />
        
        {/* Grooves */}
        {[160, 140, 120, 100].map((r, i) => (
          <circle key={i} cx="200" cy="200" r={r} stroke={accent} strokeWidth="1" opacity="0.3" />
        ))}
        
        {/* Label center */}
        <circle cx="200" cy="200" r="60" fill={accent} />
        
        {/* Banner - Slanted with Notches */}
        <g transform="rotate(-12, 200, 200)">
          <path 
            d="M 20,165 
               L 40,160 
               L 360,160 
               L 380,165 
               L 380,235 
               L 360,240 
               L 40,240 
               L 20,235 
               Z" 
            fill={deep} 
            stroke={cream} 
            strokeWidth="3" 
          />
          <text 
            x="200" 
            y="220" 
            textAnchor="middle" 
            fill={cream} 
            style={{ 
              fontSize: '64px', 
              fontFamily: 'serif', 
              fontWeight: 900,
              letterSpacing: '2px'
            }}
          >
            NON-CLUB
          </text>
        </g>
        
        {/* Bottom Text - Record Bar */}
        <defs>
          <path 
            id="curve" 
            d="M 60,250 A 140,140 0 0 0 340,250" 
          />
        </defs>
        <text style={{ fontSize: '26px', letterSpacing: '6px', fontWeight: 900, fill: cream }}>
          <textPath xlinkHref="#curve" startOffset="50%" textAnchor="middle">
            RECORD BAR
          </textPath>
        </text>
      </svg>
    </motion.div>
  );
}
