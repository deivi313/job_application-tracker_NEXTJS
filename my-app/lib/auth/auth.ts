import { betterAuth } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { initializeUserBoard } from "../init-user-board";
import { getPool } from "../db";

export const auth = betterAuth({
  database: getPool(),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (user.id) {
            try {
              await initializeUserBoard(user.id);
              console.log("User board initialized:", user.id);
            } catch (error) {
              console.error("Failed to initialize user board:", error);
            }
          }
        },
      },
    },
  },
});

export async function getSession() {
  const result = await auth.api.getSession({
    headers: await headers(),
  });

  return result;
}

export async function signOut() {
  const result = await auth.api.signOut({
    headers: await headers(),
  });

  if (result.success) {
    redirect("/sign-in");
  }
}
