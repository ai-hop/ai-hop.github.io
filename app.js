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

export function rateTone(rate) {
  const value = Number.parseFloat(String(rate ?? ''));
  if (!Number.isFinite(value)) return 'default';
  if (value < 1) return 'low';
  if (value > 1) return 'high';
  return 'base';
}

export function benefitText(benefit) {
  return typeof benefit === 'string' ? benefit : String(benefit?.text ?? '');
}

export function formatVerificationDate(value) {
  if (!value) return '待核验';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  return `${match[1]}.${match[2]}.${match[3]}`;
}

export function isExpiredBenefit(benefit) {
  return Boolean(benefit) && typeof benefit === 'object' && Boolean(benefit.expired);
}

export function matchesTaxonomy(values, target) {
  const normalizedTarget = normalizeText(target);
  if (!normalizedTarget || !Array.isArray(values)) return false;
  return values.some((value) => {
    const normalizedValue = normalizeText(value);
    return normalizedValue === normalizedTarget || normalizedValue.startsWith(normalizedTarget);
  });
}

export function matchesProvider(provider, query = '', filters = {}) {
  const searchableContent = [
    provider.name,
    ...(provider.models || []),
    provider.requirements,
    provider.note,
    ...(provider.benefits || []).map(benefitText),
    ...(provider.rates || []).flatMap((entry) => [entry.model, entry.rate]),
  ].map(normalizeText).join(' ');
  const normalizedQuery = normalizeText(query);

  const queryMatches = !normalizedQuery || searchableContent.includes(normalizedQuery);
  const statusMatches = !filters.status || filters.status === 'all' || provider.status === filters.status;
  const modelMatches = !filters.modelType || filters.modelType === 'all' || matchesTaxonomy(provider.modelTypes, filters.modelType);
  const benefitMatches = !filters.benefitType || filters.benefitType === 'all' || matchesTaxonomy(provider.benefitTypes, filters.benefitType);

  return queryMatches && statusMatches && modelMatches && benefitMatches;
}

const statusOrder = Object.keys(statuses);

export function statusRank(status) {
  const index = statusOrder.indexOf(status);
  return index === -1 ? statusOrder.length : index;
}

function ratingValue(rating) {
  const value = Number(rating);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 3;
}

export function sortByStatus(providerList) {
  return [...providerList].sort((a, b) => {
    const statusDifference = statusRank(a.status) - statusRank(b.status);
    if (statusDifference !== 0) return statusDifference;
    return ratingValue(b.rating) - ratingValue(a.rating);
  });
}

export function filterProviders(providerList, activeCategory, query = '', filters = {}) {
  return sortByStatus(
    providerList.filter((provider) => provider.category === activeCategory && matchesProvider(provider, query, filters)),
  );
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

  function ratingMarkup(rating) {
    const value = ratingValue(rating);
    return `<span class="provider-rating" role="img" aria-label="推荐程度：${value} 星"><span aria-hidden="true">${'★'.repeat(value)}${'☆'.repeat(5 - value)}</span></span>`;
  }

  function verificationMarkup(provider) {
    const isVerified = Boolean(provider.benefitVerifiedAt);
    return `<p class="verification-meta ${isVerified ? 'is-verified' : 'is-pending'}">
      <span class="verification-mark" aria-hidden="true">${isVerified ? '✓' : '↻'}</span>
      <span class="verification-label">福利验证</span>
      <strong>${escapeHtml(formatVerificationDate(provider.benefitVerifiedAt))}</strong>
    </p>`;
  }

  function providerCard(provider, index) {
    const benefits = (provider.benefits || []).map((benefit) => {
      const isExpired = isExpiredBenefit(benefit);
      return `<li${isExpired ? ' class="benefit-expired"' : ''}>${escapeHtml(benefitText(benefit))}${isExpired ? '<span class="sr-only">（已结束）</span>' : ''}</li>`;
    }).join('');
    const models = Array.isArray(provider.models) ? provider.models : [];
    const modelContent = models.length
      ? `<div class="model-tags" aria-label="支持的模型">${models.map((model) => {
          const tone = modelTagTone(model);
          return `<span class="model-tag model-tag-${tone}"><span class="model-icon" aria-hidden="true">${modelTagIcon(tone)}</span><span>${escapeHtml(model)}</span></span>`;
        }).join('')}</div>`
      : '<p class="model-empty">模型信息待补充</p>';
    const rates = Array.isArray(provider.rates) ? provider.rates : [];
    const rateContent = rates.length
      ? `<span class="rate-label">倍率</span>
        <div class="rate-row" aria-label="计费倍率">${rates.map((entry) => `
          <span class="rate-pill rate-pill-${modelTagTone(entry.model)}">
            <span class="rate-model">${escapeHtml(entry.model)}</span>
            <span class="rate-value">${escapeHtml(entry.rate)}</span>
          </span>`).join('')}</div>`
      : '';
    const optionalInfo = [...formatRequirements(provider.requirements), provider.note]
      .filter(Boolean)
      .map((content) => `<p class="provider-detail">${escapeHtml(content)}</p>`)
      .join('');

    return `
      <li class="provider-card" style="--card-index: ${index}">
        <div class="provider-topline">
          <div class="name-line">
            <h2>${escapeHtml(provider.name)}</h2>
            <span class="status-badge ${statusClass[provider.status]}"><span></span>${escapeHtml(statuses[provider.status])}</span>
            ${ratingMarkup(provider.rating)}
          </div>
          <a class="visit-button" href="${escapeHtml(provider.url)}" target="_blank" rel="noopener noreferrer">
            <span>打开站点</span><span class="arrow" aria-hidden="true">↗</span>
          </a>
        </div>
        <ul class="benefit-list">${benefits}</ul>
        ${verificationMarkup(provider)}
        <div class="provider-models">
          <span class="models-label">模型</span>
          ${modelContent}
          ${rateContent}
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

  function activeFilterLabels() {
    return [
      state.query ? `“${state.query}”` : '',
      state.status !== 'all' ? statuses[state.status] : '',
      state.modelType !== 'all' ? state.modelType : '',
      state.benefitType !== 'all' ? state.benefitType : '',
    ].filter(Boolean);
  }

  function syncControls() {
    elements.search.value = state.query;
    elements.status.value = state.status;
    elements.model.value = state.modelType;
    elements.benefit.value = state.benefitType;
    elements.tabs.querySelectorAll('[data-category]').forEach((tab) => {
      const isActive = tab.dataset.category === state.activeCategory;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-pressed', String(isActive));
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
    const filterLabels = activeFilterLabels();

    elements.list.innerHTML = visibleProviders.map(providerCard).join('');
    elements.list.classList.toggle('is-hidden', visibleProviders.length === 0);
    elements.empty.classList.toggle('is-hidden', visibleProviders.length > 0);
    elements.emptyTitle.textContent = isEmptyCategory ? '这里还没有站点' : '没有找到匹配站点';
    elements.emptyCopy.textContent = isEmptyCategory
      ? `${categories[state.activeCategory]}暂未收录站点，之后会继续补充。`
      : '试试换个关键词，或清除当前筛选条件。';
    elements.summary.textContent = isEmptyCategory
      ? `${categories[state.activeCategory]} · 暂无收录`
      : `显示 ${visibleProviders.length} 个站点 · ${categories[state.activeCategory]}${filterLabels.length ? ` · ${filterLabels.join(' · ')}` : ''}`;
    elements.clear.classList.toggle('is-hidden', !hasActiveFilter());
    syncControls();

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
