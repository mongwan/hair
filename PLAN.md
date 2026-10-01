# 헤어스타일 추천 투표 웹사이트 — 구현 계획

지인에게 링크를 공유해서 **내게 어울리는 헤어스타일을 투표**받고 **의견을 댓글로** 받는 모바일 전용 단일 페이지.
결과(투표·댓글)는 Firestore에 저장만 하고, 확인은 Firebase 콘솔에서 직접 한다.

## 1. 범위

| 기능 | 내용 |
| --- | --- |
| 스타일 갤러리 | 후보 헤어스타일 이미지 + 이름 + 짧은 설명 |
| 투표 | 브라우저당 1표, 후보 중 하나 선택. 다시 누르면 선택 변경. **결과는 화면에 표시하지 않음** |
| 의견 남기기 | 이름(닉네임) + 코멘트 입력창 두 개. 저장만 하고 화면에 목록 표시 안 함 |
| 유입 출처 구분 | `/?from=twitter` 같은 파라미터를 투표·댓글 문서에 함께 저장 |
| 검색 차단 | `noindex` 적용 |

하지 않는 것: 로그인, 관리자 페이지, 결과/댓글 화면 표시, 집계 UI, 데스크톱 레이아웃.

## 2. 기술 스택

- **빌드**: Vite + 바닐라 TypeScript, 단일 `index.html`
- **Firebase JS SDK (modular)**: `firebase/app`, `firebase/firestore`만 사용 (Auth 미사용 → 번들 작음)
- **Firebase Hosting**: 페이지 + 이미지 서빙
- **Cloud Firestore**: 투표, 댓글 저장
- **이미지**: Hosting의 `public/images/`에 정적 파일로 포함
  - Blaze라 Storage도 쓸 수 있지만, 이미지가 고정이면 Hosting이 설정·규칙·CORS 관리가 없어 가장 단순하다. 나중에 이미지를 자주 바꾸고 싶어지면 Storage로 옮긴다.

## 3. 디렉터리 구조

```
hair/
├─ index.html            # 유일한 페이지 (noindex 메타 포함)
├─ public/
│  ├─ images/            # style-01.webp ... (가로 720px 이하, WebP)
│  └─ og.jpg             # 카카오톡/메신저 공유 미리보기 이미지
├─ src/
│  ├─ firebase.ts        # 초기화, db export
│  ├─ styles.ts          # 후보 스타일 목록 (id, 이름, 설명, 이미지 경로)
│  ├─ source.ts          # ?from= 파싱/보관
│  ├─ main.ts            # 갤러리 렌더, 투표, 댓글 전송
│  └─ style.css
├─ firestore.rules
├─ firebase.json
└─ .firebaserc
```

후보 목록은 코드(`styles.ts`)에 두고 Firestore에는 **결과만** 저장한다.

## 4. 유입 출처(`from`) 처리

- 링크 예: `https://<project>.web.app/?from=twitter`, `?from=kakao`, `?from=insta`, `?from=family`
- 규칙:
  1. URL의 `from` 값을 소문자로 바꾸고 `[a-z0-9_-]{1,30}`만 허용. 형식이 안 맞으면 무시
  2. 유효한 값이 있으면 `localStorage`에 저장 (새로고침·재방문해도 유지)
  3. URL에 없으면 저장된 값, 그것도 없으면 `"direct"`
- 저장 후 `history.replaceState`로 주소창에서 `?from=`을 지워서, 방문자가 링크를 복사해 다른 곳에 퍼뜨려도 원래 출처가 따라가지 않게 한다. (복사된 링크로 들어온 사람은 `direct`로 집계)
- 투표·댓글 문서마다 `source` 필드로 저장 → 콘솔에서 `source == "twitter"` 필터로 확인

## 5. 데이터 모델 (Firestore)

로그인이 없으므로 브라우저별 식별자로 `localStorage`에 무작위 `clientId`(`crypto.randomUUID()`)를 만들어 둔다.

### `votes/{clientId}`
브라우저당 문서 1개 → 다시 투표하면 같은 문서를 덮어써서 선택 변경

