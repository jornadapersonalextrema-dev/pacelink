'use client';

import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  rightAddon?: React.ReactNode;
};

export default function Input({ label, rightAddon, className = '', ...props }: InputProps) {
  return (
    <label className="block w-full">
      {label ? (
        <div className="mb-2 text-sm font-semibold text-white/80">{label}</div>
      ) : null}

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:ring-2 focus-within:ring-[#30e87a]/40">
        <input
          {...props}
          className={[
            'w-full bg-transparent outline-none text-white placeholder:text-white/40',
            className,
          ].join(' ')}
        />
        {rightAddon}
      </div>
    </label>
  );
}
