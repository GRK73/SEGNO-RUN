# Plan-B RHYTHM - Code Documentation

본 문서는 프로젝트의 주요 클래스 및 함수의 설계 의도와 상세 역할을 설명합니다.

## 0. UI Framework (`src/App.tsx`)
게임의 전역 상태를 제어하며 React-Pixi 브릿지 역할을 수행합니다.
- **State Machine:** `LOBBY`, `LOADING`, `INGAME`, `EDITOR`, `RESULT` 상태를 전환.
- **Session Management:** `gameSessionId`를 PixiCanvas의 `key`로 사용하여 게임 재시작(RETRY) 시 전체 엔진 인스턴스를 초기화하고 새로 생성하도록 제어. 일시정지 중 RETRY와 결과창 RETRY 모두 동일한 `handleRetry` 핸들러를 공유.
- **Loading Orchestration:** `LOADING` 상태에서 `GameEngine.startSong()`을 트리거하고 최소 대기 시간(2.5s)을 보장하여 사용자 경험 최적화.
- **Pause System:** ESC 키 토글로 `GameEngine.pause()/resume()`을 호출. `useCallback` + `useEffect` 패턴으로 최신 상태를 반영하는 키보드 이벤트 처리.

---

## 1. Core Engine (`src/core`)

### `GameEngine.ts`
게임의 라이프사이클을 관리하는 싱글톤 엔진입니다.
- **`init()`:** PixiJS `Application` 생성, `InputManager`/`CharacterManager`/`NoteManager`/`JudgmentSystem`/`HUDManager`/`BackgroundManager` 초기화. 판정 → HUD 콜백 배선. `planb` 폰트 사전 로드.
- **`startSong()`:** 캐릭터 스프라이트 시트(run, hit 1~3, hold) 및 노트 이미지(`note_0~4.png`, `long_note_0~4.png`) 프리로드, 채보 JSON 파싱, 오디오 로딩(메인곡 + 인트로곡 + SFX), 로스터 설정, 초기 캐릭터 결정. `AudioContext` 상태를 `resume()`으로 명시적 복구한 후 인트로 재생을 시작하여 일시정지 상태에서의 RETRY 안정성을 보장. `backgroundManager.init()`으로 배경 에셋 로드 및 레이어 초기화. `noteManager.setBpm()`으로 BPM 전달.
- **`gameLoop()`:** 델타 타임 기반 인트로 시퀀스 스테이트 머신(`WAITING` → `READY` → `GO` → `DONE`) 및 인게임 로직(노트 스폰, 판정 업데이트, HUD 업데이트, 게임 종료 감지) 스케줄링. READY 단계 시작 시 `gameStartScheduledTime`(오디오 시작 예정 시각)을 미리 계산하여, 이후 `performance.now() - gameStartScheduledTime`의 음수 시간으로 노트를 미리 스폰·렌더링함으로써 채보가 우측에서 자연스럽게 날아드는 프리뷰 구현. GO! 텍스트는 500ms 후 소멸, 1500ms 후(소멸 1초 뒤) 오디오 시작·판정 활성화. introPhase 중에도 노트 렌더는 수행하되, audioStarted 플래그로 판정 처리 시점을 분리.
- **`pause()/resume()`:** `AudioContext.suspend()/resume()` 연동. `isPaused` 플래그로 게임 루프 진행 제어.
- **Background Update:** PixiJS ticker에서 `isPaused`가 아닐 때 `backgroundManager.update()`를 게임루프보다 먼저 호출하여 배경을 독립적으로 갱신.
- **Game End Flow:** 마지막 노트 종료 후 2초 대기 → `fadeOutMain(3000)` 3초 페이드아웃 → `onGameEnd` 콜백으로 결과 통계 전달.
- **`destroy()`:** 엔진 전체 초기화. PixiJS 앱 파괴(텍스처는 Assets 시스템이 관리하므로 보존), 입력 해제, 모든 상태 플래그 리셋.

### `AudioManager.ts`
Web Audio API를 이용한 정밀 타이머 및 오디오 노드 관리자입니다. 싱글톤 패턴.
- **`init()`:** `AudioContext({ latencyHint: 'interactive' })` 생성 및 `mainGain` 노드 초기화. `loadAudio()` 시 자동 호출.
- **`loadAudio()`:** 메인 곡과 인트로 BGM(`startsong.mp3`)을 병렬 fetch + `decodeAudioData`.
- **`play()`:** 동기 메소드. `playIntro()`에서 이미 `AudioContext`가 running 상태이므로 별도 resume 불필요. `startTime = audioContext.currentTime`과 `source.start(now)`를 동시에 기록하여 타이밍 정합성 보장. (이전 async 방식은 `await resume()` 대기 중 게임 루프가 먼저 돌면서 performance.now() 폴백 → 오디오 시간으로 불연속 점프가 발생했음.)
- **`playIntro()`:** 비동기. `resume()`으로 AudioContext를 활성화한 뒤 인트로 BGM 재생.
- **`fadeOutMain()`:** 30-step `setInterval` 기반 수동 볼륨 감소. `cancelScheduledValues()` 호출 후 `gain.value` 직접 할당 방식으로 Web Audio 스케줄러 충돌을 회피.
- **`fadeOutIntro()`:** `linearRampToValueAtTime`으로 부드러운 인트로 페이드아웃.
- **`loadSFX()` / `playSFX()`:** 이벤트성 효과음 관리. 각 재생 시 독립적인 `GainNode`를 생성하여 동시 재생 지원. 볼륨 80%.
- **`getCurrentTimeMS()`:** `audioContext.currentTime`과 `startTime`의 차이에 사용자 오프셋을 더해 밀리초 단위의 정밀 시간 반환.
- **`pause()` / `resume()`:** `AudioContext.suspend()/resume()` 래핑. `resume()`은 `async/await`으로 완료 보장.
- **`stop()`:** `fadeInterval` 정리 및 소스 중단. `AudioContext` 자체는 유지(재사용).

### `InputManager.ts`
비대칭 입력을 게임 내 공용 커맨드로 추상화하는 싱글톤.
- **6가지 InputType:** `KEYBOARD_ANY`, `KEYBOARD_UP`, `MOUSE_CLICK`, `MOUSE_UP`, `WHEEL_UP`, `WHEEL_DOWN`.
- **Wheel Debounce:** 150ms 간격으로 디바운싱하여 과도한 스위칭 방지.
- **Modifier 필터링:** Alt/Control/Shift/Meta 키 입력 무시.
- **Broadcast:** `onInput()` 콜백 배열에 등록된 모든 리스너에게 입력 이벤트를 전파.

### `ObjectPool.ts`
제네릭 오브젝트 풀. 생성 함수(`createFn`)와 리셋 함수(`resetFn`)를 인자로 받아 `acquire()/release()` 패턴 제공. 초기 풀 크기 설정 가능.

### `AssetLoader.ts`
이미지와 오디오를 통합 로딩하는 유틸리티. PixiJS `Assets.load()`와 `AudioManager.loadAudio()`를 순회 호출.

### `PixiCanvas.tsx`
React 컴포넌트로 PixiJS 캔버스를 DOM에 마운트. `useEffect`에서 `GameEngine.init()`을 호출하며, 언마운트 시 `engine.destroy()`로 정리. `key` prop에 의해 RETRY 시 완전히 재생성됨.

---

## 2. Gameplay Logic (`src/game`)

