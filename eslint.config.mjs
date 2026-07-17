import nextPlugin from "eslint-config-next";

// This named config avoids an anonymous default export warning while keeping the setup minimal.
const config = [
  ...nextPlugin,
];

export default config;
