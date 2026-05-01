// frontend/app/api/openapi/route.ts

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
        name: "Plan",
        description: "Training plan sessions and calendar items",
      },
      {
        name: "Workouts",
        description: "Workout CRUD, streams, GPS tracks and AI workout insights",
      },
      {
        name: "Dashboard",
        description: "Home dashboard analytics and widgets",
      },
      {
        name: "Integrations",
        description: "External integrations like Strava",
      },
      {
        name: "Workout files",
        description: "Uploaded workout source files and processing",
      },
      {
        name: "Auth",
        description: "Authentication and session management",
      },
    ],
    paths: {
      "/api/workout-files": {
        get: {
          tags: ["Workout files"],
          summary: "Get uploaded workout files",
          operationId: "getWorkoutFiles",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "workoutId",
              in: "query",
              required: false,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 200, example: 500 },
            },
          ],
          responses: {
            "200": {
              description: "Uploaded workout files",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: { $ref: "#/components/schemas/WorkoutFile" },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/workout-files/upload": {
        post: {
          tags: ["Workout files"],
          summary: "Upload workout file",
          operationId: "uploadWorkoutFile",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: { type: "string", format: "binary" },
                    workoutId: { type: "string", format: "uuid", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "File uploaded or duplicate detected",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/WorkoutFileUploadResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/workout-files/{id}": {
        delete: {
          tags: ["Workout files"],
          summary: "Delete uploaded workout file",
          operationId: "deleteWorkoutFile",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/WorkoutFileId" }],
          responses: {
            "200": {
              description: "Workout file deleted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/workout-files/{id}/process": {
        post: {
          tags: ["Workout files"],
          summary: "Start workout file processing",
          operationId: "processWorkoutFile",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/WorkoutFileId" }],
          responses: {
            "200": {
              description: "Processing started",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", example: true },
                      file: { $ref: "#/components/schemas/WorkoutFile" },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/integrations": {
        get: {
          tags: ["Integrations"],
          summary: "Get user integrations status",
          operationId: "getIntegrations",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "User integrations",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        $ref: "#/components/schemas/IntegrationsResponse",
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/profile/hr-zones": {
        patch: {
          tags: ["Profile"],
          summary: "Update current user's heart-rate zones",
          operationId: "updateProfileHrZones",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["hr_zones"],
                  properties: {
                    hr_zones: {
                      $ref: "#/components/schemas/HrZones",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Heart-rate zones updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      profile: {
                        type: "object",
                        properties: {
                          user_id: { type: "string" },
                          hr_zones: { $ref: "#/components/schemas/HrZones" },
                          updated_at: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid heart-rate zones payload",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/dashboard/fast-days": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard daily aggregates",
          operationId: "getDashboardFastDays",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "days",
              in: "query",
              required: false,
              schema: { type: "integer", default: 30, example: 30 },
            },
          ],
          responses: {
            "200": {
              description: "Daily dashboard aggregates",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/DashboardDayRow" },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/dashboard/fast-weeks": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard weekly aggregates",
          operationId: "getDashboardFastWeeks",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "weeks",
              in: "query",
              required: false,
              schema: { type: "integer", default: 12, example: 12 },
            },
          ],
          responses: {
            "200": {
              description: "Weekly dashboard aggregates",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/DashboardWeekRow" },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/dashboard/weekday": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard weekday distribution",
          operationId: "getDashboardWeekday",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "days",
              in: "query",
              required: false,
              schema: { type: "integer", default: 30, example: 30 },
            },
          ],
          responses: {
            "200": {
              description: "Weekday dashboard aggregates",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/DashboardWeekdayRow" },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/dashboard/sport-mix": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard sport mix",
          operationId: "getDashboardSportMix",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "days",
              in: "query",
              required: false,
              schema: { type: "integer", default: 30, example: 30 },
            },
          ],
          responses: {
            "200": {
              description: "Sport mix dashboard aggregates",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/DashboardSportMixRow" },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/dashboard/hr-zones": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard heart-rate zone rows",
          operationId: "getDashboardHrZones",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "days",
              in: "query",
              required: false,
              schema: { type: "integer", default: 30, example: 30 },
            },
          ],
          responses: {
            "200": {
              description: "Workout HR zone rows for selected period",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/DashboardHrZoneRow" },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/dashboard/next-planned": {
        get: {
          tags: ["Dashboard"],
          summary: "Get next planned workout",
          operationId: "getDashboardNextPlannedWorkout",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Next planned workout",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        oneOf: [
                          { $ref: "#/components/schemas/DashboardNextPlannedWorkout" },
                          { type: "null" },
                        ],
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/plan/sessions": {
        post: {
          tags: ["Plan"],
          summary: "Create manual planned workout",
          operationId: "createPlanSession",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["planned_date", "title", "sport"],
                  properties: {
                    planned_date: {
                      type: "string",
                      example: "2026-05-01",
                    },
                    title: {
                      type: "string",
                      example: "Лёгкий бег 40 минут",
                    },
                    sport: {
                      type: "string",
                      example: "run",
                    },
                    notes: {
                      type: "string",
                      nullable: true,
                      example: "10 минут разминки, затем лёгкий бег.",
                    },
                    effort: {
                      type: "string",
                      nullable: true,
                      example: "Легко",
                    },
                    hr_zones: {
                      type: "array",
                      items: { type: "string" },
                      example: ["Z2"],
                    },
                    duration_min: {
                      type: "number",
                      nullable: true,
                      example: 40,
                    },
                    distance_km: {
                      type: "number",
                      nullable: true,
                      example: 6,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Plan session created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      session: { $ref: "#/components/schemas/PlanSession" },
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

      "/api/plan/sessions/{id}": {
        delete: {
          tags: ["Plan"],
          summary: "Delete or cancel plan session",
          description:
            "Deletes manual planned workout sessions. For sessions that belong to an AI-generated plan, marks the session as canceled.",
          operationId: "deleteOrCancelPlanSession",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Plan session deleted or canceled",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: {
                        type: "boolean",
                        example: true,
                      },
                      action: {
                        type: "string",
                        enum: ["deleted", "canceled"],
                        example: "deleted",
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
            "404": {
              description: "Session not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },

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

      "/api/goals": {
        get: {
          tags: ["Goals"],
          summary: "Get current user's goals",
          operationId: "getGoals",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": {
              description: "Goals list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      goals: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Goal" },
                      },
                      completedNowIds: {
                        type: "array",
                        items: { type: "string" },
                      },
                      goalCompleted: { type: "boolean" },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Goals"],
          summary: "Create goal",
          operationId: "createGoal",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GoalInput" },
              },
            },
          },
          responses: {
            "201": {
              description: "Goal created",
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
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/goals/{id}": {
        patch: {
          tags: ["Goals"],
          summary: "Update goal",
          operationId: "updateGoal",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/GoalId" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GoalInput" },
              },
            },
          },
          responses: {
            "200": {
              description: "Goal updated",
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
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        delete: {
          tags: ["Goals"],
          summary: "Delete goal",
          operationId: "deleteGoal",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/GoalId" }],
          responses: {
            "200": {
              description: "Goal deleted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/goals/{id}/set-primary": {
        post: {
          tags: ["Goals"],
          summary: "Set goal as primary",
          operationId: "setPrimaryGoal",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/GoalId" }],
          responses: {
            "200": {
              description: "Primary goal updated",
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
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/goals/{id}/complete": {
        post: {
          tags: ["Goals"],
          summary: "Complete goal",
          operationId: "completeGoal",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/GoalId" }],
          responses: {
            "200": {
              description: "Goal completed",
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
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/goals/{id}/reopen": {
        post: {
          tags: ["Goals"],
          summary: "Reopen completed goal",
          operationId: "reopenGoal",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/GoalId" }],
          responses: {
            "200": {
              description: "Goal reopened",
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
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
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

      "/api/workouts": {
        get: {
          tags: ["Workouts"],
          summary: "Get current user's workouts",
          operationId: "getWorkouts",
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 1000, default: 50 },
              description: "Maximum number of workouts to return",
            },
            {
              name: "offset",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 0, default: 0 },
              description: "Pagination offset",
            },
            {
              name: "sport",
              in: "query",
              required: false,
              schema: { type: "string", example: "run" },
              description: "Filter by sport",
            },
            {
              name: "date_from",
              in: "query",
              required: false,
              schema: { type: "string", format: "date", example: "2026-01-01" },
              description: "Filter workouts from this local date",
            },
            {
              name: "date_to",
              in: "query",
              required: false,
              schema: { type: "string", format: "date", example: "2026-12-31" },
              description: "Filter workouts up to this local date",
            },
          ],
          responses: {
            "200": {
              description: "Workout list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Workout" },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Workouts"],
          summary: "Create manual workout",
          operationId: "createWorkout",
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WorkoutInput" },
              },
            },
          },
          responses: {
            "201": {
              description: "Workout created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      workout: { $ref: "#/components/schemas/Workout" },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      "/api/workouts/{id}": {
        get: {
          tags: ["Workouts"],
          summary: "Get workout by id",
          operationId: "getWorkoutById",
          security: [{ cookieAuth: [] }],
          parameters: [
            { $ref: "#/components/parameters/WorkoutId" },
            {
              name: "include",
              in: "query",
              required: false,
              schema: {
                type: "string",
                example: "streams,gps,insights",
              },
              description:
                "Optional comma-separated related data to include. Supported values: streams, gps, insights.",
            },
          ],
          responses: {
            "200": {
              description: "Workout details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      workout: { $ref: "#/components/schemas/Workout" },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        patch: {
          tags: ["Workouts"],
          summary: "Update workout",
          operationId: "updateWorkout",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/WorkoutId" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WorkoutInput" },
              },
            },
          },
          responses: {
            "200": {
              description: "Workout updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      workout: { $ref: "#/components/schemas/Workout" },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        delete: {
          tags: ["Workouts"],
          summary: "Soft-delete workout",
          operationId: "deleteWorkout",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/WorkoutId" }],
          responses: {
            "200": {
              description: "Workout deleted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OkResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/workouts/{id}/note": {
        patch: {
          tags: ["Workouts"],
          summary: "Update workout note",
          operationId: "updateWorkoutNote",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/WorkoutId" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    description: {
                      type: "string",
                      nullable: true,
                      example: "Лёгкий бег, самочувствие хорошее.",
                    },
                    note: {
                      type: "string",
                      nullable: true,
                      deprecated: true,
                      description: "Deprecated alias for description",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Workout note updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      workout: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          description: { type: "string", nullable: true },
                          updated_at: { type: "string", format: "date-time", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/workouts/{id}/streams": {
        get: {
          tags: ["Workouts"],
          summary: "Get workout chart streams preview",
          description:
            "Returns downsampled time-series data for workout charts: time, heart rate and pace.",
          operationId: "getWorkoutStreams",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/WorkoutId" }],
          responses: {
            "200": {
              description: "Workout streams preview",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      streams: { $ref: "#/components/schemas/WorkoutStreamsPreview" },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/workouts/{id}/gps": {
        get: {
          tags: ["Workouts"],
          summary: "Get workout GPS stream",
          description:
            "Returns GPS stream data for the interactive workout map.",
          operationId: "getWorkoutGps",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/WorkoutId" }],
          responses: {
            "200": {
              description: "Workout GPS stream",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      gps: { $ref: "#/components/schemas/WorkoutGpsStream" },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      "/api/workouts/{id}/ai-insight": {
        get: {
          tags: ["Workouts"],
          summary: "Get latest workout AI insight",
          description:
            "Returns the latest active AI insight for a workout, if it exists.",
          operationId: "getWorkoutAiInsight",
          security: [{ cookieAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/WorkoutId" }],
          responses: {
            "200": {
              description: "Latest workout AI insight",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      insight: {
                        oneOf: [
                          { $ref: "#/components/schemas/WorkoutAiInsight" },
                          { type: "null" },
                        ],
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
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
      parameters: {
        GoalId: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Goal ID",
        },
        WorkoutId: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Workout ID",
        },
        WorkoutFileId: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Workout file ID",
        },
      },
      schemas: {
        WorkoutFile: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            workout_id: { type: "string", format: "uuid", nullable: true },
            filename: { type: "string", nullable: true },
            status: {
              type: "string",
              nullable: true,
              enum: [
                "pending",
                "uploading",
                "uploaded",
                "processing",
                "ready",
                "error",
                "failed",
                "archived",
                null,
              ],
            },
            error_message: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
            uploaded_at: { type: "string", format: "date-time", nullable: true },
            processed_at: { type: "string", format: "date-time", nullable: true },
            storage_bucket: { type: "string", example: "fits" },
            storage_path: { type: "string" },
            size_bytes: { type: "integer", nullable: true },
            kind: { type: "string", nullable: true, example: "source" },
            content_type: { type: "string", nullable: true, example: "application/zip" },
          },
        },

        WorkoutFileUploadResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            id: { type: "string", format: "uuid" },
            duplicate: { type: "boolean", example: false },
            file: { $ref: "#/components/schemas/WorkoutFile" },
          },
        },

        HrZone: {
          type: "object",
          required: ["name", "min", "max"],
          properties: {
            name: {
              type: "string",
              example: "Аэробная база",
            },
            min: {
              type: "integer",
              example: 120,
            },
            max: {
              type: "integer",
              example: 140,
            },
          },
        },

        HrZones: {
          type: "object",
          required: ["Z1", "Z2", "Z3", "Z4", "Z5"],
          properties: {
            Z1: { $ref: "#/components/schemas/HrZone" },
            Z2: { $ref: "#/components/schemas/HrZone" },
            Z3: { $ref: "#/components/schemas/HrZone" },
            Z4: { $ref: "#/components/schemas/HrZone" },
            Z5: { $ref: "#/components/schemas/HrZone" },
          },
          example: {
            Z1: { name: "Восстановление", min: 100, max: 120 },
            Z2: { name: "Аэробная база", min: 120, max: 140 },
            Z3: { name: "Темповая", min: 140, max: 160 },
            Z4: { name: "Пороговая", min: 160, max: 180 },
            Z5: { name: "VO₂ / Спурт", min: 180, max: 200 },
          },
        },

        IntegrationsResponse: {
          type: "object",
          properties: {
            strava: {
              type: "object",
              properties: {
                connected: {
                  type: "boolean",
                  example: true,
                },
                id: {
                  type: "string",
                  nullable: true,
                },
                provider: {
                  type: "string",
                  example: "strava",
                },
                status: {
                  type: "string",
                  example: "connected",
                },
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
                last_synced_at: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                },
                error_message: {
                  type: "string",
                  nullable: true,
                },
              },
            },
          },
        },

        DashboardDayRow: {
          type: "object",
          properties: {
            d: { type: "string", example: "2026-04-30" },
            workouts: { type: "number", example: 2 },
            time_sec: { type: "number", example: 5400 },
            distance_m: { type: "number", example: 12000 },
            kcal: { type: "number", example: 720 },
          },
        },

        DashboardWeekRow: {
          type: "object",
          properties: {
            week_start: { type: "string", example: "2026-04-27" },
            workouts: { type: "number", example: 4 },
            time_sec: { type: "number", example: 14400 },
            distance_m: { type: "number", example: 32000 },
          },
        },

        DashboardWeekdayRow: {
          type: "object",
          properties: {
            dow: {
              type: "number",
              description: "ISO weekday number, 1 = Monday, 7 = Sunday",
              example: 1,
            },
            workouts: { type: "number", example: 3 },
            time_sec: { type: "number", example: 7200 },
          },
        },

        DashboardSportMixRow: {
          type: "object",
          properties: {
            sport: { type: "string", example: "run" },
            workouts: { type: "number", example: 8 },
            time_sec: { type: "number", example: 21600 },
          },
        },

        DashboardHrZoneRow: {
          type: "object",
          properties: {
            local_date: {
              type: "string",
              nullable: true,
              example: "2026-04-30",
            },
            hr_zone_time: {
              type: "object",
              nullable: true,
              additionalProperties: {
                type: "number",
              },
              example: {
                Z1: 600,
                Z2: 1800,
                Z3: 300,
              },
            },
          },
        },

        DashboardNextPlannedWorkout: {
          type: "object",
          properties: {
            id: { type: "string" },
            planned_date: { type: "string", example: "2026-05-01" },
            title: {
              type: "string",
              nullable: true,
              example: "Лёгкий бег 40 минут",
            },
            sport: {
              type: "string",
              nullable: true,
              example: "run",
            },
            status: {
              type: "string",
              nullable: true,
              example: "planned",
            },
            structure: {
              type: "object",
              nullable: true,
              additionalProperties: true,
              properties: {
                duration_min: { type: "number", nullable: true },
                distance_km: { type: "number", nullable: true },
                goal: { type: "string", nullable: true },
                effort: { type: "string", nullable: true },
              },
            },
          },
        },

        PlanSession: {
          type: "object",
          additionalProperties: true,
          properties: {
            id: { type: "string" },
            user_plan_id: {
              type: "string",
              nullable: true,
            },
            planned_date: {
              type: "string",
              example: "2026-05-01",
            },
            sport: {
              type: "string",
              nullable: true,
              example: "run",
            },
            status: {
              type: "string",
              nullable: true,
              example: "planned",
            },
            title: {
              type: "string",
              nullable: true,
            },
            notes: {
              type: "string",
              nullable: true,
            },
            structure: {
              type: "object",
              nullable: true,
              additionalProperties: true,
              properties: {
                source: { type: "string", example: "manual" },
                goal: { type: "string", nullable: true },
                main: { type: "string", nullable: true },
                notes: { type: "string", nullable: true },
                effort: { type: "string", nullable: true },
                hr_target: { type: "string", nullable: true },
                hr_zones: {
                  type: "array",
                  items: { type: "string" },
                },
                duration_min: { type: "number", nullable: true },
                distance_km: { type: "number", nullable: true },
              },
            },
            link_workout_id: {
              type: "string",
              nullable: true,
            },
          },
        },

        Goal: {
          type: "object",
          properties: {
            id: { type: "string" },
            user_id: { type: "string" },
            title: { type: "string" },
            type: {
              type: "string",
              example: "10k",
            },
            sport: {
              type: "string",
              nullable: true,
              example: "run",
            },
            status: {
              type: "string",
              example: "active",
            },
            date_from: {
              type: "string",
              format: "date",
              nullable: true,
            },
            date_to: {
              type: "string",
              format: "date",
              nullable: true,
            },
            target_json: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
            progress_cache: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
            notes: {
              type: "string",
              nullable: true,
            },
            is_primary: {
              type: "boolean",
              nullable: true,
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
          },
        },

        GoalInput: {
          type: "object",
          properties: {
            title: { type: "string", example: "Пробежать 10 км уверенно" },
            type: { type: "string", example: "10k" },
            sport: { type: "string", nullable: true, example: "run" },
            date_from: { type: "string", format: "date" },
            date_to: { type: "string", format: "date" },
            status: { type: "string", example: "active" },
            target_json: {
              type: "object",
              additionalProperties: true,
            },
            notes: { type: "string", nullable: true },
            is_primary: { type: "boolean" },
          },
        },

        ProfileInput: {
          type: "object",
          properties: {
            display_name: { type: "string" },
            avatar_url: { type: "string" },
            locale: { type: "string" },
            timezone: { type: "string" },
            country_code: {
              type: "string",
              example: "DE",
              description: "ISO country code",
            },
            country: {
              type: "string",
              deprecated: true,
              description: "Deprecated alias. Will be mapped to country_code",
            },
            city: { type: "string" },
            unit_system: { type: "string" },
            username: { type: "string" },
            bio: { type: "string" },
            gender: { type: "string", nullable: true },
            birth_date: { type: "string", format: "date" },
            height_cm: { type: "number" },
            weight_kg: { type: "number" },
            default_workout_privacy: { type: "string" },
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
            user_id: { type: "string" },
            display_name: { type: "string", nullable: true },
            avatar_url: { type: "string", nullable: true },
            locale: { type: "string", nullable: true },
            timezone: { type: "string", nullable: true },
            country_code: {
              type: "string",
              nullable: true,
              example: "DE",
              description: "ISO country code (source of truth)",
            },
            country: {
              type: "string",
              nullable: true,
              deprecated: true,
              description: "Deprecated. Use country_code instead",
            },
            city: { type: "string", nullable: true },
            unit_system: { type: "string", nullable: true },
            username: { type: "string", nullable: true },
            bio: { type: "string", nullable: true },
            gender: { type: "string", nullable: true },
            sex: {
              type: "string",
              nullable: true,
              enum: ["male", "female", "other", null],
            },
            birth_date: {
              type: "string",
              format: "date",
              nullable: true,
              description: "Single source of truth for age",
            },
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

        Workout: {
          type: "object",
          additionalProperties: true,
          properties: {
            id: { type: "string" },
            user_id: { type: "string" },
            name: { type: "string", nullable: true },
            description: { type: "string", nullable: true },
            sport: { type: "string", nullable: true, example: "run" },
            sub_sport: { type: "string", nullable: true, example: "road" },
            source: { type: "string", nullable: true, example: "manual" },
            visibility: { type: "string", nullable: true, example: "private" },
            start_time: { type: "string", format: "date-time", nullable: true },
            local_date: { type: "string", format: "date", nullable: true },
            timezone_at_start: { type: "string", nullable: true, example: "Europe/Berlin" },
            uploaded_at: { type: "string", format: "date-time", nullable: true },
            duration_sec: { type: "number", nullable: true, example: 3600 },
            moving_time_sec: { type: "number", nullable: true, example: 3520 },
            distance_m: { type: "number", nullable: true, example: 10000 },
            calories_kcal: { type: "number", nullable: true, example: 650 },
            avg_hr: { type: "number", nullable: true, example: 145 },
            max_hr: { type: "number", nullable: true, example: 178 },
            avg_pace_s_per_km: { type: "number", nullable: true, example: 330 },
            elev_gain_m: { type: "number", nullable: true, example: 120 },
            elev_loss_m: { type: "number", nullable: true, example: 118 },
            avg_power_w: { type: "number", nullable: true },
            max_power_w: { type: "number", nullable: true },
            np_power_w: { type: "number", nullable: true },
            avg_cadence_spm: { type: "number", nullable: true },
            avg_cadence_rpm: { type: "number", nullable: true },
            trimp: { type: "number", nullable: true },
            ef: { type: "number", nullable: true },
            pa_hr_pct: { type: "number", nullable: true },
            intensity_factor: { type: "number", nullable: true },
            training_load_score: { type: "number", nullable: true },
            laps_count: { type: "number", nullable: true },
            has_gps: { type: "boolean", nullable: true },
            weather: {
              type: "object",
              nullable: true,
              additionalProperties: true,
            },
            hr_zone_time: {
              type: "object",
              nullable: true,
              additionalProperties: { type: "number" },
            },
            perceived_exertion: { type: "number", nullable: true },
            strava_activity_url: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time", nullable: true },
            updated_at: { type: "string", format: "date-time", nullable: true },
          },
        },

        WorkoutInput: {
          type: "object",
          properties: {
            name: { type: "string", nullable: true, example: "Лёгкий бег" },
            description: { type: "string", nullable: true },
            sport: { type: "string", nullable: true, example: "run" },
            sub_sport: { type: "string", nullable: true, example: "road" },
            start_time: { type: "string", format: "date-time", nullable: true },
            local_date: { type: "string", format: "date", nullable: true },
            distance_m: { type: "number", nullable: true, example: 10000 },
            duration_sec: { type: "number", nullable: true, example: 3600 },
            moving_time_sec: { type: "number", nullable: true },
            calories_kcal: { type: "number", nullable: true },
            visibility: { type: "string", nullable: true, example: "private" },
            swim_pool_length_m: { type: "number", nullable: true },
            gym_exercises_count: { type: "number", nullable: true },
            gym_sets_count: { type: "number", nullable: true },
            gym_reps_total: { type: "number", nullable: true },
            gym_volume_kg: { type: "number", nullable: true },
          },
        },

        WorkoutStreamsPreview: {
          type: "object",
          properties: {
            s: {
              type: "object",
              properties: {
                time_s: {
                  type: "array",
                  items: { type: "number" },
                  example: [0, 10, 20],
                },
                hr: {
                  type: "array",
                  items: { type: "number", nullable: true },
                  example: [132, 135, 138],
                },
                pace_s_per_km: {
                  type: "array",
                  items: { type: "number", nullable: true },
                  example: [360, 355, 350],
                },
              },
            },
            created_at: { type: "string", format: "date-time", nullable: true },
            updated_at: { type: "string", format: "date-time", nullable: true },
          },
        },

        WorkoutGpsStream: {
          type: "object",
          properties: {
            s: {
              type: "object",
              properties: {
                time_s: {
                  type: "array",
                  items: { type: "number" },
                  example: [0, 10, 20],
                },
                lat: {
                  type: "array",
                  items: { type: "number" },
                  example: [55.7558, 55.756, 55.7562],
                },
                lon: {
                  type: "array",
                  items: { type: "number" },
                  example: [37.6173, 37.6175, 37.6178],
                },
              },
            },
            points_count: { type: "integer", nullable: true, example: 1500 },
            created_at: { type: "string", format: "date-time", nullable: true },
            updated_at: { type: "string", format: "date-time", nullable: true },
          },
        },

        WorkoutAiInsight: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string", nullable: true },
            summary: { type: "string", nullable: true },
            content_md: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
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
        OkResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
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