import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  type OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { JWTPayload } from "jose";
import { importSPKI, jwtVerify } from "jose";
import { IS_PUBLIC_ROUTE } from "./public.decorator.js";

const TOKEN_ALGORITHM = "EdDSA";
const TOKEN_ISSUER = "portfolio-web";
const TOKEN_AUDIENCE = "portfolio-api";
const REQUIRED_SCOPE = "portfolio:read";
const MAX_TOKEN_AGE = "60s";
const MAX_TOKEN_LENGTH = 4096;

// Using a global default-deny guard to require a short-lived service token for all routes by default. Public
// exceptions are explicit in route metadata via the @Public() decorator. Nest verifies the token with a public
// key, so the API does not hold the private signing key
@Injectable()
export class ServiceTokenGuard implements CanActivate, OnModuleInit {
  private readonly publicKeyPromise: ReturnType<typeof importSPKI>;

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {
    const pem = this.config
      .getOrThrow<string>("NEST_API_SIGNING_PUBLIC_KEY")
      .replaceAll("\\n", "\n");

    // Ed25519 key pair - identifies the web service, not the visitor
    // it does not authenticate the admin, it needs separate user authentication
    // for each write operation
    this.publicKeyPromise = importSPKI(pem, TOKEN_ALGORITHM);
  }

  async onModuleInit(): Promise<void> {
    await this.publicKeyPromise;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    const token = /^Bearer ([^\s]+)$/i.exec(authorization ?? "")?.[1];

    if (!token || token.length > MAX_TOKEN_LENGTH)
      throw new UnauthorizedException();

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, await this.publicKeyPromise, {
        algorithms: [TOKEN_ALGORITHM],
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        typ: "JWT",
        requiredClaims: ["exp"],
        maxTokenAge: MAX_TOKEN_AGE,
      }));
    } catch {
      throw new UnauthorizedException();
    }

    if (payload.scope !== REQUIRED_SCOPE) throw new UnauthorizedException();

    return true;
  }
}
