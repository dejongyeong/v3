import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_ROUTE = "isPublicRoute";

// Only mark a route with @Public() if it needs to be reachable without authentication/token,
// for example, login or registration endpoints, health checks, or public content. Do not leave
// the starter GET/ controller as an unguarded public route. Remove it or protect it with authentication.
export const Public = () => SetMetadata(IS_PUBLIC_ROUTE, true);
