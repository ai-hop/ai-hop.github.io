import test from 'node:test';
import assert from 'node:assert/strict';
import { filterProviders, formatRequirements, formatVerificationDate, matchesProvider, matchesTaxonomy, normalizeText, sortByStatus } from '../app.js';

const fixtures = [
  {
    id: 'router',
    name: 'Agent Router',
    category: 'public',
    status: 'recommended',
    benefits: ['GitHub注册送175刀', '每日登录送25刀'],
    models: ['GPT-5.6-sol', 'Claude Opus 4.8', 'Claude Opus 5'],
    modelTypes: ['OpenAI', 'Claude'],
    benefitTypes: ['注册赠送', '每日签到'],
    requirements: '注册门槛：需要 GitHub 账号\n使用门槛：使用人多需要挤',
    note: '',
  },
  {
    id: 'gemini',
    name: 'Refable',
    category: 'public',
    status: 'recommended',
    benefits: ['Gemini羊毛站，可签到'],
    models: ['Gemini'],
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
    models: [],
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

test('keeps every model name in the data array unchanged', () => {
  assert.deepEqual(fixtures[0].models, ['GPT-5.6-sol', 'Claude Opus 4.8', 'Claude Opus 5']);
});

test('merges registration and usage thresholds into one restriction line', () => {
  assert.deepEqual(formatRequirements('注册门槛：仅支持 LinuxDo 注册\n使用门槛：使用人多需要挤'), [
    '限制：仅支持 LinuxDo 注册，使用人多需要挤',
  ]);
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

test('matches taxonomy filters with compact variants', () => {
  assert.equal(matchesTaxonomy(['每日签到(0-2刀)'], '每日签到'), true);
  assert.equal(matchesTaxonomy(['Claude'], 'OpenAI'), false);
});

test('formats benefit verification dates to day precision', () => {
  assert.equal(formatVerificationDate('2026-09-01'), '2026.09.01');
  assert.equal(formatVerificationDate('2026-09-01 11:23'), '2026.09.01');
  assert.equal(formatVerificationDate(null), '待核验');
});

test('matches benefits, requirements, and notes', () => {
  assert.equal(matchesProvider(fixtures[0], '175刀', {}), true);
  assert.equal(matchesProvider(fixtures[0], 'github账号', {}), true);
  assert.equal(matchesProvider(fixtures[0], '使用人多需要挤', {}), true);
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

test('sortByStatus orders by recommendation level without mutating the input', () => {
  const mixed = [
    { id: 'a', status: 'not-recommended' },
    { id: 'b', status: 'average' },
    { id: 'c', status: 'unknown' },
    { id: 'd', status: 'recommended' },
  ];

  assert.deepEqual(sortByStatus(mixed).map((provider) => provider.id), ['d', 'b', 'a', 'c']);
  assert.deepEqual(mixed.map((provider) => provider.id), ['a', 'b', 'c', 'd']);
});

test('sortByStatus ranks ratings within the same status without mutating input', () => {
  const mixed = [
    { id: 'recommended-3', status: 'recommended', rating: 3 },
    { id: 'recommended-5', status: 'recommended', rating: 5 },
    { id: 'average-5', status: 'average', rating: 5 },
    { id: 'recommended-4', status: 'recommended', rating: 4 },
  ];

  assert.deepEqual(
    sortByStatus(mixed).map((provider) => provider.id),
    ['recommended-5', 'recommended-4', 'recommended-3', 'average-5'],
  );
  assert.deepEqual(mixed.map((provider) => provider.id), [
    'recommended-3',
    'recommended-5',
    'average-5',
    'recommended-4',
  ]);
});

test('sortByStatus defaults missing or invalid ratings to three stars and preserves ties', () => {
  const mixed = [
    { id: 'missing', status: 'recommended' },
    { id: 'invalid', status: 'recommended', rating: 9 },
    { id: 'three', status: 'recommended', rating: 3 },
    { id: 'same', status: 'recommended', rating: 3 },
  ];

  assert.deepEqual(
    sortByStatus(mixed).map((provider) => provider.id),
    ['missing', 'invalid', 'three', 'same'],
  );
});

test('sortByStatus keeps data order within the same level and puts unknown statuses last', () => {
  const sameLevel = [
    { id: 'first', status: 'recommended' },
    { id: 'second', status: 'recommended' },
    { id: 'legacy', status: 'retired' },
    { id: 'third', status: 'recommended' },
  ];

  assert.deepEqual(sortByStatus(sameLevel).map((provider) => provider.id), ['first', 'second', 'third', 'legacy']);
});

test('filterProviders returns recommended sites before lower levels', () => {
  const ranked = [
    { id: 'unknown-site', category: 'public', status: 'unknown', benefits: [] },
    { id: 'weak-site', category: 'public', status: 'not-recommended', benefits: [] },
    { id: 'ok-site', category: 'public', status: 'average', benefits: [] },
    { id: 'top-site', category: 'public', status: 'recommended', benefits: [] },
  ];

  assert.deepEqual(
    filterProviders(ranked, 'public').map((provider) => provider.id),
    ['top-site', 'ok-site', 'weak-site', 'unknown-site'],
  );
});
