"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  History as HistoryIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  TriangleAlert,
  UserCircle,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useMounted } from "@/lib/hooks";
import { APP_NAME } from "@/lib/config";
import { OPEN_STATUSES } from "@/lib/technician";
import { ago } from "@/lib/utils";
import { Skeleton, StatusBadge, Toaster, cn } from "./ui";

const NAV = [
  { href: "/technician/dashboard", label: "My Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/technician/tasks", label: "My Tasks", short: "Tasks", icon: ClipboardList },
  { href: "/technician/inspection", label: "Inspection", short: "Inspect", icon: ClipboardCheck },
  { href: "/technician/report-fault", label: "Report a Fault", short: "Report", icon: TriangleAlert },
  { href: "/technician/part-requests", label: "Spare-Part Requests", short: "Parts", icon: Package },
  { href: "/technician/history", label: "Task History", short: "History", icon: HistoryIcon },
  { href: "/technician/notifications", label: "Notifications", short: "Alerts", icon: Bell },
  { href: "/technician/profile", label: "Profile / Availability", short: "Profile", icon: UserCircle },
];
const BOTTOM = [
  "/technician/dashboard",
  "/technician/tasks",
  "/technician/report-fault",
  "/technician/part-requests",
  "/technician/notifications",
];

export default function TechnicianShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, technicians, notifications, workOrders, markRead, markAllRead } = useStore();

  // Menus remember the path they were opened on, so they close automatically after navigating
  const [navAt, setNavAt] = useState<string | null>(null);
  const [bellAt, setBellAt] = useState<string | null>(null);
  const [profileAt, setProfileAt] = useState<string | null>(null);

  const navOpen = navAt === pathname;
  const bellOpen = bellAt === pathname;
  const profileOpen = profileAt === pathname;

  const setNavOpen = (o: boolean) => setNavAt(o ? pathname : null);
  const setBellOpen = (o: boolean) => setBellAt(o ? pathname : null);
  const setProfileOpen = (o: boolean) => setProfileAt(o ? pathname : null);

  const tech = technicians.find((t) => t.id === user?.id);
  const allowed = !!user && user.role === "technician" && !!tech?.active;

  // ROUTE GUARD – not signed in → /login, manager → manager console, deactivated technician → /login
  useEffect(() => {
    if (!mounted) return;
    if (!user) router.replace("/login");
    else if (user.role !== "technician") router.replace("/manager/dashboard");
    else if (!tech?.active) {
      logout();
      router.replace("/login");
    }
  }, [mounted, user, tech?.active, router, logout]);

  // Gate client render only after mounting to prevent SSR segment drop
  if (mounted && (!allowed || !tech)) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const mine = notifications;
  const unread = mine.filter((n) => !n.read).length;
  const newTasks = workOrders.filter((w) => w.assignedTo === user?.id && w.status === "Assigned").length;
  const openTasks = workOrders.filter((w) => w.assignedTo === user?.id && OPEN_STATUSES.includes(w.status)).length;
  const badge = (href: string) => (href.endsWith("notifications") ? unread : href.endsWith("/tasks") ? newTasks : 0);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <div className="min-h-screen lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:bg-accent focus:p-2">
        Skip to content
      </a>

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink text-paper transition-transform lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-paper/20 px-4 py-4">
          <div className="flex items-center gap-2 font-bold">
            <span className="rounded bg-accent p-1 text-ink">
              <Zap size={18} />
            </span>
            {APP_NAME}
            <span className="text-xs font-normal opacity-70">Technician</span>
          </div>
          <button className="lg:hidden" onClick={() => setNavOpen(false)} aria-label="Close menu">
            <X />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Technician navigation">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            const b = badge(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mb-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                  active ? "bg-accent font-semibold text-ink" : "hover:bg-paper/10"
                )}
              >
                <Icon size={17} aria-hidden />
                <span className="flex-1">{label}</span>
                {b > 0 && (
                  <span className={cn("rounded-full px-1.5 text-xs font-bold", active ? "bg-ink text-accent" : "bg-accent text-ink")}>
                    {b}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-paper/20 p-3 text-xs opacity-70">
          {openTasks} open task(s) · Mock-data build
        </div>
      </aside>
      {navOpen && <div className="fixed inset-0 z-30 bg-ink/60 lg:hidden" onClick={() => setNavOpen(false)} />}

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-ink/25 bg-paper px-3 py-2.5 sm:gap-3 sm:px-4">
        <button className="rounded-md p-1.5 hover:bg-ink/10 lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu">
          <Menu />
        </button>
        <nav aria-label="Breadcrumb" className="hidden flex-1 items-center gap-1 overflow-x-auto text-sm sm:flex">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1 whitespace-nowrap capitalize">
              {i > 0 && <ChevronRight size={14} className="opacity-50" />}
              <span className={i === crumbs.length - 1 ? "font-semibold" : "opacity-70"}>{c.replace(/-/g, " ")}</span>
            </span>
          ))}
        </nav>
        <div className="flex-1 font-semibold sm:hidden">{NAV.find((n) => isActive(n.href))?.label ?? "Technician"}</div>

        <Link href="/technician/profile" aria-label="Change availability" className="hidden sm:block">
          <StatusBadge status={tech?.availability ?? "Available"} />
        </Link>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setBellOpen(!bellOpen);
              setProfileOpen(false);
            }}
            aria-label={`Notifications, ${unread} unread`}
            className="relative rounded-md p-2 hover:bg-ink/10"
          >
            <Bell size={20} />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1.5 text-xs font-bold">{unread}</span>}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-ink bg-paper shadow-xl z-50">
              <div className="flex items-center justify-between border-b border-ink/25 px-3 py-2 text-sm font-semibold">
                Notifications
                <button className="text-xs underline" onClick={markAllRead}>
                  Mark all read
                </button>
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {mine.length === 0 && <li className="px-3 py-4 text-sm opacity-70">You are all caught up.</li>}
                {mine.slice(0, 6).map((n) => (
                  <li key={n.id} className={cn("border-b border-ink/10", !n.read && "bg-accent/20")}>
                    <Link
                      href={n.link ? n.link.replace("/manager/", "/technician/") : "/technician/notifications"}
                      onClick={() => markRead(n.id)}
                      className="block px-3 py-2 text-sm"
                    >
                      <div className="font-medium">{!n.read && "● "}{n.title}</div>
                      <div className="text-xs opacity-80">{n.message}</div>
                      <div className="text-xs opacity-60">{ago(n.at)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/technician/notifications" className="block px-3 py-2 text-center text-sm font-semibold underline">
                View all
              </Link>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setBellOpen(false);
            }}
            className="flex items-center gap-2 rounded-md p-1 hover:bg-ink/10"
            aria-label="Profile menu"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold">
              {(user?.name ?? "T").split(" ").map((p) => p[0]).join("")}
            </span>
            <span className="hidden text-left text-xs md:block">
              <span className="block font-semibold">{user?.name ?? "Technician"}</span>
              <span className="capitalize opacity-70">{user?.role ?? "technician"}</span>
            </span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-ink bg-paper py-1 text-sm shadow-xl z-50">
              <Link href="/technician/profile" className="block px-3 py-2 hover:bg-ink/10">
                Profile & availability
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-ink/10 text-red-600 font-medium"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1200px] p-3 pb-24 sm:p-4 lg:p-6 lg:pb-6">
        {children}
      </main>

      {/* Mobile bottom navigation (technician workflows are optimised for a phone browser) */}
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-ink bg-ink text-paper lg:hidden"
      >
        {NAV.filter((n) => BOTTOM.includes(n.href)).map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          const b = badge(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px]",
                active ? "bg-accent font-semibold text-ink" : ""
              )}
            >
              <Icon size={19} aria-hidden />
              {short}
              {b > 0 && (
                <span className={cn("absolute right-3 top-1 rounded-full px-1.5 text-[10px] font-bold", active ? "bg-ink text-accent" : "bg-accent text-ink")}>
                  {b}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <Toaster />
    </div>
  );
}
