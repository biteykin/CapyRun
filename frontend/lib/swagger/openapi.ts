/* frontend/lib/swagger/openapi.ts */
/** Path entries to merge into the main OpenAPI `paths` object (e.g. app/api/openapi/route.ts). */
export const openApiPathsFragment = {
  "/api/workouts/{id}/weather": {
    get: {
      tags: ["Workouts"],
      summary: "Get workout weather",
      description:
        "Returns saved weather snapshot for the current user's workout.",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        200: {
          description: "Workout weather",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  weather: {
                    nullable: true,
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
        404: { description: "Workout not found" },
        500: { description: "Server error" },
      },
    },
  },
} as const;
