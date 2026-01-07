// frontend/.storybook/preview.tsx
import * as React from "react";
import type { Preview } from "@storybook/react";
import { initialize, mswLoader } from "msw-storybook-addon";
import "../app/globals.css";

// инициализация MSW
initialize();

const preview: Preview = {
  loaders: [mswLoader],

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#0e0e0e" },
      ],
    },
    a11y: { test: "todo" },
  },

  decorators: [
    (Story, ctx) => {
      const isDark = ctx.globals?.backgrounds?.value === "#0e0e0e";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", !!isDark);
      }
      return <Story />;
    },
  ],
};

export default preview;