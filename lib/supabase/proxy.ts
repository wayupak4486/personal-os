import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request,
    });

    const { url, key } = getSupabaseConfig();
    const supabase = createServerClient(
        url,
        key,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },

                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });

                    response = NextResponse.next({
                        request,
                    });

                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (process.env.NODE_ENV !== "production" && (user || authError)) {
        console.info("Supabase proxy auth", {
            userId: user?.id,
            error: authError?.message,
        });
    }

    const pathname = request.nextUrl.pathname;

    const isProtectedPage =
        pathname === "/" ||
        pathname.startsWith("/today") ||
        pathname.startsWith("/tasks") ||
        pathname.startsWith("/sleep") ||
        pathname.startsWith("/payments") ||
        pathname.startsWith("/goals") ||
        pathname.startsWith("/workout") ||
        pathname.startsWith("/progress") ||
        pathname.startsWith("/settings");

    if (!user && isProtectedPage) {
        const url = request.nextUrl.clone();

        url.pathname = "/auth/login";
        url.searchParams.set("next", pathname);

        return NextResponse.redirect(url);
    }

    return response;
}
