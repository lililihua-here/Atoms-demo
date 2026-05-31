// lib/agent/run-parallel.ts
import { extractContractWithRepair, validateContract, buildSubtasks } from "./contract";
import { mergeComponents, validateSyntax } from "./merge";
import { ENGINEER_SYSTEM } from "./prompts";
import { ENGINEER_CONCURRENCY, SUBTASK_TIMEOUT_MS, MIN_LEAVES_FOR_PARALLEL } from "./constants";
import { genComponent, withTimeout, runWithConcurrency, architectContractUtilities } from "./stream-agent";
import type { PipelineContext, AgentDocument, PipelineCallbacks } from "@/lib/models/types";

// Attempt parallel Engineer flow. Returns merged code on success, null to signal fallback to serial.
export async function runEngineerParallel(
  architectOutput: string,
  architectSummary: string,
  ctx: PipelineContext,
  allDocs: AgentDocument[],
  cbs: PipelineCallbacks
): Promise<string | null> {
  const contractResult = extractContractWithRepair(architectOutput);
  if (!contractResult.contract) {
    console.log("runEngineerParallel: no valid contract in architect output:", contractResult.error);
    return null;
  }
  if (contractResult.repaired) {
    console.log("runEngineerParallel: using repaired contract");
  }
  const contract = contractResult.contract;
  const issues = validateContract(contract);
  if (issues.length > 0) console.log("Contract issues:", issues);
  const subtasks = buildSubtasks(contract);
  if (subtasks.length < MIN_LEAVES_FOR_PARALLEL) {
    console.log("runEngineerParallel: only", subtasks.length, "parallelizable leaves, need", MIN_LEAVES_FOR_PARALLEL);
    return null;
  }

  architectContractUtilities.length = 0;
  if (contract.shared_utilities) {
    Array.prototype.push.apply(architectContractUtilities, contract.shared_utilities);
  }

  cbs.onParallelStart(subtasks.map((t) => ({
    componentName: t.componentName,
    status: "running",
  })));

  const settled = await runWithConcurrency(
    subtasks,
    ENGINEER_CONCURRENCY,
    async (task) => {
      const userContent = buildSubtaskContent(task, ctx, allDocs, architectSummary);
      return withTimeout(
        genComponent(ENGINEER_SYSTEM, userContent),
        SUBTASK_TIMEOUT_MS,
        `Component ${task.componentName}`
      );
    }
  );

  const results: { componentName: string; output: string; ok: boolean }[] = subtasks.map((task, i) => {
    const r = settled[i];
    if (r && r.status === "fulfilled") {
      cbs.onParallelUpdate({ componentName: task.componentName, status: "success" });
      return { componentName: task.componentName, output: r.value, ok: true };
    }
    cbs.onParallelUpdate({ componentName: task.componentName, status: "failed" });
    return { componentName: task.componentName, output: "", ok: false };
  });

  const failed = results.filter((r) => !r.ok).length;
  if (failed * 2 > results.length) {
    cbs.onParallelEnd();
    return null; // Majority failure → fallback to serial
  }

  const merged = mergeComponents(results, contract);
  if (!validateSyntax(merged)) {
    cbs.onParallelEnd();
    return null;
  }

  // Check that we got at least one real component function (not just placeholders)
  const realCount = contract.components
    .filter((c) => c.type === "leaf")
    .filter((c) => merged.includes(`function ${c.name}`)).length;
  if (realCount === 0) {
    console.log("All parallel components are placeholders, falling back to serial");
    cbs.onParallelEnd();
    return null;
  }

  for (const r of results) {
    if (!r.ok) cbs.onParallelUpdate({ componentName: r.componentName, status: "placeholder" });
  }
  cbs.onParallelEnd();
  return merged;
}

export function buildSubtaskContent(
  task: any,
  ctx: PipelineContext,
  allDocs: AgentDocument[],
  architectSummary: string
): string {
  const parts: string[] = [];
  parts.push(`## 单组件任务\n组件名: ${task.componentName}\n\n${task.prompt}`);
  const pmSummary = allDocs.find((d) => d.agent_role === "pm")?.summary;
  if (pmSummary) parts.push(`## 产品背景\n${pmSummary}`);
  if (architectSummary) parts.push(`## 设计约束\n${architectSummary.slice(0, 1200)}`);
  return parts.join("\n\n");
}
