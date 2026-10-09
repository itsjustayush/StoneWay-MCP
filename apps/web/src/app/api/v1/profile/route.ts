import { NextResponse } from "next/server";
import { authenticateBearerToken, getOrCreateProfile, reconcileProfile, filterProfileContext } from "@/lib/server-utils";
import { ProfileUpdatePayloadSchema } from "@stoneway/shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const profile = await getOrCreateProfile(authRes.context.userId);
    const json = profile.stonewayJson;
    const md = profile.stonewayMd;

    const lastReconciled = json?.meta?.last_reconciled_md_version ?? 0;
    const needsReconcile = profile.version > lastReconciled;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || undefined;
    const { mdExcerpt, jsonFiltered, isTruncated } = filterProfileContext(md, json, query);
    const unreconciledExcerpt = needsReconcile ? md.slice(-500) : undefined;

    return NextResponse.json({
      version: profile.version,
      needs_reconcile: needsReconcile,
      unreconciled_md_excerpt: unreconciledExcerpt,
      stoneway_json: jsonFiltered,
      stoneway_md: mdExcerpt,
      is_truncated: isTruncated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Internal server error: ${err.message}` },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const body = await req.json();
    const payload = ProfileUpdatePayloadSchema.parse(body);

    const profile = await getOrCreateProfile(authRes.context.userId);

    const result = await reconcileProfile(profile, {
      baseVersion: payload.base_version,
      jsonPatch: payload.json_patch,
      mdAppend: payload.md_append,
      mdReplace: payload.md_replace,
      agentName: payload.agent_name || req.headers.get("x-stoneway-agent") || "unknown-agent",
    });

    return NextResponse.json({
      success: true,
      version: result.updatedProfile.version,
      unstructured_count: result.unstructuredCount,
      profile: {
        stoneway_json: result.updatedProfile.stonewayJson,
        stoneway_md: result.updatedProfile.stonewayMd,
      },
    });
  } catch (err: any) {
    const isConflict = err.message && err.message.includes("Version conflict");
    return NextResponse.json(
      { error: err.message },
      { status: isConflict ? 409 : 400 }
    );
  }
}
