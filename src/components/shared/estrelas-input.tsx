"use client";

import React, { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EstrelasInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function EstrelasInput({ value, onChange, disabled }: EstrelasInputProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const currentValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Avaliação em estrelas">
      {[1, 2, 3, 4, 5].map((star) => (
        <Button
          key={star}
          type="button"
          variant="ghost"
          disabled={disabled}
          className="size-11 p-0 flex items-center justify-center rounded-full hover:bg-accent/20 transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onChange(star)}
          onMouseEnter={() => !disabled && setHoverValue(star)}
          onMouseLeave={() => !disabled && setHoverValue(null)}
          aria-label={`Avaliar com ${star} estrela${star > 1 ? "s" : ""}`}
          aria-checked={value === star}
          role="radio"
        >
          <Star
            className={`size-6 transition-all duration-150 ${
              star <= currentValue
                ? "fill-amber-400 text-amber-400 scale-110"
                : "text-muted-foreground/50 hover:text-amber-400"
            }`}
          />
        </Button>
      ))}
    </div>
  );
}
