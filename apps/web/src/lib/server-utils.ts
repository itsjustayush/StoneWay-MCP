import { db, schema, hashApiKey, generateApiKey, encryptConfig } from "@stoneway/database";
import { eq, and, isNull } from "drizzle-orm";
import {
  StoneWayJson,
  StoneWayJsonSchema,
  STARTER_STONEWAY_MD,
  UnstructuredMetadata,
} from "@stoneway/shared";

export interface AuthContext {
  userId: string;
  keyId: string;
}

/**
 * Authenticates incoming REST API requests using high-performance SHA-256 hash lookup.
 */
export async function authenticateBearerToken(
  req: Request
): Promise<{ success: true; context: AuthContext } | { success: false; status: number; error: string }> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      status: 401,
      error: "Missing or malformed Authorization header. Expected 'Bearer sw_...'",
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token.startsWith("sw_")) {
    return {
      success: false,
      status: 401,
      error: "Invalid API token format. StoneWay keys begin with 'sw_'",
    };
  }

  const keyHash = hashApiKey(token);

  // Look up active key in database
  const [activeKey] = await db
    .select()
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.keyHash, keyHash), isNull(schema.apiKeys.revokedAt)))
    .limit(1);

  if (!activeKey) {
    return {
      success: false,
      status: 401,
      error: "Invalid or revoked API key. Please check or regenerate your token in the dashboard.",
    };
  }

  // Update last_used_at in background without blocking hot path
  db.update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, activeKey.id))
    .catch(() => {});

  return {
    success: true,
    context: {
      userId: activeKey.userId,
      keyId: activeKey.id,
    },
  };
}

/**
 * Retrieves the user profile or provisions a new one with starter data and initial key.
 */
export async function getOrCreateProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);

  if (existing) {
    return existing;
  }

  // Generate initial key and encrypt it into StoneWayConfig
  const initialRawKey = generateApiKey();
  const keyHash = hashApiKey(initialRawKey);

  const encryptedConfig = encryptConfig({
    stoneway_api_key: initialRawKey,
    integrations: {},
  });

  // Create initial API key record
  await db.insert(schema.apiKeys).values({
    userId,
    keyHash,
    keyPrefix: "sw_",
    name: "Primary Agent Key",
  });

  const defaultJson: StoneWayJson = StoneWayJsonSchema.parse({
    meta: {
      version: 1,
      last_reconciled_md_version: 1,
      updated_at: new Date().toISOString(),
    },
  });

  // Provision profile
  const [newProfile] = await db
    .insert(schema.profiles)
    .values({
      userId,
      stonewayMd: STARTER_STONEWAY_MD,
      stonewayJson: defaultJson,
      stonewayConfig: encryptedConfig,
      version: 1,
    })
    .returning();

  // Record initial revision
  await db.insert(schema.revisions).values({
    userId,
    version: 1,
    fileType: "md",
    content: STARTER_STONEWAY_MD,
    agentLabel: "system_init",
  });

  return newProfile;
}

/**
 * Reconciles structural updates and appends notes with zero-data-loss invariant.
 */
export async function reconcileProfile(
  profile: typeof schema.profiles.$inferSelect,
  options: {
    baseVersion: number;
    jsonPatch?: Record<string, any>;
    mdAppend?: string;
    mdReplace?: string;
    agentName?: string;
  }
) {
  // 1. Optimistic Locking Check
  if (options.baseVersion !== profile.version) {
    throw new Error(
      `Version conflict: Base version ${options.baseVersion} does not match current version ${profile.version}. Fetch latest context and retry.`
    );
  }

  const currentJson = StoneWayJsonSchema.parse(profile.stonewayJson);
  let newMd = profile.stonewayMd;
  let unstructuredSavedCount = 0;

  // 2. Handle Markdown Changes
  if (options.mdReplace !== undefined) {
    newMd = options.mdReplace;
  } else if (options.mdAppend) {
    const timestamp = new Date().toISOString();
    const agentHeader = options.agentName ? `[${options.agentName}]` : "[agent]";
    newMd = `${newMd.trimEnd()}\n\n<!-- Log ${timestamp} ${agentHeader} -->\n${options.mdAppend.trim()}`;
  }

  // 3. Handle JSON Patch with Zero-Data-Loss Invariant
  if (options.jsonPatch && Object.keys(options.jsonPatch).length > 0) {
    const knownKeys = [
      "identity",
      "contact",
      "technical_profile",
      "active_projects",
      "past_projects",
      "planned_ideas",
      "frequent_prompts",
      "preferences",
      "bio_variants",
    ];

    for (const [key, value] of Object.entries(options.jsonPatch)) {
      if (knownKeys.includes(key)) {
        if (Array.isArray(value)) {
          // Merge arrays (e.g. active_projects) by unique identity or append
          (currentJson as any)[key] = value;
        } else if (typeof value === "object" && value !== null) {
          (currentJson as any)[key] = {
            ...((currentJson as any)[key] || {}),
            ...value,
          };
        } else {
          (currentJson as any)[key] = value;
        }
      } else {
        // Unknown field -> Capture into unstructured_metadata[] instead of discarding
        const overflowItem: UnstructuredMetadata = {
          content: { [key]: value },
          source_agent: options.agentName || "unknown",
          timestamp: new Date().toISOString(),
          tag: "unstructured_overflow",
        };
        currentJson.unstructured_metadata.push(overflowItem);
        unstructuredSavedCount++;
      }
    }
  }

  const nextVersion = profile.version + 1;
  currentJson.meta.version = nextVersion;
  currentJson.meta.last_reconciled_md_version = nextVersion;
  currentJson.meta.updated_at = new Date().toISOString();

  // Validate resulting JSON structure
  const validatedJson = StoneWayJsonSchema.parse(currentJson);

  // 4. Update Database
  const [updated] = await db
    .update(schema.profiles)
    .set({
      stonewayMd: newMd,
      stonewayJson: validatedJson,
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.profiles.id, profile.id), eq(schema.profiles.version, profile.version)))
    .returning();

  // 5. Append Revisions
  await db.insert(schema.revisions).values({
    userId: profile.userId,
    version: nextVersion,
    fileType: options.mdAppend || options.mdReplace ? "md" : "json",
    content: options.mdAppend || options.mdReplace ? newMd : JSON.stringify(validatedJson),
    agentLabel: options.agentName || "agent",
  });

  return {
    updatedProfile: updated,
    unstructuredCount: unstructuredSavedCount,
  };
}
