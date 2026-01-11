"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import login_form_banner from '../../public/login_form_banner.png';


export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-100">
      {/* Left Branding Panel */}
      <div className="bg-[url('/login_form_banner.png')] bg-cover bg-center hidden lg:flex flex-col justify-between text-white p-12">
      </div>

      {/* Right Login Panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">
              Sign in
            </h2>
            <p className="text-slate-500 mt-1">
              Access your Oppia Leads dashboard
            </p>
          </div>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-md border border-slate-300 px-4 py-3 text-slate-700 font-medium hover:bg-slate-50 transition disabled:opacity-60"
          >
            {loading ? (
              <span className="animate-pulse">Signing you in...</span>
            ) : (
              <>
                <img
                  src="https://www.svgrepo.com/show/475656/google-color.svg"
                  alt="Google"
                  className="h-5 w-5"
                />
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>
        <p className="text-sm text-slate-400 absolute bottom-4">
          © {new Date().getFullYear()} Hardik Goyal. All rights reserved.
        </p>
      </div>
    </div>
  );
}
