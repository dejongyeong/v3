import { NextRequest, NextResponse } from "next/server";

import arject from "./libs/arcjet";

// avoid double protection with middleware (https://docs.arcjet.com/rate-limiting/reference)
export const config = {
  matcher: [
    // skip next.js internals and all static files, unless found in search params
    "/((?!_next|monitoring|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // always run for api and trpc routes but do not define any rules in the api routes
    "/(api|trpc)(.*)",
    // capture all routes
    "/:path*",
  ],
};

// chaining middleware: https://docs.arcjet.com/integrations/authjs/#chaining-middleware
export async function middleware(request: NextRequest) {
  const decision = await arject.protect(request, { requested: 5 });

  if (decision.isDenied()) {
    const status = decision.reason.isRateLimit() ? 429 : 403;
    const err = decision.reason.isRateLimit()
      ? "Too many requests"
      : "Forbidden";

    return NextResponse.json(
      { error: err, reason: decision.reason },
      { status },
    );
  }

  return NextResponse.next();
}
