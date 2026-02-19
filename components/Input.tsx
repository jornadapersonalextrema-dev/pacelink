'use client';

import React, { useMemo, useState } from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  rightAddon?: React.ReactNode;

  /**
   * Se true, quando type="password" e não houver rightAddon,
   * mostra automaticamente o botão "Mostrar/Ocultar".
   * Default: true
   */
  passwordToggle?: boolean;
};

export default function Input({
  label,
  rightAddon,
  className = '',
  passwordToggle = true,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = useMemo(() => {
    return String(props.type || '').toLowerCase() === 'password';
  }, [props.type]);

  const shouldAutoToggle = isPassword && passwordToggle && !rightAddon;

  // evita passar "type" duplicado no spread
  const { type: _type, ...rest } = props;

  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : (props.type as any);

  return (
    <label className="block w-full">
      {label ? <div className="mb-2 text-sm font-semibold text-white/80">{label}</div> : null}

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:ring-2 focus-within:ring-[#30e87a]/40">
        <input
          {...rest}
          type={effectiveType}
          className={['w-full bg-transparent outline-none text-white placeholder:text-white/40', className].join(' ')}
        />

        {rightAddon ? (
          rightAddon
        ) : shouldAutoToggle ? (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15 active:bg-white/20"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        ) : null}
      </div>
    </label>
  );
}
