import type { UserRole } from "@/types";

export function roleHomePath(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "teacher":
    case "cr":
      return "/teacher";
    case "student":
      return "/student";
    default:
      return "/login";
  }
}
