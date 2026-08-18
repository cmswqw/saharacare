import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  // Keep this call immediately after client creation. It validates the session
  // with Supabase Auth and refreshes cookies when required.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoute = request.nextUrl.pathname.startsWith("/patient")
    || request.nextUrl.pathname.startsWith("/caregiver")
    || request.nextUrl.pathname.startsWith("/doctor")
    || request.nextUrl.pathname.startsWith("/settings");

  if (!user && protectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);

    const redirectResponse = NextResponse.redirect(loginUrl);

    response.headers.forEach((value, name) => {
      if (name.toLowerCase() !== "set-cookie") {
        redirectResponse.headers.set(name, value);
      }
    });

    response.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirectResponse.cookies.set(name, value, options);
    });

    return redirectResponse;
  }

  return response;
}
