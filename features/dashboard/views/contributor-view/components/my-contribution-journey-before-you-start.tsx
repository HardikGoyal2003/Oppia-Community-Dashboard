"use client";

const BEFORE_YOU_START_POINTS = [
  "You will need to read some long docs, and you will come across many new terms that may feel overwhelming at first. But remember: you decided to start open source. That already puts you ahead of many people, so keep going and do not stop early.",
  "The more time you invest in reading and understanding the docs, the less time you will usually need later to make code fixes with confidence.",
  "Be open to learning new things and brushing up on the technologies used in Oppia. Most contributors do not begin with every skill fully polished. The important part is being willing to learn as you go.",
  "Focus on one task at a time instead of trying to clear the whole phase at once.",
];

export default function MyContributionJourneyBeforeYouStart() {
  return (
    <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-5">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Before You Start
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
          {BEFORE_YOU_START_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
