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
      {
        name: "Profile",
        description: "Current user profile and avatar",
      },
      {
        name: "Onboarding",
        description: "User onboarding steps and completion",
      },
      {
        name: "Goals",
        description: "Training goals and onboarding goal setup",
      },
      {
        name: "Auth",
        description: "Authentication and session management",
      },
    ],
    paths: {
      "/api/onboarding/profile": {
        patch: {
          tags: ["Onboarding"],
          summary: "Save onboarding profile step",
          operationId: "saveOnboardingProfile",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    display_name: { type: "string", nullable: true },
                    avatar_url: { type: "string", nullable: true },
                    sex: {
                      type: "string",
                      nullable: true,
                      enum: ["male", "female", "other", null],
                    },
                    birth_date: {
                      type: "string",
                      nullable: true,
                      example: "1990-01-01",
                    },
                    height_cm: {
                      type: "number",
                      nullable: true,
                      example: 183,
                    },
                    weight_kg: {
                      type: "number",
                      nullable: true,
                      example: 78,
                    },
                    country_code: {
                      type: "string",
                      nullable: true,
                      example: "RU",
                    },
                    city: {
                      type: "string",
                      nullable: true,
                      example: "Москва",
                    },
                    timezone: {
                      type: "string",
                      nullable: true,
                      example: "Europe/Moscow",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Onboarding profile step saved",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      profile: { $ref: "#/components/schemas/Profile" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/api/onboarding/import": {
        post: {
          tags: ["Onboarding"],
          summary: "Finish onboarding import step",
          operationId: "finishOnboardingImport",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["choice"],
                  properties: {
                    choice: {
                      type: "string",
                      enum: ["strava", "upload", "manual", "skipped"],
                      example: "skipped",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Onboarding import step finished",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      profile: { $ref: "#/components/schemas/Profile" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid import choice",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/api/onboarding/skip": {
        post: {
          tags: ["Onboarding"],
          summary: "Skip onboarding",
          operationId: "skipOnboarding",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Onboarding skipped",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      profile: { $ref: "#/components/schemas/Profile" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/api/goals/onboarding": {
        post: {
          tags: ["Goals", "Onboarding"],
          summary: "Save onboarding goal step",
          operationId: "saveOnboardingGoal",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["goal"],
                  properties: {
                    mode: {
                      type: "string",
                      enum: ["initial", "add-more", "onboarding"],
                      example: "onboarding",
                    },
                    editGoalId: {
                      type: "string",
                      nullable: true,
                    },
                    profile: {
                      type: "object",
                      properties: {
                        sex: { type: "string", nullable: true },
                        birth_date: { type: "string", nullable: true },
                        height_cm: { type: "number", nullable: true },
                        weight_kg: { type: "number", nullable: true },
                      },
                    },
                    goal: {
                      type: "object",
                      required: ["title", "date_to"],
                      properties: {
                        title: { type: "string", example: "Пробежать 10 км уверенно" },
                        type: { type: "string", example: "10k" },
                        sport: { type: "string", nullable: true, example: "run" },
                        date_from: { type: "string", example: "2026-04-30" },
                        date_to: { type: "string", example: "2026-07-30" },
                        target_json: {
                          type: "object",
                          additionalProperties: true,
                        },
                        notes: {
                          type: "string",
                          nullable: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Goal saved",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      goal: { $ref: "#/components/schemas/Goal" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout current user",
          description:
            "Signs out the current user and clears the server-managed Supabase session cookies.",
          operationId: "logoutCurrentUser",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Logged out successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ok"],
                    properties: {
                      ok: {
                        type: "boolean",
                        example: true,
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
                },
              },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login with email and password",
          operationId: "loginWithPassword",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: {
                      type: "string",
                      format: "email",
                      example: "user@example.com",
                    },
                    password: {
                      type: "string",
                      format: "password",
                      example: "password123",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Logged in successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/AuthUser" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Missing email or password",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/api/auth/signup": {
        post: {
          tags: ["Auth"],
          summary: "Sign up with email and password",
          operationId: "signUpWithPassword",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: {
                      type: "string",
                      format: "email",
                      example: "new-user@example.com",
                    },
                    password: {
                      type: "string",
                      format: "password",
                      example: "password123",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "User registered or confirmation email sent",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/AuthUser" },
                      needsEmailConfirmation: {
                        type: "boolean",
                        example: true,
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid signup request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/auth/reset-password": {
        post: {
          tags: ["Auth"],
          summary: "Request password reset email",
          operationId: "requestPasswordReset",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: {
                    email: {
                      type: "string",
                      format: "email",
                      example: "user@example.com",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Reset email sent",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/api/auth/reset-password/confirm": {
        post: {
          tags: ["Auth"],
          summary: "Confirm password reset with token",
          operationId: "confirmPasswordReset",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["tokenHash", "password"],
                  properties: {
                    tokenHash: {
                      type: "string",
                      example: "abc123token",
                    },
                    type: {
                      type: "string",
                      enum: ["recovery"],
                      example: "recovery",
                    },
                    password: {
                      type: "string",
                      format: "password",
                      example: "newPassword123",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Password updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid token or password",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/auth/session": {
        get: {
          tags: ["Auth"],
          summary: "Get current session",
          operationId: "getSession",
          responses: {
            "200": {
              description: "Current session",
            },
          },
        },
      },

      "/api/profile/me": {
        get: {
          tags: ["Profile"],
          summary: "Get current user profile",
          operationId: "getCurrentProfile",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            "200": {
              description: "Current user and profile",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["user", "profile"],
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          email: { type: "string", nullable: true },
                        },
                      },
                      profile: {
                        $ref: "#/components/schemas/Profile",
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
        patch: {
          tags: ["Profile"],
          summary: "Update current user profile",
          operationId: "updateCurrentProfile",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    display_name: { type: "string", nullable: true },
                    avatar_url: { type: "string", nullable: true },
                    locale: { type: "string", nullable: true },
                    timezone: { type: "string", nullable: true },
                    country: { type: "string", nullable: true },
                    city: { type: "string", nullable: true },
                    unit_system: { type: "string", nullable: true },
                    username: { type: "string", nullable: true },
                    bio: { type: "string", nullable: true },
                    gender: { type: "string", nullable: true },
                    birth_date: { type: "string", nullable: true },
                    height_cm: { type: "number", nullable: true },
                    weight_kg: { type: "number", nullable: true },
                    default_workout_privacy: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated profile",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      profile: { $ref: "#/components/schemas/Profile" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

      "/api/profile/avatar": {
        post: {
          tags: ["Profile"],
          summary: "Upload current user avatar",
          operationId: "uploadCurrentUserAvatar",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: {
                      type: "string",
                      format: "binary",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Avatar uploaded",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      avatarUrl: { type: "string" },
                      profile: { $ref: "#/components/schemas/Profile" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/coach/send": {
        post: {
          tags: ["Coach"],
          summary: "Send message to AI coach",
          description:
            "Sends a user message to the AI coach, resolves or creates a coach thread, saves the user message, generates a coach response, and returns both messages.",
          operationId: "sendCoachMessage",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description: "User message text. Preferred field.",
                      example: "Разбери мою последнюю тренировку",
                    },
                    message: {
                      type: "string",
                      description: "Alternative message field. Used if text is empty.",
                      example: "Составь план на неделю",
                    },
                    threadId: {
                      type: "string",
                      nullable: true,
                      description:
                        "Existing coach thread id. If omitted or invalid, the API resolves or creates a general thread.",
                      example: "2f5c1f7e-7e28-4e52-b4a7-0a3dd4f2f1c2",
                    },
                    locale: {
                      type: "string",
                      description: "Response locale.",
                      default: "ru",
                      example: "ru",
                    },
                    timezone: {
                      type: "string",
                      description: "User timezone.",
                      default: "Europe/Berlin",
                      example: "Europe/Berlin",
                    },
                    client_nonce: {
                      type: "string",
                      nullable: true,
                      description:
                        "Optional client-generated nonce for deduplication/debugging.",
                      example: "web-1714480000000-abc123",
                    },
                    action: {
                      type: "string",
                      nullable: true,
                      description:
                        "Optional action for plan confirmation flows, for example confirm/cancel intent.",
                      example: "confirm_plan",
                    },
                  },
                  anyOf: [{ required: ["text"] }, { required: ["message"] }],
                },
                examples: {
                  analyzeLastWorkout: {
                    summary: "Analyze last workout",
                    value: {
                      text: "Разбери мою последнюю тренировку",
                      locale: "ru",
                      timezone: "Europe/Berlin",
                    },
                  },
                  sendToExistingThread: {
                    summary: "Send to existing thread",
                    value: {
                      text: "А какой пульс держать на лёгком беге?",
                      threadId: "2f5c1f7e-7e28-4e52-b4a7-0a3dd4f2f1c2",
                      locale: "ru",
                      timezone: "Europe/Berlin",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Coach response generated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["threadId", "userMessage", "coachMessage"],
                    properties: {
                      threadId: {
                        type: "string",
                        example: "2f5c1f7e-7e28-4e52-b4a7-0a3dd4f2f1c2",
                      },
                      userMessage: {
                        $ref: "#/components/schemas/CoachMessage",
                      },
                      coachMessage: {
                        $ref: "#/components/schemas/CoachMessage",
                      },
                    },
                  },
                  examples: {
                    success: {
                      value: {
                        threadId: "2f5c1f7e-7e28-4e52-b4a7-0a3dd4f2f1c2",
                        userMessage: {
                          id: "91b6c3c7-7d11-45f5-92f8-f5e2c97a7f4f",
                          thread_id: "2f5c1f7e-7e28-4e52-b4a7-0a3dd4f2f1c2",
                          author_id: "user-id",
                          type: "user",
                          body: "Разбери мою последнюю тренировку",
                          meta: null,
                          created_at: "2026-04-30T11:30:00.000Z",
                        },
                        coachMessage: {
                          id: "b2df6938-4a3e-4e63-aab8-3f57f3d2ef76",
                          thread_id: "2f5c1f7e-7e28-4e52-b4a7-0a3dd4f2f1c2",
                          author_id: "user-id",
                          type: "coach",
                          body: "## Кратко\\nТренировка получилась...",
                          meta: {
                            model: "gpt-4o-mini",
                            stage: "answer",
                            reply_to: "91b6c3c7-7d11-45f5-92f8-f5e2c97a7f4f",
                          },
                          created_at: "2026-04-30T11:30:05.000Z",
                        },
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
                        error: "unauthorized",
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
                    internalError: {
                      value: {
                        error: "internal_error",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/coach/messages": {
        get: {
          tags: ["Coach"],
          summary: "Get messages for thread",
          operationId: "getCoachMessages",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "threadId",
              in: "query",
              required: true,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Messages list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      messages: {
                        type: "array",
                        items: {
                          type: "object",
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/coach/mark-read": {
        post: {
          tags: ["Coach"],
          summary: "Mark coach thread as read",
          operationId: "markCoachThreadRead",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["threadId"],
                  properties: {
                    threadId: {
                      type: "string",
                      example: "thread_123",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Marked as read",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
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
        Goal: {
          type: "object",
          additionalProperties: true,
          properties: {
            id: { type: "string" },
            user_id: { type: "string" },
            title: { type: "string", nullable: true },
            type: { type: "string", nullable: true },
            sport: { type: "string", nullable: true },
            date_from: { type: "string", nullable: true },
            date_to: { type: "string", nullable: true },
            status: { type: "string", nullable: true },
            target_json: {
              type: "object",
              nullable: true,
              additionalProperties: true,
            },
            notes: { type: "string", nullable: true },
            created_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            updated_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
          },
        },

        AuthUser: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string" },
            email: { type: "string", nullable: true },
          },
        },
        Profile: {
          type: "object",
          nullable: true,
          additionalProperties: true,
          properties: {
            id: { type: "string" },
            display_name: { type: "string", nullable: true },
            avatar_url: { type: "string", nullable: true },
            locale: { type: "string", nullable: true },
            timezone: { type: "string", nullable: true },
            country: { type: "string", nullable: true },
            city: { type: "string", nullable: true },
            unit_system: { type: "string", nullable: true },
            username: { type: "string", nullable: true },
            bio: { type: "string", nullable: true },
            gender: { type: "string", nullable: true },
            birth_date: { type: "string", nullable: true },
            height_cm: { type: "number", nullable: true },
            weight_kg: { type: "number", nullable: true },
            default_workout_privacy: { type: "string", nullable: true },
            created_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            updated_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
          },
        },
        CoachMessage: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "b2df6938-4a3e-4e63-aab8-3f57f3d2ef76",
            },
            thread_id: {
              type: "string",
              example: "2f5c1f7e-7e28-4e52-b4a7-0a3dd4f2f1c2",
            },
            author_id: {
              type: "string",
              example: "user-id",
            },
            type: {
              type: "string",
              enum: ["user", "coach", "system"],
              example: "coach",
            },
            body: {
              type: "string",
              example: "## Кратко\nТренировка получилась...",
            },
            meta: {
              type: "object",
              nullable: true,
              additionalProperties: true,
            },
            created_at: {
              type: "string",
              format: "date-time",
              example: "2026-04-30T11:30:05.000Z",
            },
          },
        },
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