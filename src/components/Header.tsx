import React from "react";
import { Cloud, ShieldCheck, Server } from "lucide-react";

interface HeaderProps {
  serverStatus: "checking" | "online" | "offline";
}

export const Header: React.FC<HeaderProps> = ({ serverStatus }) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-900 tracking-tight">CloudVault</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Foundation v0.1.0
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Cloud-Based Media Files Storage Service
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span>Backend API:</span>
            {serverStatus === "checking" && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Checking
              </span>
            )}
            {serverStatus === "online" && (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Online (:3000)
              </span>
            )}
            {serverStatus === "offline" && (
              <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Offline
              </span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Project Scaffolding Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
};
