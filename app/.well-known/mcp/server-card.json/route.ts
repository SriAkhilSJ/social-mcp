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
      $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
      name: "getopenpost/openpost",
      title: "OpenPost Social Media MCP Server",
      description:
        "Create, schedule, publish, and inspect social content through OpenPost with Human-in-the-Loop protection.",
      websiteUrl: "https://social-mcp-agent.onrender.com",
      repository: {
        url: "https://github.com/SriAkhilSJ/social-mcp",
        source: "github",
      },
      remotes: [
        {
          type: "streamable-http",
          supportedProtocolVersions: ["2025-06-18", "2025-03-26"],
        },
      ],
    },
    { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" } }
  );
}
