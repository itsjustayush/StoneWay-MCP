import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, schema } from "@stoneway/database";
import { eq } from "drizzle-orm";
import { getOrCreateProfile } from "@/lib/server-utils";
import { STARTER_STONEWAY_MD, StoneWayJsonSchema } from "@stoneway/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getOrCreateProfile(session.user.id);
  return NextResponse.json({
    stoneway_md: profile.stonewayMd,
    stoneway_json: profile.stonewayJson,
    version: profile.version,
    updated_at: profile.updatedAt,
  });
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { stoneway_md } = body;

  const profile = await getOrCreateProfile(session.user.id);
  const nextVersion = profile.version + 1;

  const [updated] = await db
    .update(schema.profiles)
    .set({
      stonewayMd: stoneway_md,
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(schema.profiles.id, profile.id))
    .returning();

  // Log user revision
  await db.insert(schema.revisions).values({
    userId: session.user.id,
    version: nextVersion,
    fileType: "md",
    content: stoneway_md,
    agentLabel: "user_dashboard_edit",
  });

  return NextResponse.json({
    success: true,
    version: updated.version,
    updated_at: updated.updatedAt,
  });
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getOrCreateProfile(session.user.id);
  const nextVersion = profile.version + 1;

  const defaultJson = StoneWayJsonSchema.parse({
    meta: {
      version: nextVersion,
      last_reconciled_md_version: nextVersion,
      updated_at: new Date().toISOString(),
    },
  });

  await db
    .update(schema.profiles)
    .set({
      stonewayMd: STARTER_STONEWAY_MD,
      stonewayJson: defaultJson,
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(schema.profiles.id, profile.id));

  // Log wipe snapshot in revisions
  await db.insert(schema.revisions).values({
    userId: session.user.id,
    version: nextVersion,
    fileType: "md",
    content: "PROFILE WIPED BY USER",
    agentLabel: "user_wipe_action",
  });

  return NextResponse.json({ success: true, message: "Profile wiped and reset to default." });
}
