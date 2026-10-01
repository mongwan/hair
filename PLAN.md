# 헤어스타일 추천 투표 웹사이트 — 구현 계획

친구/지인에게 링크를 공유해서 **내게 어울리는 헤어스타일을 투표**받고, **의견을 댓글로** 받는 모바일 전용 웹사이트.

## 1. 목표와 범위

| 기능 | 내용 |
| --- | --- |
| 스타일 갤러리 | 후보 헤어스타일 이미지(합성/레퍼런스 사진) + 이름 + 짧은 설명 |
| 투표 | 1인 1표, 후보 중 하나 선택. 다시 누르면 선택 변경 가능 |
| 결과 보기 | 투표 후 후보별 득표 수/비율 막대 표시 |
| 의견 남기기 | 닉네임(선택) + 본문. **작성만 가능, 읽기는 나(관리자)만** |
| 관리자 페이지 | 내 Google 계정으로 로그인 → 전체 댓글, 투표 현황 확인 |

범위 밖: 회원가입, 이미지 업로드 UI, 데스크톱 레이아웃, 다국어.

## 2. 기술 스택

- **빌드**: Vite + 바닐라 TypeScript (페이지 2개짜리라 프레임워크 불필요, 번들 작게 유지)
- **Firebase JS SDK v10+ (modular)**: `firebase/app`, `firebase/auth`, `firebase/firestore`
- **Firebase Hosting**: 정적 파일 + 이미지 서빙
- **Cloud Firestore**: 투표, 댓글 저장
- **Firebase Auth**
  - 방문자: **익명 로그인(Anonymous Auth)** — 가입 없이 uid를 받아 중복 투표 방지
  - 관리자: **Google 로그인** — 내 uid만 댓글 읽기 허용
- **이미지**: Cloud Storage 대신 **Hosting에 정적 파일로 포함** (`public/images/`)
  - 이유: 이미지가 고정이고, Storage 신규 버킷은 Blaze(종량제) 요금제가 필요함. Spark(무료)로 충분히 운영 가능

## 3. 디렉터리 구조

```
hair/
├─ index.html            # 투표 + 의견 페이지
├─ admin.html            # 관리자 페이지
├─ public/
│  ├─ images/            # style-01.webp ... (가로 720px 이하, WebP)
│  └─ og.jpg             # 카카오톡/메신저 공유 미리보기 이미지
├─ src/
│  ├─ firebase.ts        # 초기화, auth/db export
│  ├─ styles.ts          # 후보 스타일 목록 (id, 이름, 설명, 이미지 경로)
│  ├─ main.ts            # 갤러리 렌더, 투표, 결과, 댓글 작성
│  ├─ admin.ts           # Google 로그인, 댓글 목록, 투표 집계
│  └─ style.css
├─ firestore.rules
├─ firestore.indexes.json
├─ firebase.json
├─ .firebaserc
└─ vite.config.ts        # 멀티 페이지 입력(index, admin)
```

후보 스타일 목록은 코드(`styles.ts`)에 두고, Firestore에는 **결과(투표/댓글)만** 저장한다. 스타일을 바꾸려면 이미지 교체 + 배포.

## 4. 데이터 모델 (Firestore)

### `votes/{uid}`
방문자 1명당 문서 1개 (문서 ID = 익명 uid → 자연스럽게 1인 1표)

```ts
{
  styleId: "style-02",          // styles.ts의 id
  updatedAt: serverTimestamp()
}
```

집계는 `getCountFromServer(query(votes, where("styleId", "==", id)))`로 후보별 개수를 구한다. 후보가 5~10개 수준이면 집계 쿼리 비용(1000건당 문서 읽기 1회)도 무시할 만함.

> 대안: `stats/summary` 문서에 `increment()`로 카운터 유지. 빠르지만 표 변경 시 -1/+1 처리와 규칙 검증이 복잡해져서 이 규모에선 집계 쿼리가 낫다.

### `comments/{autoId}`

