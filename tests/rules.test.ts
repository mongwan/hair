import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { STYLES } from '../src/styles';

const rules = readFileSync('firestore.rules', 'utf8');
const CLIENT_ID = '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-hair',
    firestore: { rules },
  });
});

afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

// 로그인 없는 방문자
const db = () => env.unauthenticatedContext().firestore();

const vote = (overrides: Record<string, unknown> = {}) => ({
  styleId: 'style-01',
  source: 'twitter',
  updatedAt: serverTimestamp(),
  ...overrides,
});

const comment = (overrides: Record<string, unknown> = {}) => ({
  name: '친구',
  body: '두 번째가 제일 잘 어울려요',
  source: 'kakao',
  createdAt: serverTimestamp(),
  ...overrides,
});

describe('styles.ts와 규칙 동기화', () => {
  it('규칙의 validStyle 목록이 STYLES id와 같다', () => {
    const match = rules.match(/function validStyle\(s\) \{\s*return s in \[([^\]]*)\]/);
    const ids = [...(match?.[1].matchAll(/'([^']+)'/g) ?? [])].map((m) => m[1]);
    expect(ids).toEqual(STYLES.map((s) => s.id));
  });
});

describe('votes', () => {
  it('정상 투표를 생성하고 덮어쓸 수 있다', async () => {
    const ref = doc(db(), 'votes', CLIENT_ID);
    await assertSucceeds(setDoc(ref, vote()));
    await assertSucceeds(setDoc(ref, vote({ styleId: 'style-03' })));
  });

  it('목록에 없는 styleId는 거부', async () => {
    await assertFails(setDoc(doc(db(), 'votes', CLIENT_ID), vote({ styleId: 'style-99' })));
  });

  it('형식이 잘못된 source는 거부', async () => {
    const ref = doc(db(), 'votes', CLIENT_ID);
    await assertFails(setDoc(ref, vote({ source: 'Twitter!' })));
    await assertFails(setDoc(ref, vote({ source: '' })));
    await assertFails(setDoc(ref, vote({ source: 'a'.repeat(31) })));
  });

  it('추가 필드는 거부', async () => {
    await assertFails(setDoc(doc(db(), 'votes', CLIENT_ID), vote({ extra: 1 })));
  });

  it('서버 시간이 아닌 updatedAt은 거부', async () => {
    await assertFails(
      setDoc(doc(db(), 'votes', CLIENT_ID), vote({ updatedAt: Timestamp.fromMillis(0) })),
    );
  });

  it('UUID 형식이 아닌 문서 ID는 거부', async () => {
    await assertFails(setDoc(doc(db(), 'votes', 'hello'), vote()));
  });

  it('읽기, 목록, 삭제 불가', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'votes', CLIENT_ID), vote()),
    );
    await assertFails(getDoc(doc(db(), 'votes', CLIENT_ID)));
    await assertFails(getDocs(collection(db(), 'votes')));
    await assertFails(deleteDoc(doc(db(), 'votes', CLIENT_ID)));
  });
});

describe('comments', () => {
  it('정상 코멘트를 생성할 수 있다', async () => {
    await assertSucceeds(addDoc(collection(db(), 'comments'), comment()));
  });

  it('500자까지 허용, 501자는 거부', async () => {
    const col = collection(db(), 'comments');
    await assertSucceeds(addDoc(col, comment({ body: '가'.repeat(500) })));
    await assertFails(addDoc(col, comment({ body: '가'.repeat(501) })));
  });

  it('빈 이름이나 빈 코멘트는 거부', async () => {
    const col = collection(db(), 'comments');
    await assertFails(addDoc(col, comment({ name: '' })));
    await assertFails(addDoc(col, comment({ body: '' })));
    await assertFails(addDoc(col, comment({ name: '가'.repeat(21) })));
  });

  it('추가 필드나 누락 필드는 거부', async () => {
    const col = collection(db(), 'comments');
    await assertFails(addDoc(col, comment({ styleId: 'style-01' })));
    const { source: _source, ...withoutSource } = comment();
    await assertFails(addDoc(col, withoutSource));
  });

  it('읽기, 수정, 삭제 불가', async () => {
    const ref = doc(db(), 'comments', 'c1');
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'comments', 'c1'), comment()),
    );
    await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(db(), 'comments')));
    await assertFails(updateDoc(ref, { body: '수정' }));
    await assertFails(deleteDoc(ref));
  });
});

describe('그 외 컬렉션', () => {
  it('쓰기 불가', async () => {
    await assertFails(setDoc(doc(db(), 'anything', 'x'), { a: 1 }));
  });
});
