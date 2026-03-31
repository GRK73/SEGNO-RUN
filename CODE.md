# Plan-B RHYTHM - Code Documentation

본 문서는 프로젝트의 주요 클래스 및 함수의 설계 의도와 상세 역할을 설명합니다.

## 0. UI Framework (`src/App.tsx`)
게임의 전역 상태를 제어하며 React-Pixi 브릿지 역할을 수행합니다.
- **State Machine:** `LOBBY`, `LOADING`, `INGAME`, `EDITOR`, `RESULT` 상태를 전환.
- **Session Management:** `gameSessionId`를 PixiCanvas의 `key`로 사용하여 게임 재시작(RETRY) 시 전체 엔진 인스턴스를 초기화하고 새로 생성하도록 제어.
- **Loading Orchestration:** `LOADING` 상태에서 리소스 프리로드 및 `GameEngine.startSong()`을 트리거하고 최소 대기 시간(2.5s)을 보장하여 사용자 경험 최적화.

---

## 1. Core Engine (`src/core`)

### `GameEngine.ts`
게임의 라이프사이클을 관리하는 싱글톤 엔진입니다.
- `startSong()`: 캐릭터 시트 로드, 폰트 체크, 채보 JSON 파싱을 수행. 최근 수정 사항으로 **RETRY 시 오디오 및 페이드아웃 상태(`isFadingOut`)를 명시적으로 초기화**하여 다회차 플레이 시의 안정성을 확보했습니다.
- `gameLoop()`: 델타 타임 기반의 인트로 시퀀스 및 인게임 로직 스케줄링.
  - **Intro Sequence:** `WAITING` -> `READY` -> `GO` 3단계 스테이트 머신을 통해 시네마틱 연출 제어.

### `AudioManager.ts`
Web Audio API를 이용한 정밀 타이머 및 오디오 노드 관리자입니다.
- **Audio Context:** 브라우저의 전역 `AudioContext`를 싱글톤으로 유지.
- **Volume Fading:** `GainNode`를 사용하여 메인 곡 정지 시 부드러운 페이드아웃 처리.
- **Reliability:** 최근 수정 사항으로 `init()` 및 `play()` 루틴에서 `mainGain` 노드가 누락되지 않도록 초기화 보호 로직을 강화했습니다.

### `InputManager.ts`
비대칭 입력(Keyboard + Mouse + Wheel)을 게임 내 공용 커맨드로 추상화 및 브로드캐스팅합니다.

---

## 2. Gameplay Logic (`src/game`)

### `NoteManager.ts`
노트의 물리적 좌표 계산 및 렌더링을 담당합니다.
- `redrawLongNote()`: 롱노트 홀딩 중 남은 길이에 따른 Head/Body/Tail 부분의 실시간 드로잉 업데이트.
- **Pool System:** `ObjectPool`을 통해 판정 이펙트 그래픽 객체를 재활용하여 메모리 단편화 방지.

### `JudgmentSystem.ts`
`AudioManager`의 정밀 시간과 `InputManager`의 이벤트를 매칭하여 판정을 판별합니다.
- **Independence:** 키보드와 마우스의 롱노트 상태(`keyboardHoldNoteId`, `mouseHoldNoteId`)를 분리하여 동시 제어 보장.
- **Stats:** `perfect`, `great`, `miss`, `maxCombo`, `totalDeviation` 정보를 실시간으로 수집하여 게임 종료 후 결과창으로 전달.

### `CharacterManager.ts`
현재 활성화된 캐릭터 정보 및 로스터 순환을 관리합니다.
- `switchNext/Previous`: 마우스 휠 입력을 바탕으로 플레이어 캐릭터를 실시간 교체.

### `HUDManager.ts`
PixiJS 기반의 인게임 UI 렌더링. 캐릭터 아바타, 콤보 텍스트, 판정 텍스트 애니메이션을 수행합니다.

---

## 3. UI Components (`src/components`)

### `SongSelect.tsx`
리듬 게임의 곡을 탐색하고 선택하는 메인 로비 뷰 컴포넌트입니다.
- **디자인 패턴:** 좌측은 곡 리스트, 우측은 선택된 곡의 상세 정보(자켓, 아티스트, 난이도)를 노출.
- **오디오 프리뷰:** 곡 전환 시 브라우저 오디오 객체를 이용해 교차 페이드(Crossfade) 연출 지원.

### `ResultScreen.tsx`
게임 종료 후의 성과를 시각화하는 React 레이어입니다.
- **Scoring:** PERFECT(1.0), GREAT(0.5) 가중치를 적용하여 300,000점 만점 기준으로 환산.
- **Grading:** 점수에 따라 S(28만↑), A(25만↑), B(20만↑), C 등급을 분류.
- **Audio:** 결과 진입 시 `OutSong.mp3` 배경음 및 등급에 따른 전용 사운드 출력.

### `ChartEditor.tsx`
Web Audio API 기반의 정밀 채보 편집 툴입니다. BPM 그리드 스냅, 배속 재생, BPM 리캘큘레이션 및 JSON Export/Import 기능을 제공합니다.

### `SettingsModal.tsx`
오디오 오프셋 조절 및 메트로놈 기반의 오프셋 캘리브레이션 기능을 제공하여 사용자 맞춤형 판정 환경을 지원합니다.

