import { ArcjetDecision } from "@arcjet/next";
import {
  NextFetchEvent,
  NextMiddleware,
  NextRequest,
  NextResponse,
} from "next/server";

import arcjet from "@/lib/arcjet";

export function arcjetMiddleware(middleware: NextMiddleware) {
  return async (request: NextRequest, event: NextFetchEvent) => {
    const decision: ArcjetDecision = await arcjet.protect(request, {
      requested: 1,
    });

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

    return middleware(request, event);
  };
}
