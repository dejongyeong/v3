const lintStagedConfig = {
  "*.{js,jsx,ts,tsx}": () => "npm run lint",
  "*.{json,yaml}": () => "npm run format",
  "**/*.ts?(x)": () => "npm run check-types",
};

export default lintStagedConfig;
