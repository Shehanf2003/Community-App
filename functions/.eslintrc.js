/* eslint-env node */
module.exports = {
  root: true,
  env: {
    es6: true,
    node: true, // ✅ This ensures 'require', 'module', and 'exports' are recognized
  },
  extends: ["eslint:recommended"],
  rules: {
    "no-unused-vars": "warn",
    "no-undef": "off", // ✅ Disable 'undefined' errors for Node.js globals
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
};

