import aj, { createMiddleware } from "./lib/arcjet";
import { chain } from "./middlewares/chain";

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
// reference: https://github.com/Farx1/autocorrectP/blob/main/middleware.ts
// reference: https://github.com/IvanSmiths/ivan-new-portfolio/blob/main/middleware.ts
// reference: https://github.com/ahmadk953/tasko/blob/main/middleware.ts
// reference: https://github.com/aayushmaan-54/Logify/blob/main/src/middleware.ts
export default createMiddleware(aj, chain([]));
