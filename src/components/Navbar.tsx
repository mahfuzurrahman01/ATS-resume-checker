import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { AuthButton } from "@/components/AuthButton";
import { CreditsNavBadge } from "@/components/CreditsNavBadge";

export async function Navbar() {
  const user = await getCurrentUser();

  return (
    <nav className="relative z-50">
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <div className="w-4 h-4 bg-white rounded-sm"></div>
              </div>
              <span className="font-bold text-xl text-white">
                <span className="font-bold">ATS</span>
                <span className="font-normal">Buddy</span>
              </span>
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            <Link
              href="/pricing"
              className="hidden sm:inline text-sm text-gray-300 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            {user && (
              <>
                <Link
                  href="/scan"
                  className="hidden sm:inline text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Scan
                </Link>
                <Link
                  href="/resumes"
                  className="hidden sm:inline text-sm text-gray-300 hover:text-white transition-colors"
                >
                  My Resumes
                </Link>
                <Link
                  href="/settings"
                  className="hidden sm:inline text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Settings
                </Link>
              </>
            )}
            <CreditsNavBadge />

            <AuthButton
              user={
                user
                  ? {
                      email: user.email,
                      name: user.name,
                      avatarUrl: user.avatarUrl,
                    }
                  : null
              }
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
