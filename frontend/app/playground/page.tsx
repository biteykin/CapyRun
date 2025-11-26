"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

export default function Playground() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Playground</h1>

      {/* Контролируемый пример */}
      <div className="space-x-2">
        <Button variant="primary" onClick={() => setOpen(true)}>
          Открыть контролируемый диалог
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <div className="space-y-2">
              <DialogTitle className="text-lg font-semibold">Подтверждение</DialogTitle>
              <DialogDescription>Продолжаем действие?</DialogDescription>
              <div className="pt-4 flex gap-2 justify-end">
                <DialogClose asChild>
                  <Button variant="secondary">Отмена</Button>
                </DialogClose>
                <Button variant="lemon" onClick={() => setOpen(false)}>
                  Да, продолжить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Неконтролируемый пример (через Trigger) */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost">Открыть диалог через Trigger</Button>
        </DialogTrigger>
        <DialogContent>
          <div className="space-y-2">
            <DialogTitle className="text-lg font-semibold">Диалог</DialogTitle>
            <DialogDescription>Это пример модального окна.</DialogDescription>
            <div className="pt-4 flex gap-2 justify-end">
              <DialogClose asChild>
                <Button variant="secondary">Закрыть</Button>
              </DialogClose>
              <Button variant="primary">Действие</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}