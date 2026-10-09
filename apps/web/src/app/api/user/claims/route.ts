import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, schema } from "@stoneway/database";
import { eq, and } from "drizzle-orm";
import {
  ProfileClaim,
  ProfileClaimSchema,
  FieldProvenance,
  ProvenanceEngine,
} from "@stoneway/shared";
import { getOrCreateProfile } from "@/lib/server-utils";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const records = await db
    .select()
    .from(schema.provenanceRecords)
    .where(eq(schema.provenanceRecords.userId, session.user.id));

  return NextResponse.json({
    success: true,
    records: records.map((r) => ({
      field: r.field,
      canonical_value: r.canonicalValue,
      canonical_source: r.canonicalSource,
      canonical_source_type: r.canonicalSourceType,
      source_agent: r.sourceAgent,
      source_document: r.sourceDocument,
      confidence: parseFloat(r.confidence || "1.0"),
      user_override: r.userOverride,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
      observations: r.observations || [],
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ProfileClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid claim format", details: parsed.error.issues }, { status: 400 });
  }

  const claim: ProfileClaim = parsed.data;

  // Fetch existing provenance for this field
  const [existingRecord] = await db
    .select()
    .from(schema.provenanceRecords)
    .where(
      and(
        eq(schema.provenanceRecords.userId, session.user.id),
        eq(schema.provenanceRecords.field, claim.field)
      )
    )
    .limit(1);

  let existingProv: FieldProvenance | undefined = undefined;
  if (existingRecord) {
    existingProv = {
      field: existingRecord.field,
      canonical_value: existingRecord.canonicalValue,
      canonical_source: existingRecord.canonicalSource,
      canonical_source_type: existingRecord.canonicalSourceType as any,
      source_agent: existingRecord.sourceAgent || undefined,
      source_document: existingRecord.sourceDocument || undefined,
      created_at: existingRecord.createdAt.toISOString(),
      updated_at: existingRecord.updatedAt.toISOString(),
      confidence: parseFloat(existingRecord.confidence || "1.0"),
      user_override: existingRecord.userOverride,
      observations: existingRecord.observations || [],
    };
  }

  const { updated, acceptedAsCanonical, reason } = ProvenanceEngine.reconcileClaim(existingProv, claim);

  // Persist updated provenance record
  if (existingRecord) {
    await db
      .update(schema.provenanceRecords)
      .set({
        canonicalValue: updated.canonical_value,
        canonicalSource: updated.canonical_source,
        canonicalSourceType: updated.canonical_source_type,
        sourceAgent: updated.source_agent || null,
        sourceDocument: updated.source_document || null,
        confidence: updated.confidence.toString(),
        userOverride: updated.user_override,
        observations: updated.observations,
        updatedAt: new Date(),
      })
      .where(eq(schema.provenanceRecords.id, existingRecord.id));
  } else {
    await db.insert(schema.provenanceRecords).values({
      userId: session.user.id,
      field: updated.field,
      canonicalValue: updated.canonical_value,
      canonicalSource: updated.canonical_source,
      canonicalSourceType: updated.canonical_source_type,
      sourceAgent: updated.source_agent || null,
      sourceDocument: updated.source_document || null,
      confidence: updated.confidence.toString(),
      userOverride: updated.user_override,
      observations: updated.observations,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // If accepted as canonical, atomically update field in user's profile json
  if (acceptedAsCanonical) {
    const profile = await getOrCreateProfile(session.user.id);
    const jsonClone = JSON.parse(JSON.stringify(profile.stonewayJson));

    // Support nested paths like "technical_profile.primary_languages"
    const parts = claim.field.split(".");
    let current = jsonClone;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = updated.canonical_value;

    await db
      .update(schema.profiles)
      .set({
        stonewayJson: jsonClone,
        version: profile.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, session.user.id));
  }

  await recordAuditEvent({
    userId: session.user.id,
    event: acceptedAsCanonical ? "claim.accepted" : "claim.observation_only",
    agentLabel: claim.source_agent || "web_dashboard",
    req,
    metadata: {
      field: claim.field,
      source: claim.source,
      source_type: claim.source_type,
      accepted: acceptedAsCanonical,
      reason,
    },
  });

  return NextResponse.json({
    success: true,
    acceptedAsCanonical,
    reason,
    provenance: updated,
  });
}
