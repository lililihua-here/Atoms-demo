import { describe, it, expect } from 'vitest';
import { extractCode, validateCode } from '../extract-code';

describe('extractCode', () => {
  it('extracts jsx fenced code block', () => {
    const input = 'Some text\n```jsx\nfunction App() { return <div>Hello</div>; }\n```\nMore text';
    const result = extractCode(input);
    expect(result).toContain('function App()');
    expect(result).toContain('<div>Hello</div>');
  });

  it('extracts code block without language specifier', () => {
    const input = '```\nfunction App() { return <div>Hi</div>; }\n```';
    const result = extractCode(input);
    expect(result).toBe('function App() { return <div>Hi</div>; }');
  });

  it('returns null for empty input', () => {
    expect(extractCode('')).toBeNull();
    expect(extractCode('just some text without code')).toBeNull();
  });

  it('detects raw function App without fenced block', () => {
    const input = 'function App() { return <div>Raw</div>; }';
    const result = extractCode(input);
    expect(result).toContain('function App');
    expect(result).toContain('<div>Raw</div>');
  });

  it('rejects code blocks shorter than 20 chars', () => {
    const input = '```jsx\nshort\n```';
    expect(extractCode(input)).toBeNull();
  });

  it('handles tsx language tag', () => {
    const input = '```tsx\nfunction App() { return <div>TSX</div>; }\n```';
    const result = extractCode(input);
    expect(result).toContain('function App');
  });
});

describe('validateCode', () => {
  it('passes valid code', () => {
    const code = `function App() { return <div>Hi</div>; }
var __root = ReactDOM.createRoot(document.getElementById('root'));
__root.render(React.createElement(App));`;
    const result = validateCode(code);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects missing App component', () => {
    const code = 'function NotApp() { return <div/>; }';
    const result = validateCode(code);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.includes('App'))).toBe(true);
  });

  it('detects unbalanced braces', () => {
    const code = 'function App() { return <div>;';
    const result = validateCode(code);
    expect(result.issues.some(i => i.includes('括号') || i.includes('brace'))).toBe(true);
  });
});
