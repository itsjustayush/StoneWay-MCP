import { db, schema } from "@stoneway/database";
import { eq, or, sql } from "drizzle-orm";
import { StoneWayJson, StoneWayJsonSchema, wrapInSafetyEnvelope } from "@stoneway/shared";

export interface PublicProfileResult {
  found: boolean;
  isPublic: boolean;
  handle: string;
  name: string;
  avatar: string;
  headline: string;
  bio: string;
  location?: string;
  timezone?: string;
  contacts: Record<string, string>;
  technicalProfile: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    tools: string[];
  };
  activeProjects: Array<{
    name: string;
    description: string;
    repoUrl?: string;
    liveUrl?: string;
    techStack: string[];
  }>;
  bioVariants: Record<string, string>;
  rawMarkdown: string;
}

export async function getPublicProfileByUsername(
  username: string
): Promise<PublicProfileResult | null> {
  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();

  // Look up user by name, or match handle in stoneway_json
  const allProfiles = await db
    .select({
      id: schema.profiles.id,
      userId: schema.profiles.userId,
      isPublic: schema.profiles.isPublic,
      stonewayJson: schema.profiles.stonewayJson,
      stonewayMd: schema.profiles.stonewayMd,
      userName: schema.user.name,
      userImage: schema.user.image,
    })
    .from(schema.profiles)
    .innerJoin(schema.user, eq(schema.profiles.userId, schema.user.id));

  // Find match
  const match = allProfiles.find((p) => {
    const json = p.stonewayJson as StoneWayJson;
    const handle = json?.identity?.handle?.toLowerCase();
    const nameSlug = p.userName?.replace(/\s+/g, "").toLowerCase();
    return handle === cleanUsername || nameSlug === cleanUsername || p.userId === cleanUsername;
  });

  if (!match) {
    return null;
  }

  const json = StoneWayJsonSchema.parse(match.stonewayJson);

  if (!match.isPublic) {
    return {
      found: true,
      isPublic: false,
      handle: json.identity.handle || cleanUsername,
      name: json.identity.name || match.userName || cleanUsername,
      avatar: json.identity.avatar || match.userImage || "",
      headline: "",
      bio: "",
      contacts: {},
      technicalProfile: { languages: [], frameworks: [], databases: [], tools: [] },
      activeProjects: [],
      bioVariants: {},
      rawMarkdown: "",
    };
  }

  // Filter public contacts
  const contacts: Record<string, string> = {};
  if (json.contact.github?.visibility === "public" && json.contact.github.value) {
    contacts.github = json.contact.github.value;
  }
  if (json.contact.twitter?.visibility === "public" && json.contact.twitter.value) {
    contacts.twitter = json.contact.twitter.value;
  }
  if (json.contact.linkedin?.visibility === "public" && json.contact.linkedin.value) {
    contacts.linkedin = json.contact.linkedin.value;
  }
  if (json.contact.website?.visibility === "public" && json.contact.website.value) {
    contacts.website = json.contact.website.value;
  }
  if (json.contact.discord?.visibility === "public" && json.contact.discord.value) {
    contacts.discord = json.contact.discord.value;
  }

  const activeProjects = (json.active_projects || []).map((p) => ({
    name: p.name,
    description: p.description || "",
    repoUrl: p.repo_url || undefined,
    liveUrl: p.live_url || undefined,
    techStack: p.tech_stack || [],
  }));

  // Generate plain-text crawler markdown
  const markdownText = `# ${json.identity.name || cleanUsername} (@${json.identity.handle || cleanUsername})
> ${json.identity.headline || "Full-Stack Builder & Vibecoder"}

${json.identity.bio || ""}

${json.identity.location ? `- **Location**: ${json.identity.location}` : ""}
${json.identity.timezone ? `- **Timezone**: ${json.identity.timezone}` : ""}

## Active Projects
${activeProjects
  .map(
    (p) =>
      `### ${p.name}\n${p.description}\n- Tech Stack: ${p.techStack.join(", ")}${
        p.liveUrl ? `\n- Live: ${p.liveUrl}` : ""
      }${p.repoUrl ? `\n- Repo: ${p.repoUrl}` : ""}`
  )
  .join("\n\n")}

## Primary Technical Stack
- Languages: ${(json.technical_profile.primary_languages || []).join(", ")}
- Frameworks: ${(json.technical_profile.frameworks || []).join(", ")}
- Databases: ${(json.technical_profile.databases || []).join(", ")}
- Tools: ${(json.technical_profile.tools || []).join(", ")}

## Public Profiles
${Object.entries(contacts)
  .map(([k, v]) => `- **${k}**: ${v}`)
  .join("\n")}
`;

  return {
    found: true,
    isPublic: true,
    handle: json.identity.handle || cleanUsername,
    name: json.identity.name || match.userName || cleanUsername,
    avatar: json.identity.avatar || match.userImage || "",
    headline: json.identity.headline || "Software Builder & Agent Vibecoder",
    bio: json.identity.bio || "",
    location: json.identity.location,
    timezone: json.identity.timezone,
    contacts,
    technicalProfile: {
      languages: json.technical_profile.primary_languages || [],
      frameworks: json.technical_profile.frameworks || [],
      databases: json.technical_profile.databases || [],
      tools: json.technical_profile.tools || [],
    },
    activeProjects,
    bioVariants: {
      github: json.bio_variants.github || "",
      twitter: json.bio_variants.twitter || "",
      linkedin: json.bio_variants.linkedin || "",
      short: json.bio_variants.short || "",
    },
    rawMarkdown: wrapInSafetyEnvelope(markdownText),
  };
}
