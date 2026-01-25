
'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: string;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'lg', 
  icon, 
  fullWidth = true,
  className = '',
  ...props 
}) => {
  const baseStyles = "flex items-center justify-center gap-2 rounded-full font-bold transition-all active:scale-[0.98]";
  
  const variants = {
    primary: "bg-primary text-background-dark shadow-lg shadow-primary/25 hover:bg-[#25c464]",
    secondary: "bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white",
    ghost: "bg-transparent text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5",
    danger: "bg-red-500 text-white shadow-lg shadow-red-500/20"
  };

  const sizes = {
    sm: "h-9 px-4 text-xs",
    md: "h-11 px-6 text-sm",
    lg: "h-14 px-8 text-lg",
    xl: "h-16 px-10 text-xl"
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      {...props}
    >
      {icon && <span className="material-symbols-outlined">{icon}</span>}
      {children}
    </button>
  );
};
