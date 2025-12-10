import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizes = {
    sm: { text: 'text-lg', icon: 'w-7 h-7' },
    md: { text: 'text-xl', icon: 'w-8 h-8' },
    lg: { text: 'text-2xl', icon: 'w-9 h-9' },
    xl: { text: 'text-5xl', icon: 'w-16 h-16' }
  };

  return (
    <div className={`flex items-center ${className}`}>
      {/* Premium Text Logo */}
      <div className={`${sizes[size].text}`}>
        <span 
          className="text-white font-bold tracking-wider"
          style={{ 
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            letterSpacing: '0.15em'
          }}
        >
          CORVIA
        </span>
      </div>
    </div>
  );
};

export default Logo;
