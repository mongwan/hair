const SOURCE_KEY = 'hair.source';
const SOURCE_PATTERN = /^[a-z0-9_-]{1,30}$/;

export function normalizeSource(raw: string | null): string | null {
  if (raw == null) return null;
  const value = raw.trim().toLowerCase();
  return SOURCE_PATTERN.test(value) ? value : null;
}

function readStored(): string | null {
  try {
    return normalizeSource(localStorage.getItem(SOURCE_KEY));
  } catch {
    return null;
  }
}

function store(value: string): void {
  try {
    localStorage.setItem(SOURCE_KEY, value);
  } catch {
    // 저장소를 쓸 수 없어도 이번 방문에서는 값이 유지됨
  }
}

/**
 * 유입 출처 결정: URL의 ?from= → 이전에 저장된 값 → "direct".
 * 링크를 복사해 퍼뜨려도 출처가 따라가지 않도록 주소창에서 from을 지운다.
 */
export function resolveSource(): string {
  const url = new URL(location.href);
  const fromUrl = normalizeSource(url.searchParams.get('from'));

  if (url.searchParams.has('from')) {
    url.searchParams.delete('from');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }

  if (fromUrl) {
    store(fromUrl);
    return fromUrl;
  }
  return readStored() ?? 'direct';
}
