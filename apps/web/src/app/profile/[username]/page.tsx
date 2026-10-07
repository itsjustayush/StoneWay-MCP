import { notFound } from "next/navigation";
import { getPublicProfileByUsername } from "@/lib/public-profile";
import Link from "next/link";
import {
  Globe,
  Github,
  Twitter,
  Linkedin,
  MapPin,
  Clock,
  Terminal,
  ExternalLink,
  Code2,
  Copy,
  Lock,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const cleanUsername = username.replace(/^@/, "");
  const profile = await getPublicProfileByUsername(cleanUsername);

  if (!profile || !profile.found) {
    notFound();
  }

  if (!profile.isPublic) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 bg-neutral-900 border border-neutral-800 rounded-full flex items-center justify-center mx-auto text-neutral-400">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold text-white">This Profile is Private</h1>
        <p className="text-xs text-neutral-400 leading-relaxed">
          @{profile.handle} has not enabled public sharing for their StoneWay profile.
        </p>
        <div className="pt-4">
          <Link
            href="/login"
            className="text-xs bg-white text-black px-4 py-2 rounded font-bold hover:bg-neutral-200 transition"
          >
            Claim or Manage Your Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-10 text-xs">
      {/* Profile Header */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-16 h-16 rounded-full border border-neutral-700 object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-lg text-white">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-white">{profile.name}</h1>
              <div className="text-neutral-500 font-mono text-xs">@{profile.handle}</div>
              <p className="text-neutral-300 text-xs mt-1">{profile.headline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/@${profile.handle}/raw`}
              target="_blank"
              className="flex items-center gap-1.5 border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 px-3 py-1.5 rounded transition text-xs font-mono"
              title="View clean text/markdown representation for AI agents"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Raw Agent View</span>
            </Link>
          </div>
        </div>

        {profile.bio && (
          <p className="text-neutral-300 text-xs leading-relaxed border-t border-neutral-900 pt-4">
            {profile.bio}
          </p>
        )}

        {/* Location & Links Bar */}
        <div className="flex flex-wrap items-center gap-4 text-neutral-400 text-xs pt-2">
          {profile.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-neutral-500" />
              <span>{profile.location}</span>
            </div>
          )}
          {profile.timezone && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              <span>{profile.timezone}</span>
            </div>
          )}
          {profile.contacts.github && (
            <a
              href={
                profile.contacts.github.startsWith("http")
                  ? profile.contacts.github
                  : `https://github.com/${profile.contacts.github}`
              }
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-neutral-300 hover:text-white transition"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          )}
          {profile.contacts.twitter && (
            <a
              href={
                profile.contacts.twitter.startsWith("http")
                  ? profile.contacts.twitter
                  : `https://x.com/${profile.contacts.twitter.replace("@", "")}`
              }
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-neutral-300 hover:text-white transition"
            >
              <Twitter className="w-3.5 h-3.5" />
              <span>Twitter / X</span>
            </a>
          )}
          {profile.contacts.website && (
            <a
              href={
                profile.contacts.website.startsWith("http")
                  ? profile.contacts.website
                  : `https://${profile.contacts.website}`
              }
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-neutral-300 hover:text-white transition"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Website</span>
            </a>
          )}
        </div>
      </div>

      {/* Active Projects */}
      {profile.activeProjects.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Active Projects & Work
            </h2>
            <span className="text-neutral-500 text-[11px] font-mono">
              {profile.activeProjects.length} projects
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.activeProjects.map((project, idx) => (
              <div
                key={idx}
                className="bg-neutral-950 border border-neutral-900 hover:border-neutral-800 transition p-4 rounded-lg flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{project.name}</span>
                    <div className="flex items-center gap-2">
                      {project.liveUrl && (
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neutral-400 hover:text-white transition"
                          title="Open live app"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {project.repoUrl && (
                        <a
                          href={project.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neutral-400 hover:text-white transition"
                          title="Open source code"
                        >
                          <Github className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-neutral-400 text-xs mt-1 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                </div>

                {project.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-neutral-900">
                    {project.techStack.map((tech, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded font-mono"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tech Stack */}
      <section className="space-y-4">
        <div className="border-b border-neutral-900 pb-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Technical Stack & Preferences
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profile.technicalProfile.languages.length > 0 && (
            <div className="bg-neutral-950 border border-neutral-900 p-4 rounded-lg space-y-2">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Languages
              </span>
              <div className="flex flex-wrap gap-1.5">
                {profile.technicalProfile.languages.map((l, i) => (
                  <span
                    key={i}
                    className="text-xs bg-neutral-900 text-neutral-200 px-2 py-0.5 rounded border border-neutral-800 font-mono"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.technicalProfile.frameworks.length > 0 && (
            <div className="bg-neutral-950 border border-neutral-900 p-4 rounded-lg space-y-2">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Frameworks & Libraries
              </span>
              <div className="flex flex-wrap gap-1.5">
                {profile.technicalProfile.frameworks.map((f, i) => (
                  <span
                    key={i}
                    className="text-xs bg-neutral-900 text-neutral-200 px-2 py-0.5 rounded border border-neutral-800 font-mono"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Agent Connect CTA Banner */}
      <div className="bg-neutral-950 border border-neutral-800 p-5 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="font-bold text-white text-xs">
            Want to use @{profile.handle}&apos;s verified context in your AI agent?
          </div>
          <div className="text-neutral-500 text-[11px]">
            AI agents can consume this profile directly via StoneWay Model Context Protocol.
          </div>
        </div>
        <Link
          href="/docs"
          className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded hover:bg-neutral-200 transition shrink-0"
        >
          Setup MCP Client
        </Link>
      </div>
    </div>
  );
}