```ts
{
  styleId: "style-02",
  source: "twitter",
  updatedAt: serverTimestamp()
}
```

### `comments/{autoId}`

```ts
{
  name: string,        // 1~20자 (비우면 "익명")
  body: string,        // 1~500자
  source: string,
  createdAt: serverTimestamp()
}
```

콘솔 확인 방법: Firestore 데이터 탭에서 컬렉션을 열고 필드 필터(`styleId == "style-02"`, `source == "kakao"`) 사용. 컬렉션 상단의 "쿼리 빌더"에서 개수(COUNT) 집계도 가능.

## 6. 보안 규칙 (`firestore.rules`)

로그인이 없으니 **쓰기만 허용하고 읽기는 전부 차단**한다. Firebase 콘솔은 규칙을 우회하므로 나는 콘솔에서 그대로 볼 수 있다. 결과가 화면에 안 보이는 것도 규칙 차원에서 보장된다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function validSource(s) {
      return s is string && s.matches('^[a-z0-9_-]{1,30}$');
    }

    match /votes/{clientId} {
      allow read, delete: if false;
      allow create, update: if clientId.matches('^[0-9a-f-]{36}$')
        && request.resource.data.keys().hasOnly(['styleId', 'source', 'updatedAt'])
        && request.resource.data.styleId in ['style-01', 'style-02', 'style-03', 'style-04']
        && validSource(request.resource.data.source)
        && request.resource.data.updatedAt == request.time;
    }

    match /comments/{id} {
      allow read, update, delete: if false;
      allow create: if request.resource.data.keys().hasOnly(['name', 'body', 'source', 'createdAt'])
        && request.resource.data.name is string
        && request.resource.data.name.size() >= 1
        && request.resource.data.name.size() <= 20
        && request.resource.data.body is string
        && request.resource.data.body.size() >= 1
        && request.resource.data.body.size() <= 500
        && validSource(request.resource.data.source)
        && request.resource.data.createdAt == request.time;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- 후보 id 목록이 `styles.ts`와 규칙 양쪽에 있으므로 스타일을 바꿀 때 둘 다 수정한다.
- 투표 문서는 읽기가 막혀 있어서 클라이언트는 `getDoc` 없이 `setDoc`만 호출한다. 내가 무엇에 투표했는지는 `localStorage`에 따로 저장해서 표시한다.

## 7. 화면 설계 (모바일 전용, 단일 페이지)

전역 레이아웃: `max-width: 480px; margin: 0 auto;`, 바깥은 배경색. `viewport` 메타, `safe-area-inset` 패딩, 입력창 폰트 16px(iOS 자동 확대 방지).

위에서 아래로:
1. **헤더**: 제목("제 다음 머리 골라주세요 💇"), 한 줄 설명, 현재 내 사진(선택)
2. **후보 카드 목록** (1열 세로 스크롤)
   - 이미지(`aspect-ratio: 3/4`, `object-fit: cover`, `loading="lazy"`), 탭하면 `<dialog>`로 크게 보기
   - 스타일 이름 + 설명 + "이걸로!" 버튼
   - 투표하면 해당 카드에 체크 표시 + "투표 완료! 다른 걸 누르면 바뀌어요" 안내. **득표 수나 비율은 표시하지 않음**
3. **의견 남기기**
   - 이름 입력(`maxlength=20`), 코멘트 textarea(`maxlength=500`, 글자 수 카운터)
   - 보내기 버튼 → 전송 중에는 비활성화, 성공 시 코멘트 칸만 비우고 "고마워요!" 토스트
   - 이름은 `localStorage`에 기억해서 다음 코멘트 때 자동 입력
   - 댓글 목록은 표시하지 않음

## 8. 핵심 흐름

```
페이지 진입
 ├─ source 결정 (URL → localStorage → "direct"), 주소창에서 ?from= 제거
 ├─ clientId 없으면 생성 후 localStorage 저장
 └─ localStorage의 myVote가 있으면 해당 카드 선택 상태로 표시

투표 버튼
 └─ setDoc(votes/{clientId}, { styleId, source, updatedAt: serverTimestamp() })
     └─ 성공 시 localStorage.myVote = styleId, UI 갱신 (실패 시 토스트로 재시도 안내)

의견 보내기
 └─ addDoc(comments, { name, body, source, createdAt: serverTimestamp() })
```

**한계**: 로그인이 없으므로 시크릿 창, 다른 브라우저, 저장소 삭제 시 중복 투표가 가능하다. 지인 대상이라 허용한다. 장난이 걱정되면 App Check(reCAPTCHA Enterprise)를 붙여 봇의 직접 API 호출을 막을 수 있다 (로그인 없이 동작).

## 9. 배포 설정 (`firebase.json`)

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      { "source": "**", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
      { "source": "/images/**", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
    ]
  },
  "firestore": { "rules": "firestore.rules" }
}
```

**noindex 적용 (두 군데)**
- `index.html`: `<meta name="robots" content="noindex, nofollow">`
- Hosting 응답 헤더: `X-Robots-Tag: noindex, nofollow` (이미지 등 HTML이 아닌 파일까지 적용)
- `robots.txt`로 크롤링을 막지는 **않는다**. 막으면 검색엔진이 noindex 지시를 읽지 못한다.
- noindex는 카카오톡·트위터 링크 미리보기(OG 태그)에는 영향이 없다.

이미지는 장기 캐시하므로 교체할 때 **파일명을 바꾼다** (`style-01-v2.webp`).

## 10. 구현 단계

| 단계 | 작업 | 완료 기준 |
| --- | --- | --- |
| 0 | Firebase 프로젝트에서 Firestore 생성(서울 `asia-northeast3`), 웹 앱 등록 | `firebaseConfig` 확보 |
| 1 | Vite 프로젝트 셋업, `firebase init hosting firestore` | `npm run dev`로 빈 페이지 표시 |
| 2 | 모바일 레이아웃 + 후보 카드 갤러리 + 이미지 크게 보기 | 375px/430px 폭에서 깨짐 없음 |
| 3 | `source.ts` (`from` 파싱·보관·주소창 정리), `clientId` 생성 | `?from=Twitter!`는 무시, `?from=twitter` 저장 확인 |
| 4 | 투표 저장/변경 (결과 비표시) | 콘솔에 `votes` 문서 1개가 덮어써짐, `source` 기록 |
| 5 | 이름 + 코멘트 폼, 전송, 토스트 | 콘솔에 `comments` 문서 생성 |
| 6 | 보안 규칙 + Emulator 테스트 (`@firebase/rules-unit-testing`) | 아래 테스트 전부 통과 |
| 7 | 이미지 최적화(WebP, 720px), OG 메타, 파비콘, noindex 메타·헤더 | 카카오톡 미리보기 정상, 응답 헤더에 `X-Robots-Tag` 확인 |
| 8 | `npm run build && firebase deploy` | 실제 URL에서 폰으로 `?from=` 별 투표·댓글 저장 확인 |

### 규칙 테스트 케이스 (단계 6)
- `votes`: 정상 생성·덮어쓰기 ✅ / 목록에 없는 styleId ❌ / 추가 필드 ❌ / 잘못된 source(`"Twitter!"`) ❌ / 읽기 ❌
- `comments`: 정상 생성 ✅ / 빈 이름·빈 코멘트 ❌ / 501자 ❌ / 추가 필드 ❌ / 읽기·수정·삭제 ❌
- 그 외 컬렉션 쓰기 ❌

## 11. 주의사항

- **비용**: 쓰기만 발생하고 읽기는 거의 없어서 지인 규모면 사실상 무료 구간. 전송량은 이미지가 대부분이므로 WebP 압축 필수.
- **개인정보**: 본인 사진이 공개 URL에 올라간다. noindex는 검색 노출만 막고, 링크를 아는 사람은 누구나 볼 수 있다.
- **카카오톡 인앱 브라우저**: 로그인을 쓰지 않으므로 특별한 문제 없음. `localStorage`도 정상 동작.
