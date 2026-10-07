import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, schema, hashApiKey, generateApiKey, encryptConfig, decryptConfig } from "@stoneway/database";
import { eq, and, isNull } from "drizzle-orm";
import { getOrCreateProfile } from "@/lib/server-utils";
import { DecryptedConfig } from "@stoneway/shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const shouldReveal = searchParams.get("reveal") === "true";

  const profile = await getOrCreateProfile(session.user.id);
  const [activeKey] = await db
    .select()
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.userId, session.user.id), isNull(schema.apiKeys.revokedAt)))
    .limit(1);

  let rawToken: string | null = null;
  if (shouldReveal && profile.stonewayConfig) {
    try {
      const decrypted = decryptConfig<DecryptedConfig>(profile.stonewayConfig);
      rawToken = decrypted.stoneway_api_key;
    } catch {
      rawToken = null;
    }
  }

  return NextResponse.json({
    has_active_key: !!activeKey,
    key_id: activeKey?.id,
    created_at: activeKey?.createdAt,
    last_used_at: activeKey?.lastUsedAt,
    token: rawToken,
  });
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getOrCreateProfile(session.user.id);

  // 1. Revoke existing active key
  await db
    .update(schema.apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.apiKeys.userId, session.user.id), isNull(schema.apiKeys.revokedAt)));

  // 2. Generate new key
  const newRawKey = generateApiKey();
  const newHash = hashApiKey(newRawKey);

  await db.insert(schema.apiKeys).values({
    userId: session.user.id,
    keyHash: newHash,
    keyPrefix: "sw_",
    name: "Unified Agent Key",
  });

  // 3. Atomically update encrypted StoneWayConfig
  let currentDecrypted: DecryptedConfig = { stoneway_api_key: newRawKey, integrations: {} };
  try {
    currentDecrypted = decryptConfig<DecryptedConfig>(profile.stonewayConfig);
    currentDecrypted.stoneway_api_key = newRawKey;
  } catch {
    // fallback to clean template if corrupt
  }

  const newEnvelope = encryptConfig(currentDecrypted);
  await db
    .update(schema.profiles)
    .set({ stonewayConfig: newEnvelope, updatedAt: new Date() })
    .where(eq(schema.profiles.id, profile.id));

  return NextResponse.json({
    success: true,
    token: newRawKey,
    created_at: new Date().toISOString(),
  });
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(schema.apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.apiKeys.userId, session.user.id), isNull(schema.apiKeys.revokedAt)));

  return NextResponse.json({ success: true, message: "Token revoked successfully." });
}
