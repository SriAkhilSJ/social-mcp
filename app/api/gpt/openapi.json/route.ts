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
      title: "OpenPost Autonomous Social Media Agent",
      description:
        "OpenPost AI Channel Manager. Natively understands the user in normal chat about any topic. Creates post drafts (action=draft_content), inspects live channel analytics and views (action=analytics), checks drafts (action=list_drafts), generates visual media (action=generate_media), and safely publishes (action=publish_post, confirmed=true) after user approval.",
      version: "2.0.0",
    },
    servers: [
      {
        url: serverUrl,
        description: "OpenPost Production Cloud Server",
      },
    ],
    paths: {
      "/api/gpt/actions": {
        get: {
          operationId: "getActionsOrData",
          summary: "Inspect channel analytics, pending drafts, or server health",
          description:
            "Call this whenever the user asks about performance, views, stats, or wants to see their pending drafts and queue.",
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
              description:
                "Action to perform: 'analytics' for view counts & metrics, 'list_drafts' to view pending review items, 'status' for system health.",
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
          summary: "Create drafts, generate visual media, or safely publish posts",
          description:
            "Call this whenever the user wants to prepare a post (action=draft_content), attach visuals (action=generate_media), publish to their channel (action=publish_post with confirmed=true), or delete/clear drafts (action=delete_post).",
          parameters: [
            {
              name: "action",
              in: "query",
              required: true,
              schema: {
                type: "string",
                enum: ["draft_content", "generate_media", "publish_post", "delete_post"],
              },
              description:
                "Action: 'draft_content' to create a post draft, 'generate_media' to attach visual assets, 'publish_post' to publish to connected channels, 'delete_post' to delete a post or clear all drafts.",
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
                      description: "Title, topic, or headline of the social post.",
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
                      description: "Post ID to publish or delete.",
                    },
                    all: {
                      type: "boolean",
                      description: "When action=delete_post, set true to clear all pending drafts.",
                    },
                    confirmed: {
                      type: "boolean",
                      description:
                        "HUMAN-IN-THE-LOOP SAFETY: Must be explicitly true to publish. Only set true when the user clearly approved publishing.",
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
              description: "Blocked by Human-in-the-Loop protection when confirmed is false.",
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
