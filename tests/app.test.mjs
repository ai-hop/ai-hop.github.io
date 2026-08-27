import test from 'node:test';
import assert from 'node:assert/strict';
import { filterProviders, matchesProvider, normalizeText } from '../app.js';

const fixtures = [
  {
    id: 'router',
    name: 'Agent Router',
    category: 'public',
    status: 'recommended',
    benefits: ['GitHub注册送175刀', '每日登录送25刀'],
    modelsText: '模型：GPT-5.6-sol   Claude Opus 4.8   Claude Opus 5',
    modelTypes: ['OpenAI', 'Claude'],
    benefitTypes: ['注册赠送', '每日签到'],
    requirements: '需要 GitHub 账号',
    note: '',
  },
  {
    id: 'gemini',
    name: 'Refable',
    category: 'public',
    status: 'recommended',
    benefits: ['Gemini羊毛站，可签到'],
    modelsText: '模型：Gemini',
    modelTypes: ['Gemini'],
    benefitTypes: ['每日签到'],
    requirements: '',
    note: '适用于聊天机器人',
  },
  {
    id: 'router-paid',
    name: 'Private Router',
    category: 'router',
    status: 'unknown',
    benefits: ['注册赠送额度'],
    modelsText: '模型信息待补充',
    modelTypes: [],
    benefitTypes: ['注册赠送'],
    requirements: '',
    note: '',
  },
];

test('normalizeText handles nullish values and case', () => {
  assert.equal(normalizeText('  Claude '), 'claude');
  assert.equal(normalizeText(null), '');
});

test('matches provider name without case sensitivity', () => {
  assert.equal(matchesProvider(fixtures[0], 'agent router', {}), true);
  assert.equal(matchesProvider(fixtures[0], '不存在', {}), false);
});

test('matches model names and model type filters', () => {
  assert.equal(matchesProvider(fixtures[0], 'claude opus', {}), true);
  assert.equal(matchesProvider(fixtures[0], '', { modelType: 'Claude' }), true);
  assert.equal(matchesProvider(fixtures[0], '', { modelType: 'Gemini' }), false);
});

test('matches benefits, requirements, and notes', () => {
  assert.equal(matchesProvider(fixtures[0], '175刀', {}), true);
  assert.equal(matchesProvider(fixtures[0], 'github账号', {}), true);
  assert.equal(matchesProvider(fixtures[1], '聊天机器人', {}), true);
});

test('filters by category', () => {
  assert.deepEqual(filterProviders(fixtures, 'router'), [fixtures[2]]);
  assert.deepEqual(filterProviders(fixtures, 'semi-public'), []);
});

test('filters by status and benefit type', () => {
  assert.deepEqual(filterProviders(fixtures, 'public', '', { status: 'recommended' }), [fixtures[0], fixtures[1]]);
  assert.deepEqual(filterProviders(fixtures, 'public', '', { benefitType: '每日签到' }), [fixtures[0], fixtures[1]]);
});

test('combines query and filters with AND semantics', () => {
  assert.deepEqual(filterProviders(fixtures, 'public', 'Claude', { status: 'recommended', modelType: 'Claude' }), [fixtures[0]]);
  assert.deepEqual(filterProviders(fixtures, 'public', 'Claude', { modelType: 'Gemini' }), []);
});

test('returns an empty array when nothing matches', () => {
  assert.deepEqual(filterProviders(fixtures, 'public', '不存在', {}), []);
});
