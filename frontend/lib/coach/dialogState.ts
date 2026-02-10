// frontend/lib/coach/dialogState.ts

export type DialogScenario =
  | "idle"
  | "workout_review"
  | "plan_build"
  | "injury_check";

export type DialogState = {
  scenario: DialogScenario;
  step: string | null;
  workout_id?: string;
  started_at: string;
};

export function getDialogState(threadMeta: any | null): DialogState {
  const ds = threadMeta?.dialog_state;
  if (!ds || typeof ds !== "object") {
    return {
      scenario: "idle",
      step: null,
      started_at: new Date().toISOString(),
    };
  }
  return ds;
}

export function setDialogState(
  threadMeta: any | null,
  next: Partial<DialogState>
) {
  const prev = getDialogState(threadMeta);
  return {
    ...(threadMeta ?? {}),
    dialog_state: {
      ...prev,
      ...next,
      started_at: prev.started_at ?? new Date().toISOString(),
    },
  };
}

export function resetDialogState(threadMeta: any | null) {
  return {
    ...(threadMeta ?? {}),
    dialog_state: {
      scenario: "idle",
      step: null,
      started_at: new Date().toISOString(),
    },
  };
}