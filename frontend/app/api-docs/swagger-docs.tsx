// /app/api/api-docs/swagger-docs.tsx

"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function SwaggerDocs() {
  return (
    <main className="min-h-screen bg-white">
      <SwaggerUI
        url="/api/openapi"
        docExpansion="list"
        defaultModelsExpandDepth={1}
        defaultModelExpandDepth={1}
        displayRequestDuration
        persistAuthorization
      />
    </main>
  );
}