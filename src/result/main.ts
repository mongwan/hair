// 투표 결과 페이지 (/result). npm run export가 만든 public/result/stats.csv(출처 × 스타일 득표 수)만 읽는다.
import { STYLES } from '../styles';

type Counts = Map<string, number>; // styleId → 표 수

const ALL = '__all__';
let bySource = new Map<string, Counts>();
let selected = ALL;

const $ = (id: string) => document.getElementById(id)!;
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const sum = (counts: Counts) => [...counts.values()].reduce((a, b) => a + b, 0);

function el(tag: string, attrs: Record<string, string | (() => void)> = {}, ...children: (Node | string | null)[]) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') node.addEventListener(k.replace(/^on/, ''), v);
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c): c is Node | string => c != null));
  return node;
}

// source,styleId,styleName,votes — styleName에 쉼표가 있어도 앞 두 칸과 마지막 칸만 쓰면 된다
async function load(): Promise<Map<string, Counts> | null> {
  const res = await fetch('/result/stats.csv', { cache: 'no-store' });
  if (!res.ok) return null;
  const [header, ...lines] = (await res.text()).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  // 개발 서버는 없는 파일에도 index.html을 돌려준다
  if (!header?.startsWith('source,')) return null;
  const result = new Map<string, Counts>();
  for (const line of lines) {
    const cells = line.split(',');
    const counts = result.get(cells[0]) ?? new Map();
    counts.set(cells[1], Number(cells.at(-1)) || 0);
    result.set(cells[0], counts);
  }
  return result;
}

// ---------- 집계 ----------
function countsFor(source: string): Counts {
  const result: Counts = new Map(STYLES.map((s) => [s.id, 0]));
  for (const [src, counts] of bySource) {
    if (source !== ALL && src !== source) continue;
    for (const [id, n] of counts) result.set(id, (result.get(id) ?? 0) + n);
  }
  return result;
}

const sources = () =>
  [...bySource.entries()].map(([s, c]) => [s, sum(c)] as const).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

// ---------- 렌더 ----------
function select(source: string) {
  selected = selected === source ? ALL : source;
  render();
}

function barRow(label: string, value: number, total: number, max: number, opts: { image?: string; onclick?: () => void } = {}) {
  const fill = el('div', { class: `bar-fill${value ? '' : ' zero'}` });
  fill.style.width = `calc((100% - 64px) * ${max ? value / max : 0})`;
  const row = el('div', { class: `bar-row${opts.onclick ? ' clickable' : ''}`, ...(opts.onclick ? { onclick: opts.onclick, role: 'button', tabindex: '0' } : {}) },
    el('div', { class: 'bar-label' }, opts.image ? el('img', { src: opts.image, alt: '' }) : null, el('span', {}, label)),
    el('div', { class: 'bar-track' }, fill, el('span', { class: 'bar-value' }, `${value}표`, el('span', { class: 'pct' }, `${pct(value, total)}%`))),
  );
  if (opts.onclick) {
    const onclick = opts.onclick;
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick(); } });
  }
  return row;
}

function render() {
  const counts = countsFor(selected);
  const total = sum(counts);
  const max = Math.max(0, ...counts.values());
  const all = countsFor(ALL);
  const grandTotal = sum(all);
  const srcList = sources();

  // 필터 칩
  const chip = (value: string, label: string, n: number) =>
    el('button', { type: 'button', class: 'chip', 'aria-pressed': String(selected === value), onclick: () => { selected = value; render(); } },
      label, el('span', { class: 'n' }, `${n}표`));
  $('filters').replaceChildren(chip(ALL, '전체', grandTotal), ...srcList.map(([s, n]) => chip(s, s, n)));

  // 요약
  $('t-votes').textContent = String(total);
  const top = STYLES.filter((s) => max > 0 && counts.get(s.id) === max);
  $('t-top').replaceChildren(top.length ? top.map((s) => s.name).join(', ') : '–', top.length ? el('small', {}, `${max}표`) : '');

  // 스타일별 막대
  $('style-sub').textContent = `${selected === ALL ? '전체 출처' : `from=${selected}`} · 총 ${total}표`;
  $('style-bars').replaceChildren(
    ...STYLES.map((s) => barRow(s.name, counts.get(s.id) ?? 0, total, max, { image: s.image })),
  );

  // 출처별 막대
  const srcMax = Math.max(0, ...srcList.map(([, n]) => n));
  $('source-bars').replaceChildren(
    ...srcList.map(([s, n]) => {
      const row = barRow(s, n, grandTotal, srcMax, { onclick: () => select(s) });
      if (selected !== ALL && selected !== s) row.classList.add('dim');
      return row;
    }),
  );

  // 출처 × 스타일 표
  const head = el('tr', {}, el('th', {}, '출처'), ...STYLES.map((s) => el('th', {}, s.name)), el('th', {}, '합계'));
  const body = srcList.map(([s, n]) => {
    const c = countsFor(s);
    const rowMax = Math.max(0, ...c.values());
    return el('tr', { class: selected === s ? 'active' : '', onclick: () => select(s) },
      el('td', {}, s),
      ...STYLES.map((st) => el('td', { class: rowMax && c.get(st.id) === rowMax ? 'max' : '' }, String(c.get(st.id) ?? 0))),
      el('td', {}, String(n)),
    );
  });
  const foot = el('tr', {}, el('td', {}, '합계'), ...STYLES.map((s) => el('td', {}, String(all.get(s.id) ?? 0))), el('td', {}, String(grandTotal)));
  $('matrix').replaceChildren(el('thead', {}, head), el('tbody', {}, ...body), el('tfoot', {}, foot));
}

load()
  .then((data) => {
    if (!data?.size) {
      $('empty').hidden = false;
      return;
    }
    bySource = data;
    $('content').hidden = false;
    render();
  })
  .catch(() => {
    $('empty').textContent = '결과를 불러오지 못했어요';
    $('empty').hidden = false;
  });
