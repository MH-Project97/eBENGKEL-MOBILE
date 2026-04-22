import type { Role } from "./types";

export const roleLabels: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  kasir: "Kasir",
  mekanik: "Mekanik",
};

export function isManagerRole(role?: Role) {
  return role === "owner" || role === "admin";
}