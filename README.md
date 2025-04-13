# 펜션 예약 관리 텔레그램 봇

펜션 예약 정보를 실시간으로 확인하고 관리할 수 있는 텔레그램 봇 애플리케이션입니다.

## 주요 기능

- 새로운 예약 자동 알림
- 오늘의 예약 정보 조회
- 플랫폼별 예약 통계 조회
- 기간별 예약 통계 조회
- 예약 검색 기능

## 프로젝트 구조

```
.
├── config/             # 환경 설정 파일 관리
│   └── config.js
├── logs/               # 로그 파일 저장 (자동 생성)
├── node_modules/       # npm 패키지 (자동 생성)
├── src/                # 소스 코드
│   ├── bot/            # 텔레그램 봇 관련 로직
│   │   ├── bot.js      # 봇 인스턴스 생성 및 이벤트 핸들러
│   │   └── commands.js # 봇 명령어 처리 로직
│   ├── db/             # 데이터베이스 관련 로직
│   │   └── db.js
│   ├── utils/          # 유틸리티 함수 (로거 등)
│   │   └── utils.js
│   └── app.js          # 애플리케이션 진입점
├── .env                # 환경 변수 파일 (직접 생성 및 수정 필요)
├── .env.sample         # .env 파일 샘플
├── .eslintrc.js        # ESLint 설정 파일
├── .gitignore          # Git 추적 제외 파일 목록
├── .prettierrc.js      # Prettier 설정 파일
├── ecosystem.config.js # PM2 설정 파일
├── package.json        # 프로젝트 정보 및 의존성 관리
└── README.md           # 프로젝트 설명 문서
```

## 설치 및 실행

### 필수 요구사항

- Node.js 20.12.0 이상
- PostgreSQL 데이터베이스
- 텔레그램 봇 토큰 (BotFather에서 생성)

### 설치 방법

1.  저장소 클론

    ```bash
    git clone <repository_url>
    cd telegram_sender
    ```

2.  의존성 패키지 설치

    ```bash
    npm install
    ```

3.  환경 변수 설정

    `.env.sample` 파일을 복사하여 `.env` 파일을 생성하고, 아래 내용을 참고하여 실제 값으로 수정합니다.

    ```bash
    cp .env.sample .env
    # nano .env 또는 다른 편집기로 .env 파일 수정
    ```

    **`.env` 파일 변수 설명:**

    - `TELEGRAM_BOT_TOKEN`: BotFather로부터 발급받은 텔레그램 봇 토큰
    - `BOT_CHAT_ID`: 봇이 알림을 보낼 기본 채팅 ID (관리자 채팅방 ID 등)
    - `DB_USER`: PostgreSQL 데이터베이스 사용자 이름
    - `DB_HOST`: 데이터베이스 서버 호스트 주소 (예: localhost)
    - `DB_DATABASE`: 사용할 데이터베이스 이름
    - `DB_PASSWORD`: 데이터베이스 사용자 비밀번호
    - `DB_PORT`: 데이터베이스 서버 포트 번호 (기본값: 5432)
    - `NODE_ENV`: 애플리케이션 실행 환경 (`development` 또는 `production`)
    - `LOG_LEVEL`: 로그 레벨 (`debug`, `info`, `warn`, `error`)

4.  데이터베이스 설정

    - PostgreSQL에 `.env` 파일에 설정한 `DB_DATABASE` 이름으로 데이터베이스를 생성합니다.
    - 필요한 테이블 스키마를 생성합니다. (스키마 정보는 별도 문서나 마이그레이션 스크립트를 참고하세요 - 현재 프로젝트에는 포함되지 않음)

### 실행 방법

#### 개발 모드 (nodemon 사용, 코드 변경 시 자동 재시작)

```bash
npm run dev
```

#### 프로덕션 모드 (PM2 사용)

```bash
# PM2 전역 설치 (최초 1회)
npm install -g pm2

# 애플리케이션 시작
pm2 start ecosystem.config.js --env production
```

## PM2 관리 명령어:

```bash
# 애플리케이션 목록 및 상태 확인
pm2 list

# 특정 애플리케이션 로그 확인
pm2 logs telegram_sender

# 애플리케이션 중지
pm2 stop telegram_sender

# 애플리케이션 재시작
pm2 restart telegram_sender

# 애플리케이션 삭제
pm2 delete telegram_sender
```

## 시스템 재부팅 후 자동 시작 설정:

```bash
# 현재 실행 중인 프로세스 목록을 저장하고 시작 스크립트 생성
pm2 startup
# 위 명령 실행 후 출력되는 명령어를 복사하여 실행 (OS에 따라 다름)
# 예: sudo systemctl enable pm2-<user>

# 현재 프로세스 목록 저장
pm2 save
```

## 봇 명령어 목록

- `/start` - 봇 시작 메시지 및 메뉴 표시
- `/today` - 오늘의 예약 정보 조회
- `/stats` - 전체 기간 플랫폼별 예약 통계 조회
- `/stats [period]` - 특정 기간 예약 통계 조회 (`today`, `week`, `month`)
- `/search [options]` - 예약 검색
- `/help` - 도움말 표시

## 예약 검색 명령어 예시

```
/search keyword:홍길동 platform:에어비앤비 status:예약확정 startDate:2023-06-01 endDate:2023-06-30
```

## 코드 품질 (Linting & Formatting)

이 프로젝트는 코드 스타일 일관성 유지 및 잠재적 오류 방지를 위해 ESLint와 Prettier를 사용합니다.

- **코드 스타일 검사 (Linting):**

  ```bash
  npm run lint
  ```

- **코드 자동 포맷팅 (Formatting):**

  ```bash
  npm run format
  ```

VS Code 등의 편집기에서 관련 확장 프로그램을 설치하면 파일을 저장할 때 자동으로 검사 및 포맷팅을 수행하도록 설정할 수 있습니다.

## 로그 파일

로그 파일은 `logs` 디렉토리에 저장됩니다 (PM2 설정 기준):

- `telegram_sender.log` - 일반 로그 (PM2 설정에서 `merge_logs: true` 이므로 에러 로그도 포함될 수 있음)
- `telegram_sender.error.log` - 에러 로그 (PM2 설정에서 `merge_logs: true` 이면 사용되지 않을 수 있음)

로그 레벨은 `.env` 파일의 `LOG_LEVEL` 또는 `ecosystem.config.js`의 환경별 설정에 따라 조절됩니다.

## 라이센스

ISC
