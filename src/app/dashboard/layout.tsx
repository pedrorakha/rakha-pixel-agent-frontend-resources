"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { PasswordGate } from "@/components/auth/password-gate";

const NAV_ITEMS = [
  { href: "/dashboard", label: "OVERVIEW", icon: "[]" },
  { href: "/dashboard/office-editor", label: "OFFICE EDITOR", icon: "[#]" },
  { href: "/dashboard/members", label: "MEMBERS", icon: "[M]" },
  { href: "/dashboard/characters", label: "CHARACTERS", icon: "[C]" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <PasswordGate area="dashboard">
    <div className="h-screen bg-pixel-bg flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 h-screen bg-pixel-surface border-r-4 border-pixel-panel flex-col shrink-0">
        <div className="p-5 border-b-4 border-pixel-panel shrink-0">
          <Link href="/office" className="block">
            <h1 className="font-pixel text-[13px] text-pixel-accent">RAKHA AGENT</h1>
            <p className="font-pixel text-[9px] text-pixel-muted mt-1">DASHBOARD</p>
          </Link>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 font-pixel text-[10px] transition-all border-2 shrink-0 ${
                  isActive
                    ? "bg-pixel-accent/20 border-pixel-accent text-pixel-accent shadow-[2px_2px_0px_0px_rgba(233,69,96,0.3)]"
                    : "border-transparent text-pixel-muted hover:text-pixel-text hover:bg-pixel-bg/50 hover:border-pixel-panel"
                }`}
              >
                <span className="text-[11px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t-2 border-pixel-panel/50 shrink-0">
          <Link href="/office" className="flex items-center gap-2 font-pixel text-[9px] text-pixel-muted hover:text-pixel-accent transition-colors">
            {"<-"} BACK TO OFFICE
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-pixel-surface border-b-4 border-pixel-panel">
        <Link href="/office" className="font-pixel text-[11px] text-pixel-accent">RAKHA AGENT</Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="font-pixel text-[13px] text-pixel-text hover:text-pixel-accent transition-colors px-2 py-1"
        >
          {mobileMenuOpen ? "[X]" : "[=]"}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileMenuOpen(false)} />
          <div className="md:hidden fixed top-12 left-0 right-0 z-50 bg-pixel-surface border-b-4 border-pixel-panel p-4">
            <nav className="flex flex-col gap-1.5">
              {NAV_ITEMS.map((item) => {
                const isActive = item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 font-pixel text-[10px] transition-all border-2 ${
                      isActive
                        ? "bg-pixel-accent/20 border-pixel-accent text-pixel-accent"
                        : "border-transparent text-pixel-muted hover:text-pixel-text"
                    }`}
                  >
                    <span className="text-[11px]">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/office"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-3 font-pixel text-[9px] text-pixel-muted hover:text-pixel-accent mt-2 border-t-2 border-pixel-panel/50 pt-4"
              >
                {"<-"} BACK TO OFFICE
              </Link>
            </nav>
          </div>
        </>
      )}

      {/* Main content — independent scroll */}
      <main className="flex-1 h-screen overflow-y-auto">
        {/* Spacer for mobile header */}
        <div className="md:hidden h-12 shrink-0" />
        <div className="p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
    </PasswordGate>
  );
}
