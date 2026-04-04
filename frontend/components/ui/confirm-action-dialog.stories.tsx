"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { Button } from "@/components/ui/button";
import ConfirmActionDialog from "@/components/ui/confirm-action-dialog";

const meta: Meta<typeof ConfirmActionDialog> = {
  title: "UI/ConfirmActionDialog",
  component: ConfirmActionDialog,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmActionDialog>;

function Demo(args: React.ComponentProps<typeof ConfirmActionDialog>) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex items-center justify-center p-6">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Открыть диалог
      </Button>
      <ConfirmActionDialog
        {...args}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => {
          setOpen(false);
        }}
      />
    </div>
  );
}

export const DangerDelete: Story = {
  render: (args) => (
    <Demo
      {...args}
      title="Удалить тренировку?"
      description="Это действие необратимо."
      confirmLabel="Удалить"
      cancelLabel="Отмена"
      confirmVariant="danger"
    />
  ),
};

export const PrimaryConfirm: Story = {
  render: (args) => (
    <Demo
      {...args}
      title="Сохранить изменения?"
      description="Новые параметры тренировки будут применены сразу."
      confirmLabel="Сохранить"
      cancelLabel="Отмена"
      confirmVariant="primary"
    />
  ),
};

export const LoadingState: Story = {
  render: (args) => {
    function LoadingDemo() {
      const [open, setOpen] = React.useState(false);
      const [loading, setLoading] = React.useState(false);

      return (
        <div className="flex items-center justify-center p-6">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Открыть диалог
          </Button>
          <ConfirmActionDialog
            {...args}
            open={open}
            onOpenChange={setOpen}
            title="Удалить тренировку?"
            description="Это действие необратимо."
            confirmLabel="Удалить"
            cancelLabel="Отмена"
            confirmVariant="danger"
            isLoading={loading}
            onConfirm={() => {
              setLoading(true);
            }}
          />
        </div>
      );
    }

    return <LoadingDemo />;
  },
};
