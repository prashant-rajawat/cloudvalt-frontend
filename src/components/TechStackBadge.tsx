import React from "react";
import { 
  Layers, 
  Server, 
  Database, 
  KeyRound, 
  HardDrive, 
  Code2, 
  Palette 
} from "lucide-react";

interface TechItem {
  name: string;
  category: "Frontend" | "Backend" | "Database" | "Auth" | "Storage" | "Styling" | "Language";
  icon: React.ElementType;
  description: string;
  badge: string;
}

const TECH_STACK: TechItem[] = [
  {
    name: "Next.js / React 19",
    category: "Frontend",
    icon: Layers,
    description: "App Router architectural paradigm with modern React components and hooks.",
    badge: "App Router / UI",
  },
  {
    name: "TypeScript",
    category: "Language",
    icon: Code2,
    description: "End-to-end type safety spanning data models, API payloads, and frontend state.",
    badge: "Strict Mode",
  },
  {
    name: "Tailwind CSS",
    category: "Styling",
    icon: Palette,
    description: "Utility-first CSS styling for modern, responsive Google Drive-inspired design.",
    badge: "Utility CSS",
  },
  {
    name: "Node.js + Express",
    category: "Backend",
    icon: Server,
    description: "Robust REST API gateway for auth proxying, metadata CRUD, and storage routes.",
    badge: "REST API Gateway",
  },
  {
    name: "PostgreSQL / Supabase",
    category: "Database",
    icon: Database,
    description: "Relational database schema for files, folders, permissions, and audit logs.",
    badge: "Relational DB",
  },
  {
    name: "Supabase Auth",
    category: "Auth",
    icon: KeyRound,
    description: "Secure user authentication, session tokens, and row-level security policies.",
    badge: "JWT & RLS",
  },
  {
    name: "Supabase Storage",
    category: "Storage",
    icon: HardDrive,
    description: "Scalable object storage buckets for photos, videos, audio, and documents.",
    badge: "Media Buckets",
  },
];

export const TechStackBadge: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {TECH_STACK.map((tech) => {
        const IconComponent = tech.icon;
        return (
          <div
            key={tech.name}
            className="p-4 rounded-xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-xs transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-700 border border-slate-100">
                  <IconComponent className="w-4 h-4 text-slate-700" />
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100">
                  {tech.badge}
                </span>
              </div>
              <h3 className="font-semibold text-sm text-slate-900">{tech.name}</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tech.description}</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
              <span>Category</span>
              <span className="font-medium text-slate-600">{tech.category}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
