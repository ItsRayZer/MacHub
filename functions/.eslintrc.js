module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
    "max-len": ["warn", {"code": 120}],
    "require-jsdoc": "off",
    "indent": ["error", 2],
    "comma-dangle": ["error", "always-multiline"],
    "object-curly-spacing": ["error", "always"],
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
};
