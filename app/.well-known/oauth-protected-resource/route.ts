import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    {
      resource: "https://social-mcp-agent.onrender.com/mcp",
      authorization_servers: ["https://social-mcp-agent.onrender.com"],
      scopes_supported: ["mcp:read", "mcp:full"],
      bearer_methods_supported: ["header"],
    },
    { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" } }
  );
}
