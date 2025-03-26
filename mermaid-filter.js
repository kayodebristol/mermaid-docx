#!/usr/bin/env node
const pandoc = require("pandoc-filter");

function action(el, format, meta) {
  if (el.t === 'CodeBlock') {
    const [[ident, classes = [], kvs], code] = el.c;

    console.error("CLASSES:", classes);
    console.error("CODE:", code);

    if (
      classes.includes("mermaid") ||
      code.trim().startsWith("graph ") ||
      code.trim().startsWith("sequenceDiagram")
    ) {
      const fs = require("fs");
      const { execSync } = require("child_process");

      const tmpIn = "/tmp/diagram.mmd";
      const tmpOut = "/tmp/diagram.png";

      fs.writeFileSync(tmpIn, code);
      execSync(`npx mmdc -i ${tmpIn} -o ${tmpOut} -w 800 -b white`);

      const image = fs.readFileSync(tmpOut).toString("base64");

    return pandoc.Para([
  pandoc.Image(
    ["", [], []],
    [{ t: "Str", c: "" }],
    [`data:image/png;base64,${image}`, "fig:"]
  )
]);
}
  }
}

pandoc.stdio(action);

