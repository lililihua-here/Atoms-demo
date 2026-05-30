// lib/agent/merge.ts
// Merges code produced by N parallel single-component Engineer sub-agents
// into one runnable single-file React app. Strips imports/exports, de-dups
// top-level declarations, auto-composes pure-layout nodes, and appends an App
// shell with ReactDOM mounting.

import type { ComponentContract, ComponentSpec, PropSpec, SubTask } from "./contract";
import { extractCode } from "./pipeline";

export interface ComponentResult {
  componentName: string;
  output: string;
  ok: boolean;
}

// Strip import/export/require lines and stray ReactDOM mount calls
function sanitizeComponentCode(code: string): string {
  return code
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (/^import\s/.test(t)) return false;
      if (/^export\s/.test(t)) return false;
      if (/^const\s*\{\s*[\w,\s]+\}\s*=\s*React\s*;?$/.test(t)) return false;
      if (/require\s*\(/.test(t)) return false;
      if (/ReactDOM\.(createRoot|render)/.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

// Extract the first top-level function/const component name in a code chunk
function detectDeclaredName(code: string): string | null {
  const fn = code.match(/function\s+([A-Z][A-Za-z0-9_]*)\s*\(/);
  if (fn) return fn[1];
  const cn = code.match(/const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\(/);
  if (cn) return cn[1];
  return null;
}

// Placeholder component matching contract props signature
function makePlaceholder(spec: ComponentSpec): string {
  const destructure =
    spec.props.length > 0
      ? `{ ${spec.props.map((p: PropSpec) => p.name).join(", ")} }`
      : "props";
  return `function ${spec.name}(${destructure}) {
  return (
    <div className="border-2 border-dashed border-red-400 p-4 rounded bg-red-50">
      <p className="text-red-600 text-sm">⚠ ${spec.name} 组件生成失败，已被跳过</p>
    </div>
  );
}`;
}

// Compose a pure-layout node that arranges its dependency children
function composeLayoutNode(spec: ComponentSpec): string {
  const childrenJsx = spec.dependencies
    .map((dep) => `      <${dep} />`)
    .join("\n");
  return `function ${spec.name}() {
  return (
    <div className="layout-${spec.name.toLowerCase()}">
${childrenJsx}
    </div>
  );
}`;
}

// Lightweight bracket-balance syntax validation
export function validateSyntax(code: string): boolean {
  if (!code || !/function\s+App\s*\(/.test(code)) return false;
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  let inStr: string | null = null;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const prev = code[i - 1];
    if (inStr) {
      if (ch === inStr && prev !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0 && inStr === null;
}

// Merge results into a single runnable file
export function mergeComponents(
  results: ComponentResult[],
  contract: ComponentContract,
  subtasks?: SubTask[]
): string {
  const specByName = new Map<string, ComponentSpec>();
  contract.components.forEach((c) => specByName.set(c.name, c));

  const usedNames = new Set<string>(["App"]);
  const blocks: string[] = [];

  // 1) Leaf components from sub-agent results (or placeholders on failure)
  const tasks = subtasks ?? contract.components.filter((c) => c.type === "leaf");
  for (const task of tasks) {
    const spec = "spec" in task ? (task as SubTask).spec : specByName.get((task as any).componentName);
    if (!spec) continue;
    const componentName = "componentName" in task ? (task as any).componentName : spec.name;
    const res = results.find((r) => r.componentName === componentName);
    let codeBlock: string | null = null;
    if (res && res.ok) {
      const extracted = extractCode(res.output) || res.output;
      const sanitized = sanitizeComponentCode(extracted);
      const declared = detectDeclaredName(sanitized);
      if (declared === spec.name && /function|const/.test(sanitized)) {
        codeBlock = sanitized;
      }
    }
    if (!codeBlock) codeBlock = makePlaceholder(spec);
    if (usedNames.has(spec.name)) continue;
    usedNames.add(spec.name);
    blocks.push(codeBlock);
  }

  // 2) Pure-layout nodes auto-composed by the orchestrator
  for (const spec of contract.components) {
    if (spec.type === "layout" && !usedNames.has(spec.name)) {
      usedNames.add(spec.name);
      blocks.push(composeLayoutNode(spec));
    }
  }

  // 3) App shell: render top-level components (not used as dependencies)
  const dependedOn = new Set<string>();
  contract.components.forEach((c) =>
    c.dependencies.forEach((d) => dependedOn.add(d))
  );
  const rootComponents = contract.components
    .filter((c) => !dependedOn.has(c.name) && c.name !== "App")
    .map((c) => c.name);
  const rootJsx =
    rootComponents.length > 0
      ? rootComponents.map((n) => `      <${n} />`).join("\n")
      : '      <div className="p-8 text-center text-gray-500">空应用</div>';

  const appShell = `function App() {
  return (
    <div className="min-h-screen">
${rootJsx}
    </div>
  );
}`;
  blocks.push(appShell);

  // 4) Hooks destructure (single copy) + mount code
  const header = `const { useState, useEffect, useMemo, useRef, useCallback } = React;`;
  const mount = `const __root = ReactDOM.createRoot(document.getElementById('root'));
__root.render(<App />);`;

  return [header, "", blocks.join("\n\n"), "", mount].join("\n");
}
