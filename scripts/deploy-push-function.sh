#!/bin/bash

# 푸시 알림 Edge Function 배포 스크립트
# 사용법: ./scripts/deploy-push-function.sh [PROJECT_REF] [SERVICE_ACCOUNT_JSON_PATH]

set -e

echo "=========================================="
echo "  푸시 알림 Edge Function 배포 스크립트"
echo "=========================================="
echo ""

# Supabase CLI 확인
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI가 설치되지 않았습니다."
    echo ""
    echo "설치 방법:"
    echo "  npm install -g supabase"
    echo "  또는"
    echo "  brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI 확인됨"

# 인자 확인
PROJECT_REF=$1
SERVICE_ACCOUNT_PATH=$2

if [ -z "$PROJECT_REF" ]; then
    echo ""
    echo "📋 Supabase Project Reference ID가 필요합니다."
    echo "   Supabase 대시보드 URL에서 확인: https://supabase.com/dashboard/project/[PROJECT_REF]"
    echo ""
    read -p "Project Reference ID를 입력하세요: " PROJECT_REF
fi

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project Reference ID가 필요합니다."
    exit 1
fi

# 로그인 상태 확인
echo ""
echo "📡 Supabase 로그인 확인 중..."
if ! supabase projects list &> /dev/null; then
    echo "🔐 Supabase 로그인이 필요합니다..."
    supabase login
fi

echo "✅ Supabase 로그인됨"

# 프로젝트 링크
echo ""
echo "🔗 프로젝트 연결 중: $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF" || true

# 서비스 계정 설정
if [ -n "$SERVICE_ACCOUNT_PATH" ] && [ -f "$SERVICE_ACCOUNT_PATH" ]; then
    echo ""
    echo "🔑 Firebase 서비스 계정 설정 중..."
    SERVICE_ACCOUNT_JSON=$(cat "$SERVICE_ACCOUNT_PATH")
    supabase secrets set FIREBASE_SERVICE_ACCOUNT="$SERVICE_ACCOUNT_JSON"
    echo "✅ 서비스 계정 설정 완료"
else
    echo ""
    echo "⚠️  Firebase 서비스 계정 JSON 파일이 지정되지 않았습니다."
    echo "   이미 설정되어 있다면 무시해도 됩니다."
    echo ""
    read -p "서비스 계정 JSON 파일 경로 (없으면 Enter): " SERVICE_ACCOUNT_PATH

    if [ -n "$SERVICE_ACCOUNT_PATH" ] && [ -f "$SERVICE_ACCOUNT_PATH" ]; then
        SERVICE_ACCOUNT_JSON=$(cat "$SERVICE_ACCOUNT_PATH")
        supabase secrets set FIREBASE_SERVICE_ACCOUNT="$SERVICE_ACCOUNT_JSON"
        echo "✅ 서비스 계정 설정 완료"
    fi
fi

# Edge Function 배포
echo ""
echo "🚀 Edge Function 배포 중..."
supabase functions deploy send-push-notification

echo ""
echo "=========================================="
echo "  ✅ 배포 완료!"
echo "=========================================="
echo ""
echo "다음 단계:"
echo "1. Supabase 대시보드 → Edge Functions 에서 함수 확인"
echo "2. 앱에서 경기 등록하여 푸시 테스트"
echo ""
