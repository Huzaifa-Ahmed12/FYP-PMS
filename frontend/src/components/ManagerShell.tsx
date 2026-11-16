"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight, ClipboardList, FileText, History as HistoryIcon, Inbox, LayoutDashboard, LogOut, MapPin, Menu, Package, Settings, Sparkles, Stethoscope, TriangleAlert, UserCheck, Users, X, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { useMounted } from "@/lib/hooks";
import { APP_NAME } from "@/lib/config";
import { ago } from "@/lib/utils";
import { Skeleton, Toaster, cn } from "./ui";

const NAV = [
  { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/generators", label: "Generator Assets", icon: Zap },
  { href: "/manager/map", label: "Fleet Map", icon: MapPin },
  { href: "/manager/diagnostics", label: "Diagnostics", icon: Stethoscope },
  { href: "/manager/faults", label: "Faults", icon: TriangleAlert },
  { href: "/manager/alerts", label: "Alerts & Notifications", icon: Bell },
  { href: "/manager/technicians", label: "Technicians", icon: Users },
  { href: "/manager/recommendations", label: "Recommendations", icon: Sparkles },
  { href: "/manager/assignments", label: "Assignments", icon: UserCheck },
  { href: "/manager/tasks", label: "Work Orders", icon: ClipboardList },
  { href: "/manager/inventory", label: "Inventory & Parts", icon: Package },
  { href: "/manager/part-requests", label: "Part Requests", icon: Inbox },
  { href: "/manager/history", label: "History", icon: HistoryIcon },
  { href: "/manager/reports", label: "Reports", icon: FileText },
  { href: "/manager/settings", label: "Settings", icon: Settings },
];

export default function ManagerShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, notifications, partRequests, markRead, markAllRead } = useStore();
  const [navOpen, setNavOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    if (!user) router.replace("/login");
    else if (user.role !== "manager") router.replace("/technician/dashboard");
  }, [mounted, user, router]);
  useEffect(() => { setNavOpen(false); setBellOpen(false); setProfileOpen(false); }, [pathname]);

  if (mounted && (!user || user.role !== "manager")) return <div className="p-10"><Skeleton className="h-10 w-64" /></div>;

  const unread = notifications.filter((n) => !n.read).length;
  const pendingReq = partRequests.filter((r) => r.status === "Pending").length;
  const badge = (href: string) => (href.endsWith("alerts") ? unread : href.endsWith("part-requests") ? pendingReq : 0);
  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <div className="min-h-screen lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:bg-accent focus:p-2">Skip to content</a>

      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink text-paper transition-transform lg:translate-x-0", navOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between border-b border-paper/20 px-4 py-4">
          <div className="flex items-center gap-2 font-bold"><span className="rounded bg-accent p-1 text-ink"><Zap size={18} /></span>{APP_NAME}<span className="text-xs font-normal opacity-70">Manager</span></div>
          <button className="lg:hidden" onClick={() => setNavOpen(false)} aria-label="Close menu"><X /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Manager navigation">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const b = badge(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm", active ? "bg-accent font-semibold text-ink" : "hover:bg-paper/10")}>
                <Icon size={17} aria-hidden /><span className="flex-1">{label}</span>
                {b > 0 && <span className={cn("rounded-full px-1.5 text-xs font-bold", active ? "bg-ink text-accent" : "bg-accent text-ink")}>{b}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-paper/20 p-3 text-xs opacity-70">Mock-data build · backend not connected</div>
      </aside>
      {navOpen && <div className="fixed inset-0 z-30 bg-ink/60 lg:hidden" onClick={() => setNavOpen(false)} />}

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink/25 bg-paper px-4 py-3">
        <button className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu /></button>
        <nav aria-label="Breadcrumb" className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1 whitespace-nowrap capitalize">
              {i > 0 && <ChevronRight size={14} className="opacity-50" />}
              <span className={i === crumbs.length - 1 ? "font-semibold" : "opacity-70"}>{c.replace(/-/g, " ")}</span>
            </span>
          ))}
        </nav>

        <div className="relative">
          <button onClick={() => { setBellOpen(!bellOpen); setProfileOpen(false); }} aria-label={`Notifications, ${unread} unread`} className="relative rounded-md p-2 hover:bg-ink/10">
            <Bell size={20} />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1.5 text-xs font-bold">{unread}</span>}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border border-ink bg-paper shadow-xl">
              <div className="flex items-center justify-between border-b border-ink/25 px-3 py-2 text-sm font-semibold">Notifications<button className="text-xs underline" onClick={markAllRead}>Mark all read</button></div>
              <ul className="max-h-80 overflow-y-auto">
                {notifications.slice(0, 6).map((n) => (
                  <li key={n.id} className={cn("border-b border-ink/10", !n.read && "bg-accent/20")}>
                    <Link href={n.link ?? "/manager/alerts"} onClick={() => markRead(n.id)} className="block px-3 py-2 text-sm"><div className="font-medium">{!n.read && "● "}{n.title}</div><div className="text-xs opacity-80">{n.message}</div><div className="text-xs opacity-60">{ago(n.at)}</div></Link>
                  </li>
                ))}
              </ul>
              <Link href="/manager/alerts" className="block px-3 py-2 text-center text-sm font-semibold underline">View all</Link>
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => { setProfileOpen(!profileOpen); setBellOpen(false); }} className="flex items-center gap-2 rounded-md p-1 hover:bg-ink/10" aria-label="Profile menu">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold">{(user?.name ?? "M").split(" ").map((p) => p[0]).join("")}</span>
            <span className="hidden text-left text-xs sm:block"><span className="block font-semibold">{user?.name ?? "Manager"}</span><span className="capitalize opacity-70">{user?.role ?? "manager"}</span></span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-ink bg-paper py-1 text-sm shadow-xl">
              <Link href="/manager/settings" className="block px-3 py-2 hover:bg-ink/10">Profile & settings</Link>
              <button onClick={() => { logout(); router.replace("/login"); }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-ink/10"><LogOut size={15} />Log out</button>
            </div>
          )}
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1400px] p-4 lg:p-6">{children}</main>
      <Toaster />
    </div>
  );
}