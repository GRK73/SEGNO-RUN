# Plan-B RHYTHM

PixiJS 8와 React 19를 기반으로 제작된 고성능 웹 리듬 게임 프로젝트입니다. 마우스 휠을 이용한 실시간 캐릭터 스위칭과 비대칭 입력을 핵심 메카니즘으로 합니다.

## 🎮 주요 기능 (Core Features)

### 1. 하이브리드 입력 시스템
- **Keyboard:** 상단 레인(Upper Lane)의 일반/롱노트 처리.
- **Mouse Click:** 하단 레인(Lower Lane)의 일반/롱노트 처리.
- **Mouse Wheel:** 캐릭터 스위칭(Wheel Up/Down) 및 스위칭 노트 처리.

### 2. 가변 로스터 및 캐릭터 시스템
- **5인의 캐릭터:** 빕어(Red), 한세긴(Green), 송밤(Blue), 나비(Yellow), 크앙희(Magenta).
- **실시간 스위칭:** 휠 조작을 통해 로스터 내 캐릭터를 즉시 전환.
- **캐릭터 판정:** 노트에 할당된 캐릭터와 현재 활성화된 캐릭터가 일치해야 정답 판정.

### 3. 정밀한 게임플레이 로직
- **롱노트(Long Note):** 홀딩 상태 실시간 렌더링, 틱 기반 콤보 증가, 오토 컴플리트 및 조기 떼기 감지. 상/하단 레인(키보드/마우스)의 롱노트 상태를 원천 분리하여 완벽한 동시 입력 지원.
- **엄격해진 판정:** PERFECT(±50ms), GREAT(±130ms) 윈도우 채택 (그 외엔 즉시 MISS 처리). 타격 시 커스텀 폰트를 적용한 판정 텍스트 애니메이션 피드백 제공.
- **오디오 동기화:** Web Audio API를 이용해 오디오 재생 시간과 시각 요소를 16ms 이내의 오차로 동기화.
- **오브젝트 풀링:** 노트 및 이펙트 객체 재사용을 통해 가비지 컬렉션 부하 최소화.

### 4. 통합 채보 에디터 (Integrated Editor)
- **타임라인 편집:** BPM 기반 그리드 시스템 및 줌(Zoom) 기능. Web Audio API 적용으로 정밀하고 끊김 없는 재생/탐색 제공.
- **시각적 편집:** 노트에 할당된 캐릭터 보유 색상이 인게임/에디터 양쪽에 즉각 반영되며 실시간 캐릭터 프리뷰 가능.
- **데이터 관리:** JSON 형식의 채보 EXPORT 및 LOAD 기능.
- **메타데이터 설정 UI:** 곡 제목, 아티스트, BPM, 등장 캐릭터 로스터(Roster)를 에디터 좌측 패널에서 직접 입력·수정 가능.

## 🛠 기술 스택 (Tech Stack)

- **Frontend:** React 19, TypeScript
- **Rendering:** PixiJS 8 (WebGPU/WebGL)
- **Audio:** Web Audio API
- **Build Tool:** Vite 8

## 📂 프로젝트 구조 (Structure)

```text
src/
├── core/               # 기초 엔진 (GameEngine, AudioManager, InputManager 등)
├── game/               # 게임 로직 (NoteManager, JudgmentSystem, CharacterManager 등)
├── components/         # React UI (SongSelect, ChartEditor, MobileWarning 등)
├── assets/             # 정적 이미지 리소스
public/
└── assets/
    ├── audio/          # 오디오 파일 (.mp3)
    └── charts/         # 채보 파일 (.json)
```

## 🚀 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드 및 최적화
npm run build
```
