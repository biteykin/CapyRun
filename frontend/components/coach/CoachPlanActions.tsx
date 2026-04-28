//frontend/components/coach/CoachPlanActions.tsx

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function CoachPlanActions(props: {
  className?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const {
    className,
    isLoading = false,
    disabled = false,
    onConfirm,
    onCancel,
    confirmLabel = "Добавить",
    cancelLabel = "Отменить",
  } = props;

  const isDisabled = disabled || isLoading;

  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap items-center gap-2",
        className
      )}
    >
      <Button
        type="button"
        size="sm"
        variant="primary"
        disabled={isDisabled}
        onClick={onConfirm}
        className="min-w-[112px] rounded-full"
      >
        {isLoading ? "Добавляем…" : confirmLabel}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={isDisabled}
        onClick={onCancel}
        className="min-w-[112px] rounded-full"
      >
        {cancelLabel}
      </Button>
    </div>
  );
}