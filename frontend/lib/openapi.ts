export const openApiSpec = {
  openapi: "3.0.3",
  paths: {
    "/api/workouts/{id}/weather": {
      get: {
        tags: ["Workouts"],
        summary: "Get workout weather",
        description:
          "Возвращает погоду, сохранённую для тренировки текущего пользователя. Используется клиентским виджетом погоды вместо прямого обращения к Supabase.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Workout ID",
            schema: {
              type: "string",
              format: "uuid",
            },
          },
        ],
        responses: {
          "200": {
            description: "Workout weather payload",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    weather: {
                      nullable: true,
                      $ref: "#/components/schemas/WorkoutWeather",
                    },
                  },
                  required: ["weather"],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Workout not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            description: "Server error",
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
  },
  components: {
    schemas: {
      WorkoutWeather: {
        type: "object",
        additionalProperties: true,
        properties: {
          temp_c: { type: "number", nullable: true, example: 12.4 },
          feelslike_c: { type: "number", nullable: true, example: 10.8 },
          wind_kph: { type: "number", nullable: true, example: 14 },
          gust_kph: { type: "number", nullable: true, example: 22 },
          wind_degree: { type: "number", nullable: true, example: 260 },
          wind_dir: { type: "string", nullable: true, example: "W" },
          humidity: { type: "number", nullable: true, example: 68 },
          pressure_hpa: { type: "number", nullable: true, example: 1014 },
          conditions: { type: "string", nullable: true, example: "Partly cloudy" },
          precip_mm: { type: "number", nullable: true, example: 0.2 },
          cloud: { type: "number", nullable: true, example: 42 },
          uv: { type: "number", nullable: true, example: 3 },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
    },
  },
};
