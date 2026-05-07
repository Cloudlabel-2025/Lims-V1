import { NextResponse } from "next/server";
import { requireAnySession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireAnySession(req);
    if (auth.error) {
      return auth.error;
    }

    const { session } = auth;
    return NextResponse.json({
      session,
      user: {
        id: session.userId,
        userType: session.userType,
        tenantId: session.tenantId || null,
        email: session.email,
        roleName: session.roleName || (session.isSystemOwner ? "System Owner" : null),
        permissions: session.permissions || [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to read session", details: error.message },
      { status: 500 }
    );
  }
}
