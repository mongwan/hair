// Firestore의 투표·코멘트를 CSV로 내려받는다 (관리자 권한이라 보안 규칙과 무관)
// 실행: npm run export → exports/votes.csv, exports/comments.csv (개인용, git 제외)
//                       + public/result/stats.csv (출처 × 스타일 득표 수만, 배포해서 /result에서 보는 용도)
import { mkdirSync, writeFileSync } from 'node:fs';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { STYLES } from '../src/styles.ts';

const projectId = process.env.GCLOUD_PROJECT ?? 'hair-d2632';
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const OUT_DIR = 'exports';
const STATS_DIR = 'public/result';
const styleName = new Map(STYLES.map((s) => [s.id, s.name]));

const formatValue = (v: unknown): string => {
  if (v == null) return '';
  if (v instanceof Timestamp) {
    return v.toDate().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
  }
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

const toCsv = (rows: Record<string, unknown>[]): string => {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    const s = formatValue(v);
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))];
  // BOM: 엑셀에서 한글이 깨지지 않도록
  return '﻿' + lines.join('\r\n') + '\r\n';
};

async function exportCollection(
  name: string,
  mapRow: (data: Record<string, unknown>) => Record<string, unknown> = (d) => d,
) {
  const snap = await db.collection(name).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...mapRow(d.data()) }));
  writeFileSync(`${OUT_DIR}/${name}.csv`, toCsv(rows));
  console.log(`${name}: ${rows.length}건 → ${OUT_DIR}/${name}.csv`);
  return rows;
}

mkdirSync(OUT_DIR, { recursive: true });

const votes = await exportCollection('votes', (d) => ({
  styleId: d.styleId,
  styleName: styleName.get(d.styleId as string) ?? '',
  source: d.source,
  updatedAt: d.updatedAt,
}));
await exportCollection('comments');

const tally = new Map<string, number>();
const bySource = new Map<string, Map<string, number>>();
for (const v of votes) {
  const styleId = v.styleId as string;
  const source = (v.source as string) || 'direct';
  tally.set(styleId, (tally.get(styleId) ?? 0) + 1);
  const counts = bySource.get(source) ?? new Map<string, number>();
  counts.set(styleId, (counts.get(styleId) ?? 0) + 1);
  bySource.set(source, counts);
}
console.log('\n투표 집계');
for (const s of STYLES) console.log(`  ${s.name.padEnd(10)} ${tally.get(s.id) ?? 0}`);

// 공개용: 이름·의견·시각 없이 출처 × 스타일 득표 수만
mkdirSync(STATS_DIR, { recursive: true });
writeFileSync(
  `${STATS_DIR}/stats.csv`,
  toCsv(
    [...bySource.keys()].sort().flatMap((source) =>
      STYLES.map((s) => ({ source, styleId: s.id, styleName: s.name, votes: bySource.get(source)!.get(s.id) ?? 0 })),
    ),
  ),
);
console.log(`\n집계 → ${STATS_DIR}/stats.csv`);
