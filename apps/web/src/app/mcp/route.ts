import { handleMcpHttpRequest } from "@/lib/mcp-http-handler";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleMcpHttpRequest(req);
}

export async function POST(req: Request) {
  return handleMcpHttpRequest(req);
}
