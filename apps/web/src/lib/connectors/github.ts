import { Connector, ConnectorSyncResult, DecryptedConfig } from "@stoneway/shared";

export const githubConnector: Connector = {
  id: "github",
  name: "GitHub Public Profile & Repos",
  async sync(username: string, config: DecryptedConfig): Promise<ConnectorSyncResult> {
    const timestamp = new Date().toISOString();
    try {
      const headers: Record<string, string> = {
        "User-Agent": "StoneWay-MCP-Sync/1.0",
        Accept: "application/vnd.github.v3+json",
      };

      if (config.integrations?.github_pat) {
        headers["Authorization"] = `token ${config.integrations.github_pat}`;
      }

      // Fetch user repos sorted by updated
      const res = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=10`,
        { headers }
      );

      if (!res.ok) {
        return {
          connector_id: "github",
          success: false,
          message: `GitHub API error: HTTP ${res.status}`,
          timestamp,
          error: await res.text(),
        };
      }

      const repos = await res.json();
      const languages = new Set<string>();
      const activeProjects = (repos || []).map((repo: any) => {
        if (repo.language) languages.add(repo.language);
        return {
          name: repo.name,
          description: repo.description || "",
          repo_url: repo.html_url,
          live_url: repo.homepage || undefined,
          tech_stack: repo.language ? [repo.language] : [],
          status: "active",
          last_updated: repo.updated_at,
        };
      });

      return {
        connector_id: "github",
        success: true,
        message: `Successfully synced ${activeProjects.length} repositories from GitHub.`,
        timestamp,
        extracted_data: {
          active_projects: activeProjects,
          primary_languages: Array.from(languages),
        },
      };
    } catch (err: any) {
      return {
        connector_id: "github",
        success: false,
        message: "Failed to connect to GitHub API",
        timestamp,
        error: err.message,
      };
    }
  },
};
