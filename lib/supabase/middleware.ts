import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const PROTECTED_PATHS = ["/bang-dieu-khien"];
const LOGIN_PATH = "/dang-nhap";
const SETUP_PATH = "/thiet-lap";
const MISSING_DB_PATH = "/missing-db-config";

export async function updateSession(request: NextRequest) {
  // If env vars are missing, route to /missing-db-config so the user gets clear instructions.
  if (!supabaseUrl || !supabaseKey) {
    if (request.nextUrl.pathname !== MISSING_DB_PATH) {
      const url = request.nextUrl.clone();
      url.pathname = MISSING_DB_PATH;
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not run code between createServerClient and supabase.auth.getUser().
  // See https://supabase.com/docs/guides/auth/server-side/nextjs
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PATHS.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );
  const isLogin = request.nextUrl.pathname.startsWith(LOGIN_PATH);

  // Detect if the schema has been initialized.
  if (isProtected || isLogin) {
    const { error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    if (error && (error.code === "PGRST205" || error.code === "42P01")) {
      const url = request.nextUrl.clone();
      url.pathname = SETUP_PATH;
      return NextResponse.redirect(url);
    }
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    return NextResponse.redirect(url);
  }

  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/bang-dieu-khien";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
