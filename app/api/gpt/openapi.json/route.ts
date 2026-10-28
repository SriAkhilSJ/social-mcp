import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  const serverUrl = `${proto}://${host}`;

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "OpenPost Social Media Controller API",
      description:
        "ChatGPT Action API for managing social media campaigns, creating viral anime video drafts, and publishing with human-in-the-loop protection.",
      version: "1.0.0",
    },
    servers: [
      {
        url: serverUrl,
        description: "OpenPost Host Server",
      },
    ],
    paths: {
      "/api/gpt/actions": {
        get: {
          operationId: "getActionsOrData",
          summary: "Inspect drafts, social analytics, or system health",
          parameters: [
            {
              name: "action",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["status", "list_drafts", "analytics"],
                default: "status",
              },
              description: "Action to perform: 'list_drafts' to view pending review items, 'analytics' for metrics, 'status' for health.",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                default: 10,
              },
              description: "Maximum number of drafts to return.",
            },
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: "executeAction",
          summary: "Create drafts, generate video media, or safely publish posts",
          parameters: [
            {
              name: "action",
              in: "query",
              required: true,
              schema: {
                type: "string",
                enum: ["draft_content", "generate_media", "publish_post"],
              },
              description: "Action: 'draft_content' to create a post draft, 'generate_media' to create visual video asset, 'publish_post' to publish.",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "Title or topic of the social post.",
                    },
                    caption: {
                      type: "string",
                      description: "The caption, hook, and body text for the post.",
                    },
                    platform: {
                      type: "string",
                      enum: ["facebook", "instagram", "tiktok", "youtube"],
                      description: "Social media platform to target.",
                    },
                    prompt: {
                      type: "string",
                      description: "Visual or video generation prompt (for generate_media).",
                    },
                    draftId: {
                      type: "integer",
                      description: "Draft post ID to attach media to.",
                    },
                    postId: {
                      type: "integer",
                      description: "Post ID to publish (for publish_post).",
                    },
                    confirmed: {
                      type: "boolean",
                      description:
                        "CRITICAL HUMAN CONFIRMATION: Must be explicitly true to publish. If false or omitted, publishing is blocked by the human-in-the-loop lock.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Action executed successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
            "403": {
              description: "Blocked by Human-in-the-Loop protection when confirmed is not true.",
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
