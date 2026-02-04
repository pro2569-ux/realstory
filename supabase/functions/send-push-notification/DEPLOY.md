# 푸시 알림 Edge Function 배포 가이드

## 1단계: Firebase 서비스 계정 키 다운로드

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택 → ⚙️ 프로젝트 설정
3. **서비스 계정** 탭 클릭
4. **"새 비공개 키 생성"** 버튼 클릭
5. JSON 파일 다운로드 (예: `firebase-service-account.json`)

## 2단계: Supabase CLI 설치

```bash
# npm으로 설치
npm install -g supabase

# 또는 brew로 설치 (Mac)
brew install supabase/tap/supabase
```

## 3단계: Supabase 로그인 및 프로젝트 연결

```bash
# 로그인 (브라우저 열림)
supabase login

# 프로젝트 연결 (PROJECT_REF는 Supabase 대시보드 URL에서 확인)
# 예: https://supabase.com/dashboard/project/abcdefgh12345 → abcdefgh12345
supabase link --project-ref YOUR_PROJECT_REF
```

## 4단계: Firebase 서비스 계정 시크릿 설정

다운로드한 JSON 파일의 내용을 환경변수로 설정합니다.

**방법 A: 파일 내용을 직접 복사**
```bash
# JSON 파일 내용 전체를 복사해서 붙여넣기
supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project",...전체 JSON...}'
```

**방법 B: 파일에서 읽기 (권장)**
```bash
# Mac/Linux
supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat firebase-service-account.json)"

# Windows PowerShell
$json = Get-Content firebase-service-account.json -Raw
supabase secrets set FIREBASE_SERVICE_ACCOUNT=$json
```

## 5단계: Edge Function 배포

```bash
# 프로젝트 루트에서 실행
supabase functions deploy send-push-notification
```

## 6단계: 배포 확인

```bash
# 배포된 함수 목록 확인
supabase functions list
```

## 테스트

Supabase 대시보드 → Edge Functions → send-push-notification → Logs 에서 로그 확인 가능

---

## 문제 해결

### "FIREBASE_SERVICE_ACCOUNT is not configured" 에러
→ 4단계를 다시 수행하여 시크릿 설정

### "Invalid JWT" 에러
→ 서비스 계정 JSON이 올바른지 확인 (project_id, private_key 등)

### 401 Unauthorized 에러
→ Edge Function이 배포되지 않았거나, JWT 인증 실패. Supabase 대시보드에서 함수 존재 여부 확인

### 토큰은 있는데 푸시가 안 옴
→ Firebase Console → Cloud Messaging 에서 API가 활성화되어 있는지 확인
