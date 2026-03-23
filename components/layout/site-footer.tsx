type SiteFooterProps = {
  className?: string;
};

const REPO_URL = "https://github.com/HardikGoyal2003/Oppia-Leads-Dashboard";
const ISSUES_URL = `${REPO_URL}/issues`;

export function SiteFooter({ className = "" }: SiteFooterProps) {
  return (
    <footer className={className}>
      <p>© {new Date().getFullYear()} Hardik Goyal. All rights reserved.</p>
      <div className="mt-2 flex items-center justify-center gap-4">
        <a
          href="https://github.com/hardikGoyal2003"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:underline"
        >
          GitHub
        </a>
        <a
          href={ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:underline"
        >
          Report an issue
        </a>
        <a
          href="https://www.linkedin.com/in/hardikgoyal2003"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:underline"
        >
          LinkedIn
        </a>
      </div>
    </footer>
  );
}