```ts
{
  nickname: "익명" | string,    // 0~20자
  body: string,                 // 1~500자
  styleId: string | null,       // 투표한 스타일(선택), 관리자가 맥락 파악용
  uid: string,                  // 작성자 익명 uid (스팸 추적용)
  createdAt: serverTimestamp()
}
```

## 5. 보안 규칙 (`firestore.rules`)

핵심: 댓글은 **누구나 create만 가능**, read는 관리자 uid만.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.uid == "<MY_ADMIN_UID>";
    }
    function validStyle(s) {
      return s in ["style-01", "style-02", "style-03", "style-04"];
    }

    match /votes/{uid} {
      // 집계 쿼리를 위해 읽기 허용 (uid는 익명이라 개인정보 아님)
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(["styleId", "updatedAt"])
        && validStyle(request.resource.data.styleId)
        && request.resource.data.updatedAt == request.time;
      allow delete: if isAdmin();
    }

    match /comments/{id} {
      allow read, delete: if isAdmin();
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(["nickname", "body", "styleId", "uid", "createdAt"])
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.body is string
        && request.resource.data.body.size() > 0
        && request.resource.data.body.size() <= 500
        && request.resource.data.nickname is string
        && request.resource.data.nickname.size() <= 20
        && request.resource.data.createdAt == request.time;
      allow update: if false;
    }
  }
}
```

- `<MY_ADMIN_UID>`: 관리자 페이지에서 처음 Google 로그인 후 콘솔(Authentication > Users)에서 확인해 넣는다.
- 후보 id 목록은 `styles.ts`와 규칙 양쪽에 있으므로 스타일 변경 시 둘 다 수정.
- 클라이언트 코드는 공개되므로 "나만 보기"는 반드시 **규칙**으로 보장 (UI에서 숨기는 것만으로는 안 됨).

## 6. 화면 설계 (모바일 전용)

전역 레이아웃: `max-width: 480px; margin: 0 auto;` 바깥은 배경색으로 채움. `viewport` 메타 + `safe-area-inset` 패딩, 기본 폰트 16px(iOS 입력 시 자동 확대 방지).

### `index.html`
1. **헤더**: 제목("제 다음 머리 골라주세요 💇"), 한 줄 설명, 현재 내 사진(선택)
2. **후보 카드 목록** (세로 스크롤, 1열)
   - 이미지(`aspect-ratio: 3/4`, `object-fit: cover`, `loading="lazy"`)
   - 스타일 이름 + 설명
   - 투표 버튼 → 선택된 카드는 테두리/체크 표시
3. **결과 영역**: 투표 후에만 노출. 후보별 막대 그래프 + 표 수 + %, 내 선택 강조
4. **의견 남기기**: 닉네임 입력(선택), textarea(글자 수 카운터 0/500), 보내기 버튼
   - 안내 문구: "남긴 의견은 저만 볼 수 있어요"
   - 전송 성공 시 폼 비우고 토스트 표시. 다른 사람 댓글 목록은 **표시하지 않음**
5. **이미지 탭 시 전체화면 보기**(간단한 `<dialog>` 라이트박스)

### `admin.html`
- 비로그인: "Google로 로그인" 버튼
- 관리자 uid가 아니면: "권한 없음" 표시 (실제 차단은 규칙이 담당)
- 관리자: 투표 집계 표 + 댓글 목록(최신순, 시간·닉네임·투표 스타일·본문), 삭제 버튼
- `robots` noindex 메타 추가

## 7. 핵심 흐름

```
페이지 진입
 └─ signInAnonymously()  (이미 세션 있으면 재사용 → 같은 기기면 같은 uid)
     └─ getDoc(votes/{uid}) → 이미 투표했으면 선택 상태 + 결과 표시

투표 버튼
 └─ setDoc(votes/{uid}, { styleId, updatedAt: serverTimestamp() })
     └─ 후보별 getCountFromServer → 결과 막대 갱신

의견 보내기
 └─ addDoc(comments, { nickname, body, styleId, uid, createdAt: serverTimestamp() })
