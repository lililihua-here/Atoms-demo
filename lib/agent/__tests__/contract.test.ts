import { describe, it, expect } from 'vitest';
import { extractContract, buildSubtasks, validateContract } from '../contract';

const validContractJson = JSON.stringify({
  components: [
    { name: 'Header', type: 'leaf', props: [{ name: 'title', type: 'string', required: true }], has_internal_state: false, dependencies: [] },
    { name: 'Main', type: 'layout', props: [], has_internal_state: false, dependencies: ['Header'] },
    { name: 'Footer', type: 'leaf', props: [], has_internal_state: false, dependencies: [] },
  ],
  shared_utilities: [],
});

describe('extractContract', () => {
  it('parses valid json contract', () => {
    const md = 'Some text\n```json\n' + validContractJson + '\n```\nMore text';
    const contract = extractContract(md);
    expect(contract).not.toBeNull();
    expect(contract!.components).toHaveLength(3);
  });

  it('returns null for empty input', () => {
    expect(extractContract('')).toBeNull();
    expect(extractContract('no json here')).toBeNull();
  });
});

describe('buildSubtasks', () => {
  it('builds subtasks for leaf components without dependencies', () => {
    const contract = extractContract('```json\n' + validContractJson + '\n```')!;
    const subtasks = buildSubtasks(contract);
    expect(subtasks).toHaveLength(2); // Header and Footer, not Main (layout)
    expect(subtasks[0].componentName).toBe('Header');
    expect(subtasks[1].componentName).toBe('Footer');
  });
});

describe('validateContract', () => {
  it('passes valid contract', () => {
    const contract = extractContract('```json\n' + validContractJson + '\n```')!;
    expect(validateContract(contract)).toHaveLength(0);
  });

  it('detects missing components', () => {
    expect(validateContract({ components: [], shared_utilities: [] })).toContain('contract has no components');
  });
});
