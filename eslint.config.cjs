const js = require("@eslint/js");

module.exports = [
  {
    // Apply the recommended rules and your custom settings
    ...js.configs.recommended,

    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
    },

    rules: {
      "no-cond-assign": "off",
      "no-constant-condition": "off",
      "no-prototype-builtins": "off",
    },
  },
];