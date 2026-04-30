import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "CapyRun API",
      version: "0.1.0",
      description: "Internal API for CapyRun web and future mobile clients.",
    },
    servers: [
      {
        url: "https://www.capyrun.com",
        description: "Production",
      },
      {
        url: "http://localhost:3000",
        description: "Local development",
      },
    ],
    tags: [
      {
        name: "Coach",
        description: "AI coach, messages and unread counters",
      },
    ],
    paths: {
      "/api/coach/unread-count": {
        get: {
          tags: ["Coach"],
          summary: "Get global unread coach message count",
          description:
            "Returns the number of unread coach messages for the current authenticated user.",
          operationId: "getCoachUnreadCount",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Unread count returned successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["count"],
                    properties: {
                      count: {
                        type: "integer",
                        example: 0,
                      },
                    },
                  },
                  examples: {
                    success: {
                      value: {
                        count: 3,
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "User is not authenticated",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                  examples: {
                    unauthorized: {
                      value: {
                        error: "Unauthorized",
                      },
                    },
                  },
                },
              },
            },
            "500": {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                  examples: {
                    serverError: {
                      value: {
                        error: "Database error",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "sb-access-token",
          description:
            "Supabase auth cookie. Web client sends it automatically with credentials: include.",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "For future mobile clients.",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "string",
              example: "Unauthorized",
            },
          },
        },
      },
    },
  });
}