import { NextResponse } from "next/server";
import { authenticateBearerToken, getOrCreateProfile, reconcileProfile } from "@/lib/server-utils";
import { decryptConfig, db, schema } from "@stoneway/database";
import { githubConnector } from "@/lib/connectors/github";
import { DecryptedConfig } from "@stoneway/shared";
import { eq } from "drizzle-orm";

import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const integration = body.integration || "github";

    await recordAuditEvent({
      userId: authRes.context.userId,
      event: "sync.trigger",
      agentLabel: req.headers.get("x-stoneway-agent") || "sync_runner",
      req,
      metadata: { integration },
    });

    const profile = await getOrCreateProfile(authRes.context.userId);

    // Fetch user details for handle
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, authRes.context.userId))
      .limit(1);

    const decrypted = decryptConfig<DecryptedConfig>(profile.stonewayConfig);
    const githubHandle =
      profile.stonewayJson?.identity?.handle ||
      user?.name?.replace(/\s+/g, "").toLowerCase() ||
      "itsjustayush";

    let syncResult;
    if (integration === "github" || integration === "all") {
      syncResult = await githubConnector.sync(githubHandle, decrypted);

      if (syncResult.success && syncResult.extracted_data) {
        // Merge extracted data safely into profile
        await reconcileProfile(profile, {
          baseVersion: profile.version,
          jsonPatch: {
            active_projects: syncResult.extracted_data.active_projects,
            technical_profile: {
              primary_languages: syncResult.extracted_data.primary_languages,
            },
          },
          agentName: "connector_github_sync",
        });

        await recordAuditEvent({
          userId: authRes.context.userId,
          event: "sync.complete",
          agentLabel: "connector_github_sync",
          req,
          metadata: {
            integration: "github",
            projects_synced: syncResult.extracted_data.active_projects?.length || 0,
            field_sources: syncResult.field_sources,
          },
        });
      } else {
        await recordAuditEvent({
          userId: authRes.context.userId,
          event: "sync.error",
          agentLabel: "connector_github_sync",
          req,
          metadata: {
            integration: "github",
            error: syncResult.error || syncResult.message,
          },
        });
      }
    } else {
      return NextResponse.json(
        { error: `Integration '${integration}' is not yet enabled or configured.` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      integration,
      result: syncResult,
    });
  } catch (err: any) {
    await recordAuditEvent({
      userId: authRes.context.userId,
      event: "sync.error",
      agentLabel: "sync_runner",
      req,
      metadata: { error: err.message },
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
