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
4. 공유 미리보기 이미지는 `public/og-2.jpg` (1200×630). 바꿀 때는 파일명도 바꿔야 메신저 캐시를 피할 수 있다

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

## 배포 (GitHub Actions)

`.github/workflows/deploy.yml`

- PR: 빌드 + 보안 규칙 테스트만 실행
- `main`에 푸시(머지): 테스트 통과 시 Hosting과 Firestore 규칙을 `hair-d2632`에 배포
- Actions 탭에서 수동 실행(Run workflow)도 가능 (`main`에서만 배포됨)

### 최초 1회: 서비스 계정 키 등록

1. [Google Cloud 콘솔 > IAM 및 관리자 > 서비스 계정](https://console.cloud.google.com/iam-admin/serviceaccounts?project=hair-d2632)에서 **서비스 계정 만들기**
   - 이름: `github-deploy`
   - 역할: **Firebase 관리자** (`Firebase Admin`)
2. 만든 계정 > **키** 탭 > 키 추가 > 새 키 만들기 > **JSON** → 파일이 다운로드됨
3. GitHub 저장소 > Settings > Secrets and variables > Actions > **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: 다운로드한 JSON 파일 내용 전체
4. 등록 후 다운로드한 JSON 파일은 삭제 (키는 GitHub에만 보관)

### 로컬에서 직접 배포할 때

```bash
npx firebase login
npm run deploy
```

## 커스텀 도메인 (예: hair.mongwan.dev)

1. Firebase 콘솔 > Hosting > **커스텀 도메인 추가**에 `hair.mongwan.dev` 입력
2. 콘솔이 보여주는 레코드를 Netlify DNS(`mongwan.dev` 영역)에 그대로 추가 (보통 아래 두 개)
   | 타입 | 이름 | 값 |
   | --- | --- | --- |
   | A | `hair` | 콘솔에 표시된 IP (예: `199.36.158.100`) |
   | TXT | `hair` | `hosting-site=hair-d2632` |
   - `hair`에 이미 다른 A/AAAA/CNAME 레코드가 있으면 삭제
   - 콘솔이 `_acme-challenge.hair` TXT를 추가로 요구하면 그것도 추가
3. 콘솔 상태가 **연결됨**이 되고 SSL 인증서가 발급될 때까지 대기 (수 분~최대 24시간)
   - `.dev`는 HTTPS 전용이라 인증서가 나오기 전에는 접속되지 않는다
4. `.env.production`의 `VITE_SITE_URL`을 `https://hair.mongwan.dev`로 바꿔 배포
   - 미리보기 이미지(og:image) 주소가 새 도메인으로 바뀌고
   - 기존 `*.web.app` / `*.firebaseapp.com` 주소로 들어온 방문자는 새 도메인으로 이동 (`?from=` 유지)
   - **3번이 끝나기 전에 바꾸면 기존 주소도 열리지 않으니 순서 주의**

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
