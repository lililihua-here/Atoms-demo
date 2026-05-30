// lib/agent/contract.ts
// Parses the structured component interface contract emitted by the Architect
// agent, and derives parallelizable Engineer sub-tasks from it.

export interface PropSpec {
  name: string;
  type: string;
  required: boolean;
}

export interface ComponentSpec {
  name: string;
  type: "leaf" | "layout" | "logic";
  props: PropSpec[];
  has_internal_state: boolean;
  dependencies: string[];
}

export interface SharedUtility {
  name: string;
  signature: string;
  used_by: string[];
}

export interface ComponentContract {
  components: ComponentSpec[];
  shared_utilities: SharedUtility[];
}

export interface SubTask {
  componentName: string;
  prompt: string;
  spec: ComponentSpec;
}

// Extract a component contract from markdown — handles various output formats
export function extractContract(markdown: string): ComponentContract | null {
  if (!markdown) return null;
  let jsonStr = "";

  // Try ```json block first
  const jsonBlock = markdown.match(/```json\s*\n?([\s\S]*?)```/i);
  if (jsonBlock && jsonBlock[1]) jsonStr = jsonBlock[1].trim();

  // Try any fenced block that looks like JSON
  if (!jsonStr) {
    const anyBlock = markdown.match(/```\s*\n?([\s\S]*?)```/);
    if (anyBlock && anyBlock[1] && anyBlock[1].trim().startsWith("{")) {
      jsonStr = anyBlock[1].trim();
    }
  }

  // Try finding JSON object with "components" in raw text
  if (!jsonStr) {
    const match = markdown.match(/\{[\s\S]*"components"[\s\S]*\}/);
    if (match) jsonStr = match[0];
  }

  if (!jsonStr) return null;

  try {
    const raw = JSON.parse(jsonStr);
    if (!raw || !Array.isArray(raw.components)) return null;
    const components: ComponentSpec[] = raw.components
      .filter((c: any) => c && typeof c.name === "string")
      .map((c: any) => ({
        name: c.name,
        type: (c.type === "layout" || c.type === "logic" ? c.type : "leaf") as ComponentSpec["type"],
        props: Array.isArray(c.props)
          ? c.props.filter((p: any) => p && typeof p.name === "string").map((p: any) => ({
              name: p.name,
              type: typeof p.type === "string" ? p.type : "any",
              required: !!p.required,
            }))
          : [],
        has_internal_state: !!c.has_internal_state,
        dependencies: Array.isArray(c.dependencies)
          ? c.dependencies.filter((d: any): d is string => typeof d === "string")
          : [],
      }));
    const shared_utilities: SharedUtility[] = Array.isArray(raw.shared_utilities)
      ? raw.shared_utilities
          .filter((u: any) => u && typeof u.name === "string")
          .map((u: any) => ({
            name: u.name,
            signature: typeof u.signature === "string" ? u.signature : "",
            used_by: Array.isArray(u.used_by)
              ? u.used_by.filter((x: any): x is string => typeof x === "string")
              : [],
          }))
      : [];
    return { components, shared_utilities };
  } catch {
    return null;
  }
}

// A component is a parallelizable leaf when typed "leaf" and has no dependencies
export function buildSubtasks(contract: ComponentContract): SubTask[] {
  return contract.components
    .filter((c) => c.type === "leaf" && c.dependencies.length === 0)
    .map((c) => ({
      componentName: c.name,
      prompt: renderContractSlice(c, contract.shared_utilities),
      spec: c,
    }));
}

export function hasParallelizableLeaves(contract: ComponentContract): boolean {
  const leaves = contract.components.filter(
    (c) => c.type === "leaf" && c.dependencies.length === 0
  );
  return leaves.length >= 2;
}

// Render a component's contract slice as prompt context for single-component mode
export function renderContractSlice(spec: ComponentSpec, shared: SharedUtility[]): string {
  const propsLines =
    spec.props.length > 0
      ? spec.props
          .map((p) => `  - ${p.name}: ${p.type}${p.required ? " (必填)" : " (可选)"}`)
          .join("\n")
      : "  - (无 props)";
  const relatedUtils = shared.filter((u) => u.used_by.includes(spec.name));
  const utilLines =
    relatedUtils.length > 0
      ? "\n可使用的共享工具函数(将由编排器统一注入,你可直接调用):\n" +
        relatedUtils.map((u) => `  - ${u.name}: ${u.signature}`).join("\n")
      : "";
  return [
    `## 单组件任务`,
    `请只实现组件 \`${spec.name}\`。`,
    `该组件 ${spec.has_internal_state ? "可以" : "不应"}使用内部状态。`,
    `接口契约 (props 名称必须严格一致):`,
    propsLines + utilLines,
  ].join("\n");
}