```

한계: 익명 uid는 브라우저 저장소 기준이라 시크릿 창/다른 기기로 중복 투표 가능. 지인 대상 소규모 투표라 허용하는 것으로 결정 (필요 시 App Check 추가).

## 8. 구현 단계

| 단계 | 작업 | 완료 기준 |
| --- | --- | --- |
| 0 | Firebase 콘솔에서 프로젝트 생성, Firestore(서울 `asia-northeast3`) 생성, Auth에서 익명·Google 공급자 활성화, 웹 앱 등록 | `firebaseConfig` 확보 |
| 1 | Vite 프로젝트 셋업, `firebase init hosting firestore`, 멀티 페이지 설정 | `npm run dev`로 빈 페이지 2개 뜸 |
| 2 | 모바일 레이아웃 + 후보 카드 갤러리 (`styles.ts` 기반 렌더) | 375px/430px 폭에서 깨짐 없음 |
| 3 | 익명 로그인 + 투표 저장/변경 + 결과 집계 표시 | 새로고침해도 내 선택 유지, 표 변경 시 집계 반영 |
| 4 | 의견 작성 폼 + 검증 + 토스트 | Firestore에 문서 생성 확인 |
| 5 | 관리자 페이지 (Google 로그인, 댓글 목록, 집계, 삭제) | 내 계정만 댓글 조회 가능 |
| 6 | 보안 규칙 작성 + **Emulator로 규칙 테스트** (`@firebase/rules-unit-testing`) | 아래 테스트 케이스 전부 통과 |
| 7 | 이미지 최적화(WebP, 720px), OG 메타 태그, 파비콘 | 카카오톡 공유 시 미리보기 정상 |
| 8 | `npm run build && firebase deploy` | 실제 URL에서 폰으로 투표·댓글·관리자 확인 |

### 규칙 테스트 케이스 (단계 6)
- 익명 사용자: 자기 `votes/{uid}` 생성/수정 ✅, 남의 uid 문서 쓰기 ❌, 잘못된 styleId ❌
- 익명 사용자: 댓글 생성 ✅, 501자 댓글 ❌, 추가 필드 포함 ❌, 댓글 읽기/목록 ❌
- 관리자: 댓글 읽기/삭제 ✅
- 비로그인: 모든 쓰기 ❌

## 9. 배포 설정 (`firebase.json`)

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "cleanUrls": true,
    "headers": [
      { "source": "/images/**", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
    ]
  },
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }
}
```

- 이미지는 장기 캐시하므로 교체 시 **파일명을 바꾼다** (`style-01-v2.webp`).
- 관리자 Google 로그인을 위해 Auth > 승인된 도메인에 `*.web.app` 기본 포함 확인 (커스텀 도메인 쓰면 추가).

## 10. 주의사항

- **카카오톡 인앱 브라우저**: 익명 로그인은 정상 동작. Google 로그인은 인앱 브라우저에서 막히므로 관리자 페이지는 일반 브라우저(Chrome/Safari)에서 접속.
- **비용**: Spark 무료 한도(문서 읽기 5만/일, 쓰기 2만/일, Hosting 10GB/월 전송) 안에서 충분. 이미지 용량이 전송량에 가장 큰 영향 → WebP 압축 필수.
- **개인정보**: 본인 사진이 공개 URL에 올라가므로 링크 공유 범위에 유의. 검색 노출 원치 않으면 `index.html`에도 `noindex` 추가.
- **스팸 대응(선택)**: App Check(reCAPTCHA Enterprise)로 봇 차단, 관리자 페이지에서 uid 기준 일괄 삭제.

## 11. 확장 아이디어 (나중에)

- 후보별 "좋아요/별로" 다중 평가, 기장·색상 등 카테고리별 투표
- 투표 마감 시간 설정 (`config/settings` 문서 + 규칙에서 `request.time` 비교)
- 관리자 페이지에서 후보 추가/이미지 업로드 (이때 Storage + Blaze 필요)
- 실시간 결과(`onSnapshot`) — 투표 문서 수가 늘면 카운터 방식으로 전환
