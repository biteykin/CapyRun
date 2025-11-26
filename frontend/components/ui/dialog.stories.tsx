import type { Meta, StoryObj } from "@storybook/react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "./dialog";
import { Button } from "./button";

const meta: Meta<typeof Dialog> = { 
  title: "UI/Dialog", 
  component: Dialog,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Dialog>;

export const Basic: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary">Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <div className="space-y-2">
          <DialogTitle className="text-lg font-semibold">Confirm action</DialogTitle>
          <DialogDescription>Are you sure you want to proceed?</DialogDescription>
          <div className="pt-4 flex gap-2 justify-end">
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button variant="lemon">Confirm</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
};