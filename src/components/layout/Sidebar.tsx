import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  Bell,
  Settings,
  X,
  UserSquare2,
  QrCode,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  admin: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/departments", label: "Departments", icon: Building2 },
    { to: "/admin/classes", label: "Classes & Divisions", icon: BookOpen },
    { to: "/admin/teachers", label: "Teachers", icon: UserSquare2 },
    { to: "/admin/students", label: "Students", icon: GraduationCap },
    { to: "/admin/class-representatives", label: "Class Representatives", icon: Users },
    { to: "/reports", label: "Reports", icon: BarChart3 },
    { to: "/audit-log", label: "Audit Log", icon: ShieldCheck },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/admin/settings", label: "Settings & Policy", icon: Settings },
  ],
  teacher: [
    { to: "/teacher", label: "Dashboard", icon: LayoutDashboard },
    { to: "/teacher/sessions/new", label: "Start Attendance", icon: ClipboardCheck },
    { to: "/reports", label: "Reports", icon: BarChart3 },
    { to: "/audit-log", label: "Audit Log", icon: ShieldCheck },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  cr: [
    { to: "/teacher", label: "Dashboard", icon: LayoutDashboard },
    { to: "/teacher/sessions/new", label: "Start Attendance", icon: ClipboardCheck },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  student: [
    { to: "/student", label: "Dashboard", icon: LayoutDashboard },
    { to: "/student/attendance", label: "Mark Attendance", icon: QrCode },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
};

export function Sidebar({
  role,
  open,
  onClose,
}: {
  role: UserRole;
  open: boolean;
  onClose: () => void;
}) {
  const items = NAV_BY_ROLE[role];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-border bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span>Smart Attendance</span>
          </div>
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin" || item.to === "/teacher" || item.to === "/student"}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
