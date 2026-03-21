export const LoadingIndicator = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center gap-4 bg-gray-200">
      <p className="text-3xl animate-pulse">
        Loading
        <span className="inline-block animate-bounce [animation-delay:0ms]">
          .
        </span>
        <span className="inline-block animate-bounce [animation-delay:150ms]">
          .
        </span>
        <span className="inline-block animate-bounce [animation-delay:300ms]">
          .
        </span>
      </p>
    </div>
  );
};
