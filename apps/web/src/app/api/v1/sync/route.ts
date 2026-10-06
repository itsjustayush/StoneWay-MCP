import { NextResponse } from "next/server";
import { authenticateBearerToken, getOrCreateProfile, reconcileProfile } from "@/lib/server-utils";
import { decryptConfig, db, schema } from "@stoneway/database";
import { githubConnector } from "@/lib/connectors/github";
import { DecryptedConfig } from "@stoneway/shared";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const integration = body.integration || "github";

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
