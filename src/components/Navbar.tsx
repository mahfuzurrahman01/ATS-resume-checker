import React from "react";
import Link from "next/link";
import { Github } from "lucide-react";

export function Navbar() {
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

          {/* Right side icons */}
          <div className="flex items-center space-x-2">
            {/* GitHub Icon */}
            <Link
              href="https://github.com/mahfuzurrahman01"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-300 hover:text-white transition-colors duration-200 group"
            >
              <Github className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
