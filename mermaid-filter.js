#!/usr/bin/env node

const pandoc = require("pandoc-filter");
const { execSync } = require("child_process");
const fs = require("fs");

function action(el, format, meta) {
  if (el.t === "CodeBlock") {
    const [[ident, classes = [], kvs], code] = el.c;

    const isMermaid =
      classes.includes("mermaid") ||
      code.trim().startsWith("graph ") ||
      code.trim().startsWith("sequenceDiagram");

    if (isMermaid) {
      const tmpIn = "/tmp/diagram.mmd";
      const tmpOut = "/tmp/diagram.png";

      fs.writeFileSync(tmpIn, code);
      execSync(`npx mmdc -i ${tmpIn} -o ${tmpOut} -w 800 -b white`);
      const image = fs.readFileSync(tmpOut).toString("base64");

      const imageElement = {
        t: "Para",
        c: [
          {
            t: "Image",
            c: [
              ["", [], []],
              [{ t: "Str", c: "Mermaid Diagram" }],
              [`data:image/png;base64,${image}`, "fig:"]
            ]
          }
        ]
      };

      const codeBlockElement = {
        t: "CodeBlock",
        c: [[ident, classes, kvs], code]
      };

      return {
        t: "Div",
        c: [
          ["", ["mermaid-diagram"], []],
          [codeBlockElement, imageElement]
        ]
      };
    }
  }
}

pandoc.stdio(action);