### `NoteManager.ts`
노트의 물리적 좌표 계산 및 렌더링, 모든 타격 이펙트를 담당합니다.
- **레인 구성:** Upper(Y:250, Keyboard), Lower(Y:450, Mouse), Any(Y:350, Switch).
- **스크롤 속도:** 0.5px/ms, 판정선: X=250. 스폰 위치: `window.innerWidth + 100`.
- **노트 이미지:** 캐릭터 ID → `note_0~4.png` 직접 매핑(0=빕어~4=크앙희). 롱노트 head/tail은 `long_note_0~4.png` 별도 사용. 텍스처 미로드 시 `Graphics` 기반 폴백.
- **롱노트 바디:** 4줄 평행 막대(y: -18, -6, +6, +18, 각 4px) 악보 스타일 렌더링.
- **`spawnNote()`:** 화면 오른쪽 밖(`window.innerWidth + 100`)에서 생성. 룩어헤드: `(window.innerWidth - 150) / 0.5`ms.
- **`update()`:** 활성 노트 위치 업데이트. 롱노트 홀딩 시 `redrawLongNote()`로 실시간 재드로잉 + head 회전. 동시 일반 노트 쌍 연결선 `drawConnections()` 매 프레임 갱신.
- **`setBpm()`:** 홀드 버스트 간격을 BPM 1/4박자 기준으로 설정.
- **`explodeNote()`:** 일반 노트 히트 시 → `spawnStarEffect`(6각별) + `spawnRayBurst`(8방향 방사선) + `spawnMiniStars`(5각 미니 별 산란) + 포물선 비행 노트. MISS/롱노트 종료 시 → 원형 이펙트(ObjectPool 재사용).
- **`setHolding()`:** 홀드 시작 시 흰색 플래시 + `spawnRayBurst` + `spawnMiniStars` 동시 발동. 홀딩 중 BPM 1/4박자마다 테마 색 테두리 원 2개 버스트.
- **`redrawLongNote()`:** 홀딩 중 매 프레임 재드로잉. head 위에 9단계 동심원 그라디언트 glow(테마 색→흰색, 바깥 alpha 0.04→안쪽 0.88) 추가.
- **`drawConnections()`:** ±15ms 내 동시 존재하는 상단/하단 일반 노트를 테마 색 반투명 선 2개(두께 5px)로 연결.
- **`spawnStarEffect()`:** 불규칙 6각별 도형(외각 랜덤 변형) — 내부 fill + 흰 stroke. scale 0.6에서 빠르게 확장 후 소멸.
- **`spawnRayBurst()`:** 중심 30~46px 구간의 짧은 선 8개가 방사형으로 퍼졌다 소멸.
- **`spawnMiniStars()`:** 테마 색 근방 랜덤 색상의 뭉툭한 5각별 7~10개가 포물선을 그리며 흩어지고 점점 작아지며 소멸.
- **롱노트 데코레이션:** `generateDecorations()`로 스폰 시 1회 생성. 음표(♩♪♫♬)를 body 구간 균등 배치(`decorationLayer`에 독립 관리). 매 프레임 `judgmentLineX + (note.time + timeOffset - currentTime) * scrollSpeed`로 절대 좌표 계산(noteContainer와 무관). 판정선 도달 시 `FlyingDecoration`으로 전환되어 랜덤 방향 포물선 비행 + 회전 후 축소 소멸.
- **레이어 구조(하→상):** `decorationLayer` → `container` → `connectionGraphics` → `burstLayer` → `effectLayer` → `flyingLayer` → `starLayer`.
- **Pool System:** `ObjectPool<Graphics>`를 통해 원형 판정 이펙트 객체 재활용.

### `JudgmentSystem.ts`
`AudioManager`의 정밀 시간과 `InputManager`의 이벤트를 매칭하여 판정을 판별합니다.
- **입력 매칭:** 노트 타입과 입력 타입의 대응 관계 처리 (normal/long: 키보드=lane1, 마우스=lane0 / switch_up: WHEEL_UP / switch_down: WHEEL_DOWN).
- **최적 노트 선택:** 판정 윈도우 내 모든 활성 노트 중 시간차가 가장 작은 노트를 선택.
- **캐릭터 일치 검증:** `characterId`가 설정된 노트는 현재 활성 캐릭터와 일치해야만 PERFECT/GREAT 판정 가능.
- **롱노트 독립 추적:** 키보드(`keyboardHoldNoteId`)와 마우스(`mouseHoldNoteId`)의 롱노트 상태를 분리하여 동시 홀딩 지원. 100ms 단위 틱 기반 콤보 증가.
- **Stats:** `perfect`, `great`, `miss`, `maxCombo`, `totalDeviation`, `totalHits` 정보를 실시간으로 수집하여 게임 종료 후 결과창으로 전달.

### `CharacterManager.ts`
현재 활성화된 캐릭터 정보 및 로스터 순환을 관리합니다.
- **CHARACTERS 상수:** 5인의 캐릭터 정보(ID, 이름, 색상, 에셋 프리픽스). 빕어(0), 한세긴(1), 송밤(2), 나비(3), 크앙희(4).
- **에셋 프리픽스:** `bver`(빕어), `segin`(한세긴), `songbam`(송밤), `navi`(나비), `kanghee`(크앙희). 각 캐릭터별 독립 스프라이트 시트(`{prefix}_run/hit_1~3/hold.png`).
- **`setRoster()`:** 곡 메타데이터의 roster 배열로 사용 캐릭터 목록 설정.
- **`setInitialCharacter()`:** 채보의 첫 번째 캐릭터 노트를 기준으로 초기 활성 캐릭터 결정.
- **`switchNext/Previous`:** 마우스 휠 입력 시 로스터 내 순환 인덱스 변경.

### `BackgroundManager.ts`
인게임 패럴랙스 배경 렌더링을 전담하는 클래스.
- **레이어 구성:** `bgSprite`(고정 배경) → `farLayer` → `midLayer` → `bottomContainer` → `nearLayer` 순으로 z-order 배치.
- **`init()`:** `ingamebackground.png` 전체 화면 고정 배경 로드, 17종 빌딩 텍스처(`building (1~17).png`) 병렬 로드, `bottom.PNG` 바닥 타일 초기화, `spawnInitialBuildings()`로 화면 우측 밖에 빌딩 초기 배치.
- **3단 빌딩 레이어:** Far(속도 0.03~0.06, tint 0x444444, 스케일 0.20~0.35) / Mid(0.10~0.20, 0x999999, 0.25~0.40) / Near(0.25~0.40, 0xffffff, 0.42~0.63). 각 레이어 빌딩은 화면 왼쪽 밖으로 나가면 오른쪽 끝에 랜덤 텍스처·스케일·속도로 재배치.
- **바닥 타일:** `bottom.PNG` 80px 고정 높이, 종횡비 유지 타일링. 무한 좌측 스크롤(속도 0.30).
- **`update(delta)`:** `GameEngine` ticker에서 호출. 일시정지 시 호출 안 됨.

### `ChartLoader.ts`
채보 JSON 파일의 타입 정의 및 로더.
- **`ChartMetadata`:** title, artist, bpm, offset, roster.
- **`NoteData`:** time, lane(`0|1|'any'`), type(`normal|switch_up|switch_down|long`), duration(롱노트), characterId, targetCharId.

### `HUDManager.ts`
PixiJS 기반의 인게임 UI 렌더링. 가장 큰 단일 모듈(~540줄).
- **캐릭터 아바타:** `AnimatedSprite` 기반. 캐릭터별 Run/Hit/Hold 스프라이트 시트를 Canvas 슬라이싱으로 분해 후 캐싱. 캐릭터 전환 시 캐시에서 즉시 교체.
- **공격 애니메이션:** `triggerAttack()` 시 랜덤 Hit 프레임 표시 + 300ms 후 Run 복귀. 레인 간 이동 시 슬라이드 효과(`attackSlideY`).
- **홀드 애니메이션:** `startHold()` 시 Hold 프레임 고정 + 사인파 보빙 효과.
- **스위치 애니메이션:** `triggerSwitch()` 시 캐릭터가 위/아래에서 등장하는 바운스 효과(`switchOffsetY ±150px`).
- **콤보 텍스트:** 바운스 스케일 애니메이션(1.3 → 1.0). `planb` 폰트 사용.
- **점수 텍스트:** 화면 우측 상단 고정. 6자리 포맷.
- **판정 텍스트:** PERFECT(노랑), GREAT(시안), MISS(빨강) 색상. 등장 시 scale 1.5에서 시작해 감쇠 진동(`1.0 + 0.55 * e^(-t/55) * cos(t/32)`)으로 바운스 수렴. 위로 이동하며 500ms 후 소멸.
- **판정선:** 상단/하단 레인에 원형 히트 서클 표시.
- **인트로 텍스트:** "READY?"(주황), "GO!"(초록) 텍스트. Pop-in/Pop-out 스케일 애니메이션.
- **바닥 스크롤:** `floor.png` 스프라이트 시트를 3프레임으로 분해, 투명 영역 자동 트리밍 후 무한 타일 스크롤.

---

## 3. UI Components (`src/components`)

### `SongSelect.tsx`
리듬 게임의 곡을 탐색하고 선택하는 메인 로비 뷰 컴포넌트입니다.
- **데이터 구조:** `SONGS` 상수 배열에 곡별 ID, 제목, 아티스트, 오디오/커버/채보(easy/hard) 경로 정의.
- **디자인 패턴:** 좌측은 곡 리스트, 우측은 선택된 곡의 상세 정보(앨범 커버, 난이도 선택 버튼, GAME START 버튼).
- **오디오 프리뷰:** 곡 전환 시 기존 곡 페이드 아웃(50ms × 볼륨 10% 감소) → 새 곡 페이드 인(50ms × 볼륨 5% 증가, 최대 50%). `HTMLAudioElement` 기반.
- **난이도 선택:** Easy/Hard 선택 후 GAME START 버튼 활성화.

### `ResultScreen.tsx`
게임 종료 후의 성과를 시각화하는 React 레이어입니다.
- **Scoring:** PERFECT(1.0), GREAT(0.5) 가중치를 적용하여 300,000점 만점 기준으로 환산.
- **Accuracy:** 평균 편차(totalDeviation / totalHits)를 150ms 기준으로 백분율 변환. MISS는 150ms 페널티 적용.
- **Grading:** 점수에 따라 S(28만↑), A(25만↑), B(20만↑), C 등급을 분류.
- **Audio:** 결과 진입 시 `OutSong.mp3` 배경음(루프, 50% 볼륨) 및 등급에 따른 전용 사운드(`S.mp3`, `A.mp3` 등) 출력. `HTMLAudioElement` 기반.
- **Actions:** MAIN MENU, RETRY 버튼.

### `ChartEditor.tsx`
Web Audio API 기반의 정밀 채보 편집 툴입니다.
- **오디오 재생:** `AudioContext` + `AudioBufferSourceNode` 기반. 배속 변경 시 소스 재생성 + 오프셋 유지.
- **BPM 그리드:** 줌 ≥50에서 1/8비트, 그 외 1/4비트 스냅. 비트/마디별 시각적 구분(일반선, 비트선, 마디선, 서브비트 점선).
- **노트 도구:** Normal(사각), Long(시작→끝 2클릭), Switch Up(삼각 ▲), Switch Down(삼각 ▼), Eraser. 캐릭터별 색상이 노트에 반영.
- **Eraser 드래그:** `eraseStartRef` + `eraseDidDragRef`로 클릭과 드래그를 구분(8px 임계값). 드래그 시 window mousemove/mouseup 이벤트로 `eraseRect` 상태 갱신 → 반투명 빨간 선택 영역 표시 → mouseup 시 시간 범위 및 레인이 겹치는 노트 일괄 삭제.
- **마우스 휠 줌:** `timeline-scroll` 엘리먼트에 `{ passive: false }` non-passive wheel 이벤트 등록. `zoomRef`로 클로저 없이 현재 줌 값 참조. 마우스 x좌표 기준 시간을 고정한 채 `setZoom()` + `scrollLeft` 보정으로 줌 중심 유지. Shift 키 누른 상태에서는 미적용.
- **좌표 변환:** `timeToX(t) = (t + LEAD_IN_MS) * (zoom/100)`, `xToTime(x) = x/(zoom/100) - LEAD_IN_MS`. 롱노트 너비는 오프셋 없는 `durationToW(ms) = ms*(zoom/100)` 별도 사용(혼용 시 롱노트 길이가 1초치 늘어나는 버그 방지).
- **리드인 구간:** `LEAD_IN_MS = 1000`. 타임라인 좌측에 1초 리드인 영역(노란 경계선, 약간 밝은 배경). 재생 시 `pauseTimeRef = -1.0`에서 출발하며, 음수 구간에선 오디오 딜레이 스케줄링(`source.start(ctx + delay, max(0, offset))`). 노트 배치는 `Math.max(0, ...)` clamp로 음수 시간 방지.
- **곡 선택:** `SONG_LIST`에 title·artist·roster 메타데이터 포함. 선택 시 오디오 로드와 동시에 3개 필드 자동 설정.
- **시커:** 빨간 세로선. 타임라인 헤더 드래그로 탐색. 재생 중 자동 스크롤.
- **사운드 피드백:** 노트별 비프음(마우스레인:700Hz, 키보드레인:1000Hz, 롱노트: duration만큼 지속). 메트로놈 ON/OFF.
- **BPM Recalculate:** Old BPM 입력 → RECALC 시 모든 노트의 time과 duration을 새 BPM 그리드에 맞춰 재배치.
- **Import/Export:** JSON 채보 Export(파일 다운로드) 및 Import(파일 업로드).
- **사이드바 구조:** 3개의 accordion 그룹(SONG META / EDIT TOOLS / PLAYBACK & FILE). props-table CSS 테이블 레이아웃.

### `SettingsModal.tsx`
오디오 오프셋 조절 및 메트로놈 기반의 오프셋 캘리브레이션 기능을 제공합니다.
- **Offset 조절:** ±1ms/±5ms 버튼 및 ±200ms 슬라이더. `localStorage` 즉시 저장.
- **Calibration:** 120BPM 메트로놈(1200Hz square wave, 25ms) 재생 → TAP 버튼으로 타격 시간 기록 → 최소 4회 이상 TAP 후 Stop & Apply 시 평균 편차 계산(첫 번째 탭 제외). 계산된 오프셋을 자동 적용.

### `MobileWarning.tsx`
모바일 접속 시 표시되는 경고 컴포넌트. `navigator.userAgent` 기반 감지(`utils/device.ts`).
