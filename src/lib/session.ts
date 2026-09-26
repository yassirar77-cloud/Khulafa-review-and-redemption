import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSession, verifySession, type Session } from "./auth";

const ADMIN_COOKIE = "kb_admin";
const STAFF_COOKIE = "kb_staff";
const ADMIN_MAX_AGE = 60 * 60 * 12; // 12 hours
const STAFF_MAX_AGE = 60 * 60 * 16; // one long shift

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySession(store.get(ADMIN_COOKIE)?.value)?.role === "admin";
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin");
}

export async function startAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, signSession({ role: "admin" }, ADMIN_MAX_AGE), cookieOptions(ADMIN_MAX_AGE));
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function staffBranchId(): Promise<number | null> {
  const store = await cookies();
  const session: Session | null = verifySession(store.get(STAFF_COOKIE)?.value);
  return session?.role === "staff" ? session.branchId : null;
}

export async function startStaffSession(branchId: number): Promise<void> {
  const store = await cookies();
  store.set(
    STAFF_COOKIE,
    signSession({ role: "staff", branchId }, STAFF_MAX_AGE),
    cookieOptions(STAFF_MAX_AGE),
  );
}

export async function endStaffSession(): Promise<void> {
  (await cookies()).delete(STAFF_COOKIE);
}
