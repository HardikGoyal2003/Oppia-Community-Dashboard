import { getErrorCodeMeta } from "@/lib/errors/error-codes";
import { Navbar } from "@/components/layout/navbar";
import { SiteFooter } from "@/components/layout/site-footer";
import { ErrorCard } from "@/components/error/error-card";
import { CookieConsent } from "./cookie-consent";

/**
 * Renders a graceful error page for `/error/:errorCode`.
 *
 * The route stays the same for every error and the page content is switched
 * based on the error code, mirroring Oppia's `/error/:status_code` pattern.
 */
export default async function ErrorPage({
  params,
}: {
  params: Promise<{ errorCode: string }>;
}) {
  const { errorCode } = await params;
  const meta = getErrorCodeMeta(errorCode);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <ErrorCard meta={meta} />
      </main>

      <div className="bg-white px-6 py-8">
        <SiteFooter className="text-center text-sm text-slate-500" />
      </div>

      <CookieConsent />
    </div>
  );
}
