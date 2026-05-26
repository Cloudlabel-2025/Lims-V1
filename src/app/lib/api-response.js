import { NextResponse } from "next/server";

export function errorPayload(message, error) {
  const payload = { error: message };

  if (process.env.NODE_ENV !== "production" && error?.message) {
    payload.details = error.message;
  }

  return payload;
}

export function jsonError(message, error, status = 500) {
  return Response.json(errorPayload(message, error), { status });
}

export function nextJsonError(message, error, status = 500) {
  return NextResponse.json(errorPayload(message, error), { status });
}
