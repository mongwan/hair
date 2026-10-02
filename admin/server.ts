// 로컬 전용 결과 확인 콘솔. Admin SDK로 읽으므로 보안 규칙(읽기 차단)을 우회한다.
// 실행: npm run admin  →  http://localhost:4000
// 스냅샷: npm run admin:snapshot [-- 경로]  →  데이터가 들어간 HTML 한 장 (기본 admin/out/results.html)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';
import { STYLES } from '../src/styles.ts';

const PORT = Number(process.env.ADMIN_PORT ?? 4000);
const HOST = '127.0.0.1';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? (process.env.FIRESTORE_EMULATOR_HOST ? 'demo-hair' : 'hair-d2632');

const root = join(import.meta.dirname, '..');
const imagesDir = join(root, 'public', 'images');

// FIREBASE_SERVICE_ACCOUNT(키 JSON 내용 또는 그 base64) → GOOGLE_APPLICATION_CREDENTIALS / gcloud 로그인 순
function credential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return applicationDefault();
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return cert(JSON.parse(json));
}

const app = initializeApp(
  process.env.FIRESTORE_EMULATOR_HOST ? { projectId: PROJECT_ID } : { projectId: PROJECT_ID, credential: credential() },
);
const db = getFirestore(app);

const toIso = (value: unknown) => (value as Timestamp | undefined)?.toDate?.().toISOString() ?? null;

async function loadResults() {
  const [votes, comments] = await Promise.all([db.collection('votes').get(), db.collection('comments').get()]);
  return {
    projectId: PROJECT_ID,
    emulator: Boolean(process.env.FIRESTORE_EMULATOR_HOST),
    fetchedAt: new Date().toISOString(),
    styles: STYLES.map(({ id, name, image }) => ({ id, name, image })),
    votes: votes.docs.map((d) => ({
      styleId: String(d.get('styleId') ?? ''),
      source: String(d.get('source') ?? 'direct'),
      updatedAt: toIso(d.get('updatedAt')),
    })),
    comments: comments.docs
      .map((d) => ({
        name: String(d.get('name') ?? ''),
        body: String(d.get('body') ?? ''),
        source: String(d.get('source') ?? 'direct'),
        createdAt: toIso(d.get('createdAt')),
      }))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
  };
}

const MIME: Record<string, string> = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', `http://${HOST}`);
  try {
    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(await readFile(join(import.meta.dirname, 'index.html')));
    } else if (pathname === '/api/results') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(await loadResults()));
    } else if (pathname.startsWith('/images/')) {
      const file = normalize(join(imagesDir, pathname.slice('/images/'.length)));
      if (!file.startsWith(imagesDir)) throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } else {
      res.writeHead(404).end('Not found');
    }
  } catch (error) {
    const notFound = (error as NodeJS.ErrnoException).code === 'ENOENT';
    if (!notFound) console.error(error);
    res.writeHead(notFound ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(notFound ? 'Not found' : String((error as Error).message ?? error));
  }
});

async function writeSnapshot(outPath: string) {
  const results = await loadResults();
  // 이미지까지 data URI로 넣어서 파일 하나로 열리게 한다
  for (const style of results.styles) {
    const file = join(imagesDir, style.image.replace(/^\/images\//, ''));
    style.image = `data:${MIME[extname(file)] ?? 'image/webp'};base64,${(await readFile(file)).toString('base64')}`;
  }
  const json = JSON.stringify(results).replace(/</g, '\\u003c');
  const html = (await readFile(join(import.meta.dirname, 'index.html'), 'utf8')).replace(
    '<!-- SNAPSHOT -->',
    () => `<script>window.SNAPSHOT = ${json};</script>`,
  );
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html);
  console.log(`스냅샷 저장: ${outPath} (투표 ${results.votes.length}, 의견 ${results.comments.length})`);
}

const snapshotIndex = process.argv.indexOf('--snapshot');
if (snapshotIndex !== -1) {
  const out = process.argv[snapshotIndex + 1];
  await writeSnapshot(resolve(out && !out.startsWith('--') ? out : join(import.meta.dirname, 'out', 'results.html')));
  process.exit(0);
}

server.listen(PORT, HOST, () => {
  const target = process.env.FIRESTORE_EMULATOR_HOST ? `에뮬레이터 ${process.env.FIRESTORE_EMULATOR_HOST}` : PROJECT_ID;
  console.log(`관리자 콘솔: http://localhost:${PORT}  (데이터: ${target})`);
});
