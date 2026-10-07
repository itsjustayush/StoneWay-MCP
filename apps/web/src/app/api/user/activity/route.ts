import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, schema } from "@stoneway/database";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await db
    .select({
      id: schema.auditEvents.id,
      event: schema.auditEvents.event,
      agentLabel: schema.auditEvents.agentLabel,
      ipHash: schema.auditEvents.ipHash,
      requestId: schema.auditEvents.requestId,
      metadata: schema.auditEvents.metadata,
      createdAt: schema.auditEvents.createdAt,
    })
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.userId, session.user.id))
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(50);

  return NextResponse.json({ events });
}
