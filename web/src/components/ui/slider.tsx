"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value?: number[];
  onValueChange?: (values: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, disabled }, ref) => {
    const currentValue = value?.[0] ?? min;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange?.([Number(e.target.value)]);
    };

    const percentage = ((currentValue - min) / (max - min)) * 100;

    return (
      <div className={cn("relative flex items-center w-full", className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          disabled={disabled}
          className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer slider-thumb"
          style={{
            background: `linear-gradient(to right, #10b981 0%, #10b981 ${percentage}%, #27272a ${percentage}%, #27272a 100%)`,
          }}
        />
        <style>{`
          .slider-thumb::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #10b981;
            cursor: pointer;
            border: 2px solid #065f46;
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
            transition: box-shadow 0.15s;
          }
          .slider-thumb::-webkit-slider-thumb:hover {
            box-shadow: 0 0 0 5px rgba(16, 185, 129, 0.2);
          }
          .slider-thumb::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #10b981;
            cursor: pointer;
            border: 2px solid #065f46;
          }
        `}</style>
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
