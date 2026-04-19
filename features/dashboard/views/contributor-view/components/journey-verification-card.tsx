"use client";

import { Link2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JourneyVerificationCard({
  accentBorderClassName,
  accentButtonClassName,
  accentHeaderClassName,
  accentInputClassName,
  buttonLabel,
  description,
  helperText,
  inputId,
  inputLabel,
  inputPlaceholder,
  inputValue,
  onButtonClick,
  onInputChange,
  sectionLabel,
  title,
}: {
  accentBorderClassName: string;
  accentButtonClassName: string;
  accentHeaderClassName: string;
  accentInputClassName: string;
  buttonLabel: string;
  description: string;
  helperText: string;
  inputId: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputValue: string;
  onButtonClick: () => void;
  onInputChange: (value: string) => void;
  sectionLabel: string;
  title: string;
}) {
  return (
    <div
      className={`mt-10 overflow-hidden rounded-3xl border bg-[linear-gradient(135deg,#f8fafc_0%,#f3f7fb_52%,#fbfdff_100%)] shadow-[0_22px_48px_-36px_rgba(15,23,42,0.18)] ${accentBorderClassName}`}
    >
      <div
        className={`border-b bg-white/80 px-4 py-3 ${accentBorderClassName}`}
      >
        <div
          className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] ${accentHeaderClassName}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {sectionLabel}
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-950">{title}</p>
            <p className="text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <div className="space-y-2">
            <label
              htmlFor={inputId}
              className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              {inputLabel}
            </label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id={inputId}
                type="url"
                value={inputValue}
                placeholder={inputPlaceholder}
                className={`h-11 bg-white pl-10 ${accentInputClassName}`}
                onChange={(event) => onInputChange(event.target.value)}
              />
            </div>
            <p className="text-xs leading-5 text-slate-500">{helperText}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            className={accentButtonClassName}
            disabled={!inputValue.trim()}
            onClick={onButtonClick}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
