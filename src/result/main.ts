// 투표 결과 페이지 (/result). npm run export가 만든 public/result/stats.csv(스타일별 득표 수)만 읽는다.
import { STYLES } from '../styles';

const $ = (id: string) => document.getElementById(id)!;
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function el(tag: string, className?: string, ...children: (Node | string | null)[]) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children.filter((c): c is Node | string => c != null));
  return node;
}

// styleId,styleName,votes — styleName에 쉼표가 있어도 첫 칸과 마지막 칸만 쓰면 된다
async function loadCounts(): Promise<Map<string, number> | null> {
  const res = await fetch('/result/stats.csv', { cache: 'no-store' });
  if (!res.ok) return null;
  const [header, ...lines] = (await res.text()).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  // 개발 서버는 없는 파일에도 index.html을 돌려준다
  if (!header?.startsWith('styleId,')) return null;
  return new Map(
    lines.map((line) => {
      const cells = line.split(',');
      return [cells[0], Number(cells.at(-1)) || 0];
    }),
  );
}

function render(counts: Map<string, number>) {
  const total = STYLES.reduce((sum, s) => sum + (counts.get(s.id) ?? 0), 0);
  const max = Math.max(0, ...STYLES.map((s) => counts.get(s.id) ?? 0));
  const top = STYLES.filter((s) => max > 0 && counts.get(s.id) === max);

  $('t-votes').textContent = String(total);
  $('t-top').replaceChildren(top.length ? top.map((s) => s.name).join(', ') : '–', top.length ? el('small', '', `${max}표`) : '');
  $('sub').textContent = `총 ${total}표`;
  $('bars').replaceChildren(
    ...STYLES.map((s) => {
      const value = counts.get(s.id) ?? 0;
      const fill = el('div', `bar-fill${value ? '' : ' zero'}`);
      fill.style.width = `calc((100% - 64px) * ${max ? value / max : 0})`;
      const img = document.createElement('img');
      img.src = s.image;
      img.alt = '';
      return el('div', 'bar-row',
        el('div', 'bar-label', img, el('span', '', s.name)),
        el('div', 'bar-track', fill, el('span', 'bar-value', `${value}표`, el('span', 'pct', `${pct(value, total)}%`))),
      );
    }),
  );
}

loadCounts()
  .then((counts) => {
    if (counts) render(counts);
    else $('bars').replaceChildren(el('p', 'empty', '아직 집계된 결과가 없어요'));
  })
  .catch(() => $('bars').replaceChildren(el('p', 'empty', '결과를 불러오지 못했어요')));
