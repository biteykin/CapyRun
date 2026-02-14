// frontend/lib/coach/modelConfig.ts
export const COACH_MODELS = {
    planner: process.env.COACH_PLANNER_MODEL ?? "gpt-4.1-mini",
    responder: process.env.COACH_RESPONDER_MODEL ?? "gpt-4o",
  } as const;

  //Open-AI model-list
  //gpt-4.1-mini - подешевше
  //gpt-4.1 - лучшее из 4 версий
  //gpt-4o - баланс между мини и 4.1