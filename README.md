# 펜션 예약 관리 텔레그램 봇

펜션 예약 정보를 실시간으로 확인하고 관리할 수 있는 텔레그램 봇 애플리케이션입니다.

## 주요 기능

- 새로운 예약 자동 알림
- 오늘의 예약 정보 조회
- 플랫폼별 예약 통계 조회
- 기간별 예약 통계 조회
- 예약 검색 기능

## 설치 및 실행

### 필수 요구사항

- Node.js 20.12.0 이상
- PostgreSQL 데이터베이스
- 텔레그램 봇 토큰 (BotFather에서 생성)

### 설치 방법

1. 저장소 클론

```bash
git clone <repository_url>
cd telegram_sender
```

2. 의존성 패키지 설치

```bash
npm install
```

3. 환경 변수 설정

```bash
cp .env.sample .env
# .env 파일을 편집하여 필요한 설정 입력
```

4. 데이터베이스 설정

- PostgreSQL에 데이터베이스를 생성하고 .env 파일에 설정 정보를 입력합니다.

### 실행 방법

#### 개발 모드

```bash
npm run dev
```

#### 프로덕션 모드 (PM2)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

## PM2 관리 명령어:

```bash
# 애플리케이션 시작
pm2 start ecosystem.config.js

# 상태 확인
pm2 status

# 로그 확인
pm2 logs

# 애플리케이션 중지
pm2 stop telegram_sender

# 애플리케이션 재시작
pm2 restart telegram_sender

# 애플리케이션 삭제
pm2 delete telegram_sender
```

## 시스템 재부팅 후 자동 시작 설정:

```bash
pm2 startup
pm2 save
```

## 봇 명령어 목록

- `/start` - 봇 시작 메시지 및 메뉴 표시
- `/today` - 오늘의 예약 정보 조회
- `/stats` - 전체 기간 플랫폼별 예약 통계 조회
- `/stats [period]` - 특정 기간 예약 통계 조회 (today, week, month)
- `/search [options]` - 예약 검색
- `/help` - 도움말 표시

## 예약 검색 명령어 예시

```
/search keyword:홍길동 platform:에어비앤비 status:예약확정 startDate:2023-06-01 endDate:2023-06-30
```

## 로그 파일

로그 파일은 `logs` 디렉토리에 저장됩니다:

- `telegram_sender.log` - 일반 로그
- `telegram_sender.error.log` - 에러 로그

## 라이센스

ISC
