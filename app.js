import { categories, providers, statuses } from './data/providers.js';

export function normalizeText(value) {
  return String(value ?? '').toLocaleLowerCase().replace(/\s+/g, '');
}

export function formatRequirements(requirements) {
  const lines = String(requirements ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const restrictionParts = [];
  const otherLines = [];

  lines.forEach((line) => {
    const match = line.match(/^(?:注册门槛|使用门槛|限制)：?\s*(.*)$/);
    if (match) restrictionParts.push(match[1]);
    else otherLines.push(line);
  });

  return [
    ...(restrictionParts.length ? [`限制：${restrictionParts.join('，')}`] : []),
    ...otherLines,
  ];
}

function modelTagTone(model) {
  const normalizedModel = normalizeText(model);
  if (normalizedModel.includes('deepseek')) return 'deepseek';
  if (normalizedModel.includes('glm') || normalizedModel.includes('qwen')) return '国产';
  if (normalizedModel.includes('gpt')) return 'gpt';
  if (normalizedModel.includes('claudeopus5')) return 'claude-new';
  if (normalizedModel.includes('claude')) return 'claude';
  if (normalizedModel.includes('gemini')) return 'gemini';
  return 'default';
}

function modelTagIcon(tone) {
  return {
    claude: '✳',
    'claude-new': '✳',
    deepseek: '◈',
    国产: '⁙',
    gpt: '◉',
    gemini: '✦',
    default: '•',
  }[tone];
}

function arrayIncludesNormalized(values, target) {
  return Array.isArray(values) && values.some((value) => normalizeText(value) === normalizeText(target));
}

export function matchesProvider(provider, query = '', filters = {}) {
  const searchableContent = [
    provider.name,
    ...(provider.models || []),
    provider.requirements,
    provider.note,
    ...(provider.benefits || []),
  ].map(normalizeText).join(' ');
  const normalizedQuery = normalizeText(query);

  const queryMatches = !normalizedQuery || searchableContent.includes(normalizedQuery);
  const statusMatches = !filters.status || filters.status === 'all' || provider.status === filters.status;
  const modelMatches = !filters.modelType || filters.modelType === 'all' || arrayIncludesNormalized(provider.modelTypes, filters.modelType);
  const benefitMatches = !filters.benefitType || filters.benefitType === 'all' || arrayIncludesNormalized(provider.benefitTypes, filters.benefitType);

  return queryMatches && statusMatches && modelMatches && benefitMatches;
}

export function filterProviders(providerList, activeCategory, query = '', filters = {}) {
  return providerList.filter((provider) => provider.category === activeCategory && matchesProvider(provider, query, filters));
}

const domAvailable = typeof document !== 'undefined';

if (domAvailable) {
  const elements = {
    tabs: document.querySelector('#category-tabs'),
    search: document.querySelector('#search-input'),
    status: document.querySelector('#status-filter'),
    model: document.querySelector('#model-filter'),
    benefit: document.querySelector('#benefit-filter'),
    list: document.querySelector('#provider-list'),
    empty: document.querySelector('#empty-state'),
    emptyTitle: document.querySelector('#empty-title'),
    emptyCopy: document.querySelector('#empty-copy'),
    summary: document.querySelector('#result-summary'),
    clear: document.querySelector('#clear-filters'),
  };

  const state = {
    activeCategory: 'public',
    query: '',
    status: 'all',
    modelType: 'all',
    benefitType: 'all',
  };

  const statusClass = {
    recommended: 'status-recommended',
    average: 'status-average',
    'not-recommended': 'status-not-recommended',
    unknown: 'status-unknown',
  };

  const hasActiveFilter = () => Boolean(state.query || state.status !== 'all' || state.modelType !== 'all' || state.benefitType !== 'all');

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function providerCard(provider, index) {
    const benefits = provider.benefits.map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join('');
    const models = Array.isArray(provider.models) ? provider.models : [];
    const modelContent = models.length
      ? `<div class="model-tags" aria-label="支持的模型">${models.map((model) => {
          const tone = modelTagTone(model);
          return `<span class="model-tag model-tag-${tone}"><span class="model-icon" aria-hidden="true">${modelTagIcon(tone)}</span><span>${escapeHtml(model)}</span></span>`;
        }).join('')}</div>`
      : '<p class="model-empty">模型信息待补充</p>';
    const optionalInfo = [...formatRequirements(provider.requirements), provider.note]
      .filter(Boolean)
      .filter(Boolean)
      .map((content) => `<p class="provider-detail">${escapeHtml(content)}</p>`)
      .join('');

    return `
      <li class="provider-card" style="--card-index: ${index}">
        <div class="provider-topline">
          <div class="name-line">
            <h3>${escapeHtml(provider.name)}</h3>
            <span class="status-badge ${statusClass[provider.status]}"><span></span>${escapeHtml(statuses[provider.status])}</span>
          </div>
          <a class="visit-button" href="${escapeHtml(provider.url)}" target="_blank" rel="noopener noreferrer">
            <span>访问</span><span class="arrow" aria-hidden="true">↗</span>
          </a>
        </div>
        <ul class="benefit-list">${benefits}</ul>
        <div class="provider-models">
          <span class="models-label">模型</span>
          ${modelContent}
        </div>
        ${optionalInfo}
      </li>
    `;
  }

  function updateCategoryCounts() {
    Object.keys(categories).forEach((category) => {
      const count = providers.filter((provider) => provider.category === category).length;
      const target = document.querySelector(`[data-count="${category}"]`);
      if (target) target.textContent = count;
    });
  }

  function render() {
    const filters = {
      status: state.status,
      modelType: state.modelType,
      benefitType: state.benefitType,
    };
    const categoryProviders = providers.filter((provider) => provider.category === state.activeCategory);
    const visibleProviders = filterProviders(providers, state.activeCategory, state.query, filters);
    const isEmptyCategory = categoryProviders.length === 0;
    const isFilteredEmpty = !isEmptyCategory && visibleProviders.length === 0;

    elements.list.innerHTML = visibleProviders.map(providerCard).join('');
    elements.list.classList.toggle('is-hidden', visibleProviders.length === 0);
    elements.empty.classList.toggle('is-hidden', visibleProviders.length > 0);
    elements.emptyTitle.textContent = isEmptyCategory ? '这里还没有站点' : '没有找到匹配站点';
    elements.emptyCopy.textContent = isEmptyCategory
      ? `${categories[state.activeCategory]}暂未收录站点，之后会继续补充。`
      : '试试换个关键词，或清除当前筛选条件。';
    elements.summary.textContent = isEmptyCategory
      ? `${categories[state.activeCategory]} · 暂无收录`
      : `显示 ${visibleProviders.length} 个站点 · ${categories[state.activeCategory]}`;
    elements.clear.classList.toggle('is-hidden', !hasActiveFilter());
    elements.tabs.querySelectorAll('[data-category]').forEach((tab) => {
      const isActive = tab.dataset.category === state.activeCategory;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    if (isFilteredEmpty) elements.empty.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  elements.tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-category]');
    if (!tab) return;
    state.activeCategory = tab.dataset.category;
    render();
  });

  elements.search.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });

  [[elements.status, 'status'], [elements.model, 'modelType'], [elements.benefit, 'benefitType']].forEach(([element, key]) => {
    element.addEventListener('change', (event) => {
      state[key] = event.target.value;
      render();
    });
  });

  elements.clear.addEventListener('click', () => {
    state.query = '';
    state.status = 'all';
    state.modelType = 'all';
    state.benefitType = 'all';
    elements.search.value = '';
    elements.status.value = 'all';
    elements.model.value = 'all';
    elements.benefit.value = 'all';
    render();
    elements.search.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
      event.preventDefault();
      elements.search.focus();
    }
  });

  updateCategoryCounts();
  render();
}
