# Plan-B RHYTHM - Code Documentation

본 문서는 프로젝트의 주요 클래스 및 함수의 설계 의도와 상세 역할을 설명합니다.

## 1. Core Engine (`src/core`)

### `GameEngine.ts`
게임의 라이프사이클을 관리하는 싱글톤 클래스입니다.
- `init(container)`: PixiJS Application 생성 및 렌더링 레이어(Game, HUD, Effects) 설정.
- `startSong(audioUrl, chartUrl)`: 에셋 로드 후 `AudioManager`와 `NoteManager`를 동기화하여 게임 시작.
- `setOffset(offset)`: `AudioManager.setOffset()`로 위임하여 전역 오디오 오프셋 설정. `localStorage`에서 읽은 값을 게임 시작 전에 적용.
- `gameLoop(delta)`: 델타 타임을 이용한 프레임 독립적 업데이트. 노트 생성 및 시스템 갱신 트리거.

### `InputManager.ts`
브라우저의 입력을 게임 내 `InputType`으로 추상화합니다.
- **InputType:** `KEYBOARD_ANY`, `KEYBOARD_UP`, `MOUSE_CLICK`, `MOUSE_UP`, `WHEEL_UP`, `WHEEL_DOWN`.
- `handleWheel`: 휠 입력을 정규화하고 데드타임(150ms)을 적용하여 급격한 스위칭 방지.
- `erasableSyntaxOnly` 호환을 위해 `enum` 대신 `const object` 및 `type` 사용.

### `AudioManager.ts`
Web Audio API 기반의 정밀 타이머입니다.
- `getCurrentTimeMS()`: `audioContext.currentTime`을 기준으로 곡의 현재 진행 위치를 ms 단위로 반환. 오프셋이 설정된 경우 자동 적용되어 모든 하위 시스템(노트 스폰, 판정, HUD)이 동일한 보정 시간을 사용.
- `setOffset(ms)`: 오디오 오프셋을 ms 단위로 설정. 양수 = 판정 늦게, 음수 = 판정 빠르게.
- 시각적 싱크를 위해 모든 판정 로직은 이 함수가 반환하는 시간을 절대적 기준으로 삼습니다.

---

## 2. Gameplay Logic (`src/game`)

### `NoteManager.ts`
노트의 시각적 생명주기를 관리합니다.
- `ActiveNote` 인터페이스: 고유 `id`, `NoteData`, `sprite`, `isHolding` 상태를 포함.
- `update(currentTime)`: `currentTime`에 따른 X 좌표 계산 및 롱노트의 몸통/머리/꼬리 실시간 리렌더링.
- **Long Note Rendering:** 홀딩 중일 때 머리를 판정선에 고정하고 남은 시간에 따라 몸통 길이를 조절.

### `JudgmentSystem.ts`
타이밍, 캐릭터 일치 여부, 동시 입력을 종합하여 판정을 수행합니다.
- **판정 범위:** Perfect(50ms), Great(130ms). 범위를 벗어난 입력 및 방치된 노트는 전부 `MISS`.
- **다중 홀딩 독립 추적:** `keyboardHoldNoteId`와 `mouseHoldNoteId`를 완전히 분리하여 다중/동시 입력 시의 간섭(키보드를 떼면 마우스의 롱노트가 떨어지는 현상 등) 원천 차단.
- **이벤트 콜백:** 판정 확정 시 `onJudgment` 콜백을 트리거하여 HUDManager에 투사.
- **캐릭터 검사:** 일반/롱노트의 경우 `note.characterId`와 `CharacterManager.getActiveCharacterId()`가 일치해야 함.

### `CharacterManager.ts`
현재 곡의 로스터와 활성 캐릭터를 관리합니다.
- `CHARACTERS`: 5종 캐릭터 정보 및 파스텔 톤 고유 색상(Hex) 정의.
- `setInitialCharacter(id)`: 곡 진입 첫 노트의 요구 캐릭터를 감지해 첫 화면 캐릭터를 강제 정렬.
- `switchNext() / switchPrevious()`: 휠 입력에 따라 현재 인덱스를 순환 루프 안에서 갱신.

### `HUDManager.ts`
PixiJS Graphics/Text를 이용한 실시간 UI 피드백.
- **판정선 디자인:** 상/하단 라인에 맞춰 타격 지점을 나타내는 반투명 원형 마커 렌더링.
- **플로팅 판정 텍스트:** 노트 타격 및 미스 시 커스텀 폰트(`planb.otf`)를 적용한 `PERFECT`, `GREAT`, `MISS` 텍스트를 대상 판정선 위쪽에 0.5초 동안 떠오르게(Fade-out) 애니메이션 처리.
- **Avatar View:** 현재 캐릭터의 이름과 고유 색상을 사각형 아바타로 중앙에 표시.
- **Combo:** 콤보 발생 시 중앙 상단에 텍스트 업데이트.

---

## 3. Tooling (`src/components`)

### `ChartEditor.tsx`
React 기반의 비주얼 채보 편집기입니다.
- **오디오 플레이어:** 초기 재생 시 HTML Audio의 태생적인 버퍼링 스터터링 렉 방지를 위해, 에디터 내부의 오디오 또한 **Web Audio API (`AudioContext`)**로 메모리에 디코딩한 뒤 `AudioBufferSourceNode`를 통해 정밀하게 컨트롤.
- **동적 타임라인:** 오디오 파일의 실제 길이(`audioBufferRef.current.duration`)를 기준으로 타임라인 자동 확장.
- **노트 사운드 피드백:** `OscillatorNode`를 이용한 프로그래메틱 비프음 생성. 상단레인 1000Hz, 하단레인 700Hz로 구분. 롱노트는 `duration` 길이만큼 지속음 출력. 시커가 노트를 **지난 후에만** 트리거(80ms lookback, 미리 재생 방지).
- **메트로놈:** `square` 파형의 메트로놈 틱. 4박 첫 비트는 1800Hz(강), 나머지는 1400Hz(약)로 구분. `lastMetronomeBeatRef`로 박자 추적.
- **BPM 리캘큘레이션:** Old BPM과 현재 BPM의 그리드 스텝(16분음표) 비율로 모든 노트의 `time`과 `duration`을 재계산. 적용 후 `oldBpm`이 자동 갱신.
- **Import/Export:** `FileReader`와 `Blob` API를 이용해 로컬 JSON 파일을 불러오거나 저장.
- **Note Placement & Color:** 클릭 위치를 BPM 그리드(1/16박)에 스냅(Snap)하여 배치. 배치 시 `characterId` 부여와 함께 인게임과 완전히 동일한 캐릭터 커러를 적용.
- **Metadata Editor:** 에디터 좌측 패널 UI를 통해 곡 정보(제목, 아티스트, BPM) 및 쉼표 구분자 형태의 로스터(Roster) 정보를 실시간 수정.

### `SettingsModal.tsx`
오디오 오프셋 조절 및 캘리브레이션 모달입니다.
- **수동 오프셋:** ±1ms/±5ms 버튼 및 슬라이더(-200ms~+200ms) 조절. `localStorage('audioOffset')`에 영구 저장.
- **탭 캘리브레이션:** 120BPM 메트로놈(`setInterval` 1ms 해상도)을 재생하고, 사용자 TAP 시점과 기대 비트 시점의 차이를 평균 내어 오프셋 자동 계산.
- **UI:** 반투명 백드롭 + `backdrop-filter: blur` 오버레이.
