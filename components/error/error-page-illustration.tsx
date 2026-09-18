import { WifiOff } from "lucide-react";

/**
 * Playful "Oops!" illustration with a broken-connection visual.
 */
export function ErrorPageIllustration() {
  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-dashed border-slate-200 bg-slate-50">
        <WifiOff className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
      </div>
      <p className="text-2xl font-bold text-slate-800">Oops!</p>
    </div>
  );
}
