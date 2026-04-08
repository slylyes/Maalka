"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDaysIcon,
  HomeIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/dashboard/dresses", label: "Robes", icon: SparklesIcon },
  { href: "/dashboard/clients", label: "Clients", icon: UserGroupIcon },
  { href: "/dashboard/reservations", label: "Réservations", icon: CalendarDaysIcon },
];

export function DashboardNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 grid grid-cols-2 gap-2 md:flex md:flex-wrap">
      {links.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== "/dashboard" && pathname.startsWith(link.href));

        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors md:justify-start ${
              isActive
                ? "border border-[var(--accent)] bg-[var(--surface-soft)] text-[var(--accent-deep)]"
                : "border border-[var(--border-soft)] text-[var(--muted)] hover:bg-[var(--surface-soft)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
