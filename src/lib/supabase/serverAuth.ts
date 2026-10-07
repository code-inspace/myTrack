import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Service-role client. It bypasses RLS, so every query made with it MUST be scoped
 * to the user returned by `getRequestUserId`.
 */
export function getAdminClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getWidgetSecret(): string | null {
  return process.env.WIDGET_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function signWidgetPayload(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`widget:v1:${userId}`).digest("base64url");
}

/** Long-lived token handed to the native iOS widget/intents, which can't hold a refreshable Supabase session. */
export function createWidgetToken(userId: string): string | null {
  const secret = getWidgetSecret();
  if (!secret) return null;
  return `v1.${userId}.${signWidgetPayload(userId, secret)}`;
}

export function verifyWidgetToken(token: string | null | undefined): string | null {
  const secret = getWidgetSecret();
  if (!token || !secret) return null;
  const [version, userId, signature] = token.split(".");
  if (version !== "v1" || !userId || !signature) return null;
  const expected = Buffer.from(signWidgetPayload(userId, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return userId;
}

/**
 * Resolves the authenticated user of a request, from (in order):
 * 1. `Authorization: Bearer <supabase access token>`
 * 2. the Supabase session cookies set by the browser client
 * 3. `X-Widget-Token` (only when `allowWidgetToken` is set — native widget routes)
 *
 * The `userId` sent in a query string or body is never trusted.
 */
export async function getRequestUserId(
  req: NextRequest,
  options: { allowWidgetToken?: boolean } = {},
): Promise<string | null> {
  if (options.allowWidgetToken) {
    const widgetUserId = verifyWidgetToken(req.headers.get("x-widget-token"));
    if (widgetUserId) return widgetUserId;
  }

  if (!supabaseUrl || !anonKey) return null;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const client = createSupabaseClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await client.auth.getUser(token);
        if (data?.user?.id) return data.user.id;
      } catch {
        // fall through to cookies
      }
    }
  }

  try {
    const client = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {
          // Route handlers only read the session here; refresh is handled by the browser client.
        },
      },
    });
    const { data } = await client.auth.getUser();
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
