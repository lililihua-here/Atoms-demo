// lib/agent/extract-code.ts
// Code extraction and validation utilities

// Validate extracted code for common issues
export function validateCode(code: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!code || code.length < 20) issues.push("代码过短");
  if (!/function\s+App\s*\(/.test(code) && !/const\s+App\s*=/.test(code))
    issues.push("缺少 App 组件定义");
  if (!/ReactDOM\.createRoot|__root\.render/.test(code))
    issues.push("缺少挂载代码 (ReactDOM.createRoot)");
  // Check bracket balance
  let brace = 0, paren = 0;
  for (const ch of code) {
    if (ch === '{') brace++;
    if (ch === '}') brace--;
    if (ch === '(') paren++;
    if (ch === ')') paren--;
  }
  if (brace !== 0) issues.push(`花括号不平衡 (差值: ${brace})`);
  if (paren !== 0) issues.push(`圆括号不平衡 (差值: ${paren})`);
  return { ok: issues.length === 0, issues };
}

// Extract JSX code from markdown output
export function extractCode(markdown: string): string | null {
  if (!markdown) return null;

  // Try fenced code block with language specifier
  let m = markdown.match(/```(?:jsx|js|javascript|tsx|react)\s*\n([\s\S]*?)```/i);
  if (m && m[1] && m[1].trim().length > 20) {
    console.log("extractCode: found fenced block with lang, length:", m[1].trim().length);
    return m[1].trim();
  }

  // Try any fenced block (no language specifier)
  m = markdown.match(/```\s*\n([\s\S]*?)```/);
  if (m && m[1] && m[1].trim().length > 20) {
    console.log("extractCode: found fenced block without lang, length:", m[1].trim().length);
    return m[1].trim();
  }

  // Try to extract from "function App" or "const App" — remove markdown around it
  const appIdx = markdown.search(/(?:^|\n)\s*(?:function\s+App\s*\(|const\s+App\s*=)/m);
  if (appIdx >= 0) {
    const code = markdown.substring(appIdx).trim();
    console.log("extractCode: raw app code detected, length:", code.length);
    return code;
  }

  // Last resort: any function definition (for single-component mode)
  const fnIdx = markdown.search(/(?:^|\n)\s*function\s+\w+\s*\(/m);
  if (fnIdx >= 0) {
    const code = markdown.substring(fnIdx).trim();
    console.log("extractCode: raw function detected, length:", code.length);
    return code;
  }

  console.log("extractCode: no code found in output. First 200 chars:", markdown.substring(0, 200));
  return null;
}
