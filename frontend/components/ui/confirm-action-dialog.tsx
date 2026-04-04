"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "secondary" | "danger";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  contentClassName?: string;
};

export default function ConfirmActionDialog(props: ConfirmActionDialogProps) {
  const {
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Подтвердить",
    cancelLabel = "Отмена",
    confirmVariant = "danger",
    isLoading = false,
    onConfirm,
    contentClassName = "max-w-md",
  } = props;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={contentClassName}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? "Выполняем…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
