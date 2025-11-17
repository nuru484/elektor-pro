import { getUser } from "@/lib/dataAccessLayer";

export async function requireSuperAdmin() {
  const user = await getUser();

  if (!user || user.role !== "SUPER_ADMIN") {
    return null;
  }

  return user;
}
