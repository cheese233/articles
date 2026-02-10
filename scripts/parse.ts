#!/bin/env deno

import { Marked } from "../render/markdown.js";
const marked: import("https://esm.sh/marked").Marked = await Marked();
const lexer = new marked.Lexer();

console.log(
  await marked.parse("```cpp\n#include<iostream>\n```"),
);
