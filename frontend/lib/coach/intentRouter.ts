// frontend/lib/coach/intentRouter.ts

import { PlannerOut } from "./types";
import { DialogState } from "./dialogState";

export type RoutedIntent =
  | { kind: "continue_scenario" }
  | { kind: "start_workout_review" }
  | { kind: "start_plan_build" }
  | { kind: "simple_answer" };

export function routeIntent(args: {
  planner: PlannerOut;
  dialogState: DialogState;
  userText: string;
}): RoutedIntent {
  const { planner, dialogState, userText } = args;

  // 1. Если пользователь отвечает коротко внутри сценария
  if (
    dialogState.scenario !== "idle" &&
    userText.length < 40
  ) {
    return { kind: "continue_scenario" };
  }

  // 2. Запрос на разбор тренировки
  if (planner.intent === "analysis") {
    return { kind: "start_workout_review" };
  }

  // 3. Запрос на план
  if (planner.intent === "plan") {
    return { kind: "start_plan_build" };
  }

  // 4. Всё остальное
  return { kind: "simple_answer" };
}