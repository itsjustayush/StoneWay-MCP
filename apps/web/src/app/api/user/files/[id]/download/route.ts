import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, schema } from "@stoneway/database";
import { eq, and } from "drizzle-orm";
import { getStorageProvider } from "@/lib/storage/router";
import { StorageProviderType } from "@stoneway/shared";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Strict Tenant Isolation: verify file ownership
  const [file] = await db
    .select()
    .from(schema.contextFiles)
    .where(and(eq(schema.contextFiles.id, id), eq(schema.contextFiles.userId, session.user.id)))
    .limit(1);

  if (!file) {
    // Non-disclosing 404 response
    return new NextResponse("Not found", { status: 404 });
  }

  const provider = getStorageProvider(file.authoritativeProvider as StorageProviderType);

  if (provider.isAvailable()) {
    try {
      const result = await provider.download(file.objectKey);
      return new NextResponse(result.stream as any, {
        headers: {
          "Cache-Control": "private, no-cache",
          "Content-Type": result.contentType || file.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (err: any) {
      console.warn("Storage provider download failed, checking fallback content:", err?.message);
    }
  }

  // Fallback to extracted textual content if stored
  if (file.extractedText) {
    return new NextResponse(file.extractedText, {
      headers: {
        "Cache-Control": "private, no-cache",
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new NextResponse("File content currently unavailable", { status: 404 });
}
