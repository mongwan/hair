# 제 다음 머리 골라주세요 💇

지인에게 링크를 공유해서 헤어스타일 투표와 의견을 받는 모바일 전용 단일 페이지.
투표·코멘트는 Firestore에 저장만 되고 화면에는 표시되지 않는다. 확인은 Firebase 콘솔에서 한다.

계획과 설계 배경은 [PLAN.md](PLAN.md) 참고.

## 처음 설정

Firebase 프로젝트: `hair-d2632` (배포 주소 https://hair-d2632.web.app)

- 웹 앱 설정값은 `.env.production`에 커밋되어 있다. 브라우저에 공개되는 값이라 커밋해도 안전하고, 데이터 보호는 `firestore.rules`가 담당한다.
- Firebase 콘솔에서 Firestore 데이터베이스가 생성되어 있어야 한다 (위치: `asia-northeast3` 서울 권장).
- 로컬에서 배포하려면 `npm install` 후 `npx firebase login`.

## 후보 스타일 바꾸기

1. `public/images/`에 이미지 추가 (세로 3:4, 가로 720px 이하 WebP 권장)
   - 이미지는 1년 캐시되므로 **교체할 때는 파일명을 바꾼다** (`style-01-v2.webp`)
2. `src/styles.ts`의 `STYLES` 수정
3. id를 추가/변경했다면 `firestore.rules`의 `validStyle` 목록도 똑같이 수정
   (`npm run test:rules`가 둘이 다르면 실패한다)
4. 공유 미리보기 이미지는 `public/og.jpg` (1200×630)

## 개발

```bash
npm run dev                # 개발 서버 (.env 없으면 demo 프로젝트 → 에뮬레이터와 함께 사용)
npm run test:rules         # 에뮬레이터로 보안 규칙 테스트 (Java 필요)
```

에뮬레이터에 연결해서 화면을 확인하려면:

```bash
npx firebase emulators:start --only firestore --project demo-hair
VITE_USE_EMULATOR=true npm run dev
```

## 배포

```bash
npm run deploy             # 빌드 + Hosting·Firestore 규칙 배포
```

## 공유 링크와 출처 구분

`?from=` 뒤에 출처를 붙여서 공유한다. 영문 소문자, 숫자, `-`, `_` 30자까지.

```
https://<프로젝트>.web.app/?from=twitter
https://<프로젝트>.web.app/?from=kakao
https://<프로젝트>.web.app/?from=family
```

- 처음 들어온 출처는 브라우저에 저장되어 재방문 시에도 유지된다. 없으면 `direct`.
- 방문 후 주소창에서 `?from=`이 지워지므로, 방문자가 링크를 다시 퍼뜨려도 출처가 섞이지 않는다.

## 결과 확인 (Firebase 콘솔 > Firestore)

| 컬렉션 | 필드 |
| --- | --- |
| `votes/{브라우저ID}` | `styleId`, `source`, `updatedAt` — 브라우저당 1개, 다시 투표하면 덮어씀 |
| `comments/{자동ID}` | `name`, `body`, `source`, `createdAt` |

콘솔의 쿼리 빌더에서 `styleId == "style-02"` 같은 필터와 COUNT 집계를 쓰면 후보별·출처별 득표를 볼 수 있다.
보안 규칙상 웹에서는 아무도 읽을 수 없고, 콘솔에서만 보인다.

로그인이 없으므로 시크릿 창이나 다른 브라우저로 중복 투표가 가능하다 (지인 대상이라 허용).
