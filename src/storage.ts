const CLIENT_ID_KEY = 'hair.clientId';
const MY_VOTE_KEY = 'hair.myVote';
const NAME_KEY = 'hair.name';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 시크릿 모드 등에서 저장 실패해도 동작은 계속
  }
}

let memoryClientId: string | null = null;

/** 브라우저별 투표 문서 ID. 저장소를 못 쓰면 이번 방문 동안만 유지 */
export function getClientId(): string {
  const stored = get(CLIENT_ID_KEY);
  if (stored && /^[0-9a-f-]{36}$/.test(stored)) return stored;
  memoryClientId ??= crypto.randomUUID();
  set(CLIENT_ID_KEY, memoryClientId);
  return memoryClientId;
}

export const getMyVote = () => get(MY_VOTE_KEY);
export const setMyVote = (styleId: string) => set(MY_VOTE_KEY, styleId);
export const getSavedName = () => get(NAME_KEY) ?? '';
export const setSavedName = (name: string) => set(NAME_KEY, name);
