import { NextRequest, NextResponse } from "next/server";
import { getPublicProfileByUsername } from "@/lib/public-profile";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ username: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const { username } = await params;
  const cleanUsername = username.replace(/^@/, "");
  const profile = await getPublicProfileByUsername(cleanUsername);

  if (!profile || !profile.found) {
    return new Response(`[StoneWay Error]: User @${cleanUsername} not found.`, {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!profile.isPublic) {
    return new Response(
      `[StoneWay Notice]: Developer profile @${profile.handle} is currently private.`,
      {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }
    );
  }

  return new Response(profile.rawMarkdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "X-StoneWay-Profile": profile.handle,
    },
  });
}
