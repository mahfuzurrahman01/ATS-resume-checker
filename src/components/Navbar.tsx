import React from "react";
import Link from "next/link";
import { Github, Coins, Crown } from "lucide-react";
import { getCurrentUser, getUserCredits } from "@/lib/auth";
import { AuthButton } from "@/components/AuthButton";

export async function Navbar() {
  const user = await getCurrentUser();
  const credits = user ? await getUserCredits(user.id) : null;

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
                <span className="font-normal">Checker</span>
              </span>
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            {user && credits && (
              <span className="hidden sm:inline-flex items-center space-x-1.5 rounded-full bg-gray-900/60 border border-gray-700/40 px-3 py-1.5 text-sm text-gray-200">
                {credits.isLifetime ? (
                  <>
                    <Crown className="h-4 w-4 text-yellow-400" />
                    <span>Lifetime</span>
                  </>
                ) : (
                  <>
                    <Coins className="h-4 w-4 text-purple-400" />
                    <span>{credits.balance} credits</span>
                  </>
                )}
              </span>
            )}

            <Link
              href="https://github.com/mahfuzurrahman01"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-300 hover:text-white transition-colors duration-200 group"
            >
              <Github className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
            </Link>

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
