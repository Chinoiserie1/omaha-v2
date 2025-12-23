import reactConfig from "@repo/config-eslint/react";

export default [
  {
    ignores: ["babel.config.js", "metro.config.js", "tailwind.config.js"],
  },
  ...reactConfig,
];
