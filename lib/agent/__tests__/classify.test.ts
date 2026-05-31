import { describe, it, expect } from 'vitest';
import { classifyIntent, parseDispatch } from '../classify';

describe('classifyIntent', () => {
  it('routes bug fixes to engineer only', () => {
    expect(classifyIntent('标题颜色改成红色')).toEqual(['engineer']);
    expect(classifyIntent('修一下按钮的bug')).toEqual(['engineer']);
    expect(classifyIntent('字体太小了调大一点')).toEqual(['engineer']);
  });

  it('routes restructure to architect+engineer', () => {
    expect(classifyIntent('把Header拆成两个组件')).toEqual(['architect', 'engineer']);
    expect(classifyIntent('重构布局结构')).toEqual(['architect', 'engineer']);
  });

  it('routes new features to full pipeline', () => {
    expect(classifyIntent('加一个番茄钟计时功能')).toEqual(['pm', 'architect', 'engineer']);
    expect(classifyIntent('hello world')).toEqual(['pm', 'architect', 'engineer']);
  });
});

describe('parseDispatch', () => {
  it('parses valid dispatch JSON', () => {
    const output = 'ok\n```dispatch\n{"agents": ["engineer"]}\n```';
    expect(parseDispatch(output)).toEqual(['engineer']);
  });

  it('returns null for missing dispatch block', () => {
    expect(parseDispatch('no dispatch here')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseDispatch('```dispatch\n{invalid}\n```')).toBeNull();
  });

  it('parses full pipeline dispatch', () => {
    const output = '```dispatch\n{"agents": ["pm", "architect", "engineer"]}\n```';
    expect(parseDispatch(output)).toEqual(['pm', 'architect', 'engineer']);
  });
});
