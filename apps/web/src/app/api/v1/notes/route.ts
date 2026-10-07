import { NextResponse } from "next/server";
import { authenticateBearerToken, getOrCreateProfile, reconcileProfile } from "@/lib/server-utils";
import { AppendNotePayloadSchema } from "@stoneway/shared";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const body = await req.json();
    const payload = AppendNotePayloadSchema.parse(body);

    const profile = await getOrCreateProfile(authRes.context.userId);

    const result = await reconcileProfile(profile, {
      baseVersion: profile.version,
      mdAppend: payload.note,
      agentName: payload.agent_name || req.headers.get("x-stoneway-agent") || "note-agent",
    });

    return NextResponse.json({
      success: true,
      version: result.updatedProfile.version,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
