# FC실화 - 풋살 투표 시스템

FC실화 팀원들을 위한 풋살 경기 참석 투표 웹 애플리케이션입니다.

## 🚀 주요 기능

### 사용자 기능
- ✅ 회원가입 및 로그인
- ✅ 경기 목록 조회
- ✅ 경기 참석 여부 투표 (참석/불참/미정/늦게도착)
- ✅ 실시간 투표 현황 확인
- ✅ 댓글 작성
- ✅ 알림 확인

### 관리자 기능
- ✅ 경기 생성
- ✅ 경기 수정
- ✅ 경기 삭제
- ✅ 경기 상태 관리 (예정/완료/취소)

## 🛠 기술 스택

### Frontend
- **React 18** - UI 라이브러리
- **TypeScript** - 타입 안정성
- **Vite** - 빌드 도구
- **React Router** - 라우팅
- **Tailwind CSS** - 스타일링
- **date-fns** - 날짜 처리

### Backend
- **Supabase** - 백엔드 서비스
  - PostgreSQL 데이터베이스
  - 인증 시스템
  - 실시간 기능
  - Row Level Security

## 📦 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd realstory
```

### 2. 의존성 설치
```bash
npm install
```

### 3. Supabase 설정

#### 3.1 Supabase 프로젝트 생성
1. [Supabase](https://supabase.com)에 가입
2. 새 프로젝트 생성
3. 프로젝트 URL과 anon key 복사

#### 3.2 환경 변수 설정
```bash
cp .env.example .env
```

`.env` 파일을 열고 Supabase 정보 입력:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### 3.3 데이터베이스 스키마 설정
1. Supabase Dashboard에서 SQL Editor 열기
2. `supabase-schema.sql` 파일의 내용을 복사
3. SQL Editor에 붙여넣고 실행

### 4. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 5. 프로덕션 빌드
```bash
npm run build
npm run preview
```

## 📁 프로젝트 구조

```
realstory/
├── src/
│   ├── components/        # 재사용 가능한 컴포넌트
│   ├── contexts/          # React Context (인증 등)
│   ├── pages/            # 페이지 컴포넌트
│   │   ├── Login.tsx     # 로그인/회원가입
│   │   ├── Home.tsx      # 홈 (경기 목록)
│   │   ├── MatchDetail.tsx  # 경기 상세/투표
│   │   ├── Admin.tsx     # 관리자 페이지
│   │   └── Notifications.tsx # 알림
│   ├── lib/              # 유틸리티 함수
│   │   └── supabase.ts   # Supabase 클라이언트
│   ├── types/            # TypeScript 타입 정의
│   ├── App.tsx           # 메인 앱 컴포넌트
│   └── main.tsx          # 진입점
├── supabase-schema.sql   # 데이터베이스 스키마
└── package.json
```

## 🗄 데이터베이스 스키마

### users
- 사용자 정보
- Supabase Auth와 연동

### matches
- 경기 정보 (제목, 날짜, 장소 등)

### votes
- 사용자의 경기 참석 투표
- 4가지 상태: attending, not_attending, maybe, late

### comments
- 경기별 댓글

### notifications
- 사용자별 알림

## 👥 사용자 역할

### 일반 사용자
- 경기 조회
- 투표
- 댓글 작성
- 알림 확인

### 관리자
- 일반 사용자 권한 + 경기 관리

## 🔐 보안

- Row Level Security (RLS) 적용
- 사용자는 본인의 데이터만 수정 가능
- 관리자만 경기 생성/수정/삭제 가능
- 인증된 사용자만 접근 가능

## 🎨 주요 화면

### 로그인/회원가입
- 이메일/비밀번호 인증
- 회원가입 시 이름 입력

### 홈
- 예정된 경기 목록
- 지난 경기 목록
- 경기 카드 클릭으로 상세 페이지 이동

### 경기 상세
- 경기 정보 표시
- 투표 버튼 (4가지 옵션)
- 투표 현황 (차트)
- 참석자 목록
- 댓글 기능

### 관리자
- 경기 생성/수정/삭제
- 테이블 형태로 모든 경기 관리

## 🚀 배포

### Vercel 배포 (권장)
1. GitHub에 프로젝트 푸시
2. [Vercel](https://vercel.com)에서 Import
3. 환경 변수 설정
4. 배포

### Netlify 배포
1. GitHub에 프로젝트 푸시
2. [Netlify](https://netlify.com)에서 Import
3. 빌드 명령: `npm run build`
4. 출력 디렉토리: `dist`
5. 환경 변수 설정

## 🔧 커스터마이징

### 색상 변경
`tailwind.config.js`에서 색상 테마 수정 가능

### 투표 옵션 변경
`src/pages/MatchDetail.tsx`의 `VOTE_OPTIONS` 배열 수정

### 최대 인원 기본값
`src/pages/Admin.tsx`의 `max_players` 기본값 수정

## 📝 라이선스

MIT License

## 🤝 기여

이슈 및 PR을 환영합니다!

## 📧 문의

프로젝트 관련 문의사항이 있으시면 이슈를 등록해주세요.

---

**Made with ⚽ for FC실화**
