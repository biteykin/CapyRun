// frontend/.storybook/main.ts
import type { StorybookConfig } from "@storybook/nextjs-vite";
import { mergeConfig } from "vite";
import path from "path";

const config: StorybookConfig = {
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },

  staticDirs: ["../public"],

  stories: [
    "../components/**/*.stories.@(ts|tsx)",
    "../app/**/*.stories.@(ts|tsx)",
  ],

  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-onboarding",
    "@storybook/addon-vitest",
  ],

  docs: {
    defaultName: "Docs",
  },

  viteFinal: async (config) =>
    mergeConfig(config, {
      resolve: {
        alias: {
          "@/lib/supabaseBrowser": path.resolve(
            __dirname,
            "./mocks/supabaseBrowser.ts"
          ),
        },
      },
    }),
};

export default config;