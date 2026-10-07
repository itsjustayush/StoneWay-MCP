import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getOrCreateProfile } from "@/lib/server-utils";
import { stonewayToJsonResume } from "@stoneway/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getOrCreateProfile(session.user.id);
  const resume = stonewayToJsonResume(profile.stonewayJson);

  return NextResponse.json(resume, {
    headers: {
      "Content-Disposition": 'attachment; filename="resume.json"',
      "Content-Type": "application/json",
    },
  });
}
