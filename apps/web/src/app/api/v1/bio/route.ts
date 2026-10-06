import { NextResponse } from "next/server";
import { authenticateBearerToken, getOrCreateProfile } from "@/lib/server-utils";
import { BioQuerySchema, StoneWayJson } from "@stoneway/shared";

function formatBio(json: StoneWayJson, platform: string, tone: string, maxLength: number) {
  const identity = json.identity;
  const name = identity.name || identity.handle || "Developer";
  const role = identity.headline || "Full-Stack Builder & Vibecoder";
  const languages = (json.technical_profile?.primary_languages || []).slice(0, 4).join(", ");
  const activeProjects = (json.active_projects || []).slice(0, 2).map((p) => p.name).join(" & ");

  // Check if predefined platform variant exists
  const existingVariant = (json.bio_variants as any)?.[platform];
  if (existingVariant && existingVariant.trim().length > 0 && existingVariant.length <= maxLength) {
    return existingVariant;
  }

  let bio = "";

  if (platform === "x" || platform === "github") {
    if (tone === "minimal") {
      bio = `${name} | ${role} | ${languages}`;
    } else if (tone === "founder") {
      bio = `Building ${activeProjects || "the future"}. ${role}. Crafting with ${languages || "TypeScript"}.`;
    } else {
      bio = `Hey, I'm ${name}. ${role}. Currently hacking on ${activeProjects || "AI & Web"} with ${languages || "modern tech"}.`;
    }
  } else if (platform === "linkedin") {
    bio = `${name} — ${role}. Specializing in ${languages || "full-stack development"}. Currently engineering ${activeProjects || "innovative software products"}. Focused on scalable architectures and AI systems.`;
  } else if (platform === "devpost") {
    bio = `${role} passionate about rapid prototyping and autonomous systems. Stack: ${languages || "TypeScript, Python, Next.js"}. Building ${activeProjects || "hackathon projects"}.`;
  } else {
    bio = `${name} — ${role}. Building with ${languages || "TypeScript, Next.js, and AI"}.`;
  }

  if (bio.length > maxLength) {
    bio = bio.slice(0, maxLength - 3) + "...";
  }

  return bio;
}

export async function GET(req: Request) {
  const authRes = await authenticateBearerToken(req);
  if (!authRes.success) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const parsedQuery = BioQuerySchema.parse({
      platform: searchParams.get("platform") || "generic",
      tone: searchParams.get("tone") || "technical",
      max_length: searchParams.get("max_length") ? Number(searchParams.get("max_length")) : 280,
    });

    const profile = await getOrCreateProfile(authRes.context.userId);
    const json = profile.stonewayJson;

    // Filter strictly public contact info
    const publicContacts: Record<string, string> = {};
    if (json.contact) {
      for (const [key, field] of Object.entries(json.contact)) {
        if (field && typeof field === "object" && (field as any).visibility === "public" && (field as any).value) {
          publicContacts[key] = (field as any).value;
        }
      }
    }

    const bio = formatBio(json, parsedQuery.platform, parsedQuery.tone, parsedQuery.max_length);

    return NextResponse.json({
      platform: parsedQuery.platform,
      tone: parsedQuery.tone,
      bio,
      character_count: bio.length,
      sources_used: {
        name: json.identity?.name,
        role: json.identity?.headline,
        public_contacts: publicContacts,
        active_projects_count: (json.active_projects || []).length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
