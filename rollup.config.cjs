// rollup.config.cjs
const { readFileSync } = require("fs");
const terser = require("@rollup/plugin-terser");
const meta = require("./package.json");

// Extract copyrights from the LICENSE.
const copyright = readFileSync("./LICENSE", "utf-8")
  .split(/\n/g)
  .filter(line => /^Copyright\s+/.test(line))
  .map(line => line.replace(/^Copyright\s+/, ""))
  .join(", ");

const banner = `// v${meta.version} Copyright ${copyright}`;

module.exports = {
  input: "src/index.js",
  external: Object.keys(meta.dependencies || {}).filter(key => /^d3-/.test(key)),
  output: [
    // ES module (for import)
    {
      file: "dist/index.mjs",
      format: "es",
      banner: banner
    },
    // CommonJS (for require)
    {
      file: "dist/index.cjs",
      format: "cjs",
      banner: banner
    },
    // UMD (for browsers)
    {
      file: `dist/${meta.name}.min.js`,
      format: "umd",
      name: "d3",
      extend: true,
      globals: Object.assign({}, ...Object.keys(meta.dependencies || {}).filter(key => /^d3-/.test(key)).map(key => ({[key]: "d3"}))),
      plugins: [
        terser({
          output: {
            preamble: banner
          }
        })
      ]
    }
  ]
};