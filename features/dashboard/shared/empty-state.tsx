interface EmptyStateProps {
  icon: string;
  badge: string;
  title: string;
  description: string;
}

export const EmptyState = ({
  icon,
  badge,
  title,
  description,
}: EmptyStateProps) => {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-sm font-medium text-slate-700">
        <span>{icon}</span>
        <span>{badge}</span>
      </div>

      <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </p>

      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  );
};
