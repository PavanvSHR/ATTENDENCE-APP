import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { useAuth } from "@/auth/useAuth";

const TITLES: Record<string, string> = {
  "/admin": "Admin Dashboard",
  "/admin/departments": "Departments",
  "/admin/classes": "Classes & Divisions",
  "/admin/teachers": "Teachers",
  "/admin/students": "Students",
  "/admin/class-representatives": "Class Representatives",
  "/admin/settings": "Settings & Attendance Policy",
  "/teacher": "Teacher Dashboard",
  "/teacher/sessions/new": "Start Attendance",
  "/student": "Student Dashboard",
  "/student/attendance": "Mark Attendance",
  "/reports": "Reports",
  "/audit-log": "Audit Log",
  "/notifications": "Notifications",
};

function resolveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  const match = Object.keys(TITLES)
    .filter((k) => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? TITLES[match] : "Smart Attendance";
}

export function AppShell() {
  const { profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (!profile) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={profile.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen flex-1 flex-col lg:pl-0 min-w-0">
        <TopNav title={resolveTitle(location.pathname)} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
