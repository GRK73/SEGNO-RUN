# Plan-B RHYTHM

PixiJS 8와 React 19를 기반으로 제작된 고성능 웹 리듬 게임 프로젝트입니다. 마우스 휠을 이용한 실시간 캐릭터 스위칭과 비대칭 입력을 핵심 메카니즘으로 합니다.

## 🎮 주요 기능 (Core Features)

### 1. 하이브리드 입력 시스템
- **Keyboard:** 상단 레인(Upper Lane)의 일반/롱노트 처리. (`Any Key`, `Key Up`)
- **Mouse Click:** 하단 레인(Lower Lane)의 일반/롱노트 처리. (`Left Click`, `Mouse Up`)
- **Mouse Wheel:** 캐릭터 스위칭(Wheel Up/Down) 및 전용 스위치 노드 처리.

### 2. 가변 로스터 및 캐릭터 시스템
- **5인의 캐릭터:** 빕어, 한세긴, 송밤, 나비, 크앙희. 각 캐릭터별 고유 색상 및 에셋 보유.
- **실시간 스위칭:** 휠 조작을 통해 로스터 내 캐릭터를 즉시 전환하여 노트 판정에 대응.
- **캐릭터 판정:** 특정 노트(일반/롱)에 할당된 캐릭터와 현재 활성화된 캐릭터가 일치해야만 PERFECT/GREAT 판정 가능.

### 3. 정밀한 게임플레이 로직
- **롱노트(Long Note):** 홀딩 상태 실시간 렌더링, 100ms 단위 틱 기반 콤보 증가, 오토 컴플리트 및 조기 떼기 감지 기능.
- **안정적인 판정 시스템:** PERFECT(±50ms), GREAT(±130ms)의 엄격한 판정 윈도우.
- **오디오 동기화:** Web Audio API를 활용하여 1ms 단위의 정밀한 시간 추적(`getCurrentTimeMS`) 및 시각 요소 동기화.
- **오브젝트 풀링:** Graphics 객체 재사용을 통해 가비지 컬렉션 부하를 최소화하고 프레임 드랍 방지.

### 4. 시네마틱 인트로 & 결과 시스템
- **인트로 시퀀스:** "WAITING" → "READY?" → "GO!"로 이어지는 시네마틱 연출. 전용 인트로 BGM(`startsong.mp3`) 및 캐릭터 슬라이드 인 애니메이션.
- **결과창 (Result Screen):** 스테이지 클리어 후 점수(최대 300,000), 정확도, 최대 콤보, 판정 세부 내역 표시.
- **등급 시스템:** 점수 기반의 S/A/B/C 등급 부여 및 등급별 전용 보이스/효과음 출력.

### 5. 설정 & 오프셋 캘리브레이션
- **환경설정:** ±1ms/±5ms 단위 오디오 오프셋 조절 및 `localStorage` 저장.
- **탭 캘리브레이션:** 메트로놈에 맞춘 직접 타격을 통해 최적의 개인별 오프셋 자동 계산.

### 6. 통합 채보 에디터 (Integrated Editor)
- **BPM 그리드:** 가변 BPM 및 그리드 스냅 지원.
- **사운드 피드백:** 시커 이동 시 노트 종류별 비프음 및 메트로놈 기능.
- **배속 조절:** 0.5x ~ 2.0x 배속 재생을 통한 정밀 검수.

## 🛠 기술 스택 (Tech Stack)

- **Frontend:** React 19 (Hooks, Context)
- **Rendering:** PixiJS 8 (WebGPU 우선 순위 가속)
- **Audio:** Web Audio API (Low Latency)
- **Build Tool:** Vite 8, TypeScript 5.9

## 📂 프로젝트 구조 (Structure)

```text
src/
├── core/               # 시스템 핵심 (GameEngine, AudioManager, InputManager)
├── game/               # 인게임 로직 (NoteManager, JudgmentSystem, CharacterManager)
├── components/         # React UI (Lobby, Editor, Settings, Result)
├── assets/             # 이미지 리소스 (Characters, UI)
public/
└── assets/
    ├── audio/          # 곡, SFX 리소스
    └── charts/         # JSON 채보 데이터
```

## 🚀 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```
