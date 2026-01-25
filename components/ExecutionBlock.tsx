'use client';

import React from 'react';
import { WorkoutBlock as WorkoutBlockType } from '../types';

interface ExecutionBlockProps {
    block: WorkoutBlockType;
}

export const ExecutionBlock: React.FC<ExecutionBlockProps> = ({ block }) => {
    const isWarmup = block.type === 'warmup';
    const isCooldown = block.type === 'cooldown';
    const isMain = block.type === 'main';

    const iconName = isWarmup ? 'wb_sunny' : isCooldown ? 'ac_unit' : 'local_fire_department';
    const iconColorClass = isWarmup ? 'text-amber-500' : isCooldown ? 'text-blue-500' : 'text-primary';
    const iconBgClass = isMain ? 'bg-primary text-background-dark' : 'bg-white dark:bg-background-dark border-2 border-slate-200 dark:border-white/10';

    const title = isWarmup ? 'Aquecimento' : isCooldown ? 'Desaquecimento' : 'Série Principal';
    const zoneLabel = isWarmup || isCooldown ? 'Zone 1' : 'Zone 4';

    return (
        <div className="relative">
            <div className={`absolute -left-12 w-12 h-12 rounded-full flex items-center justify-center z-10 ${iconBgClass}`}>
                <span className={`material-symbols-outlined ${!isMain ? iconColorClass : ''}`}>
                    {iconName}
                </span>
            </div>

            <h4 className={`font-bold flex items-center gap-2 mb-1 ${isMain ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                {title}
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded opacity-50 uppercase">
                    {zoneLabel}
                </span>
            </h4>

            {isMain ? (
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-white/5 mt-2">
                    {/* Mock content for main set structure if needed, or specific block info */}
                    <p className="text-xl font-black mb-2">{block.distance}km <span className="text-xs font-normal opacity-50 uppercase">Total</span></p>
                    <ul className="space-y-1.5">
                        <li className="flex items-center gap-2 text-sm font-bold">
                            <span className="material-symbols-outlined text-primary text-sm">fast_forward</span>
                            <span>{block.intensity} Intensity</span>
                        </li>
                    </ul>
                </div>
            ) : (
                <p className="text-slate-500 text-sm">{block.distance} km {block.intensity}</p>
            )}
        </div>
    );
};
