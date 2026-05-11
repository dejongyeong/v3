import { NextProxy, NextResponse } from "next/server";

type MiddlewareFactory = (middleware: NextProxy) => NextProxy;

export function chain(
  functions: MiddlewareFactory[] = [],
  index: number = 0,
): NextProxy {
  const current = functions[index];

  if (current) {
    const next = chain(functions, index + 1);
    return current(next);
  }

  return () => NextResponse.next();
}
