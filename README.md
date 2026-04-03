# Plan-B RHYTHM

PixiJS 8와 React 19를 기반으로 제작된 고성능 웹 리듬 게임 프로젝트입니다. 마우스 휠을 이용한 실시간 캐릭터 스위칭과 비대칭 입력을 핵심 메카니즘으로 합니다.

## 🎮 주요 기능 (Core Features)

### 1. 하이브리드 입력 시스템
- **Keyboard:** 상단 레인(Upper Lane)의 일반/롱노트 처리. (`Any Key`, `Key Up`)
- **Mouse Click:** 하단 레인(Lower Lane)의 일반/롱노트 처리. (`Left Click`, `Mouse Up`)
- **Mouse Wheel:** 캐릭터 스위칭(Wheel Up/Down) 및 전용 스위치 노드 처리. (150ms 디바운스 적용)

### 2. 가변 로스터 및 캐릭터 시스템
- **5인의 캐릭터:** 빕어, 한세긴, 송밤, 나비, 크앙희. 각 캐릭터별 고유 색상 및 에셋 보유.
- **실시간 스위칭:** 휠 조작을 통해 로스터 내 캐릭터를 즉시 전환하여 노트 판정에 대응.
- **캐릭터 판정:** 특정 노트(일반/롱)에 할당된 캐릭터와 현재 활성화된 캐릭터가 일치해야만 PERFECT/GREAT 판정 가능.
- **스프라이트 시트 애니메이션:** 캐릭터별 달리기(Run), 타격(Hit 1~3), 홀딩(Hold) 스프라이트 시트를 Canvas 기반 메모리 슬라이싱으로 로드하여 실시간 애니메이션 구현.

### 3. 정밀한 게임플레이 로직
- **롱노트(Long Note):** 홀딩 상태 실시간 렌더링, 100ms 단위 틱 기반 콤보 증가, 오토 컴플리트 및 조기 떼기 감지 기능.
- **안정적인 판정 시스템:** PERFECT(±50ms), GREAT(±130ms)의 엄격한 판정 윈도우.
- **오디오 동기화:** Web Audio API를 활용하여 1ms 단위의 정밀한 시간 추적(`getCurrentTimeMS`) 및 시각 요소 동기화.
- **오브젝트 풀링:** Graphics 객체 재사용을 통해 가비지 컬렉션 부하를 최소화하고 프레임 드랍 방지.
- **점수 시스템:** PERFECT(1.0), GREAT(0.5) 가중치 기반 300,000점 만점 환산. 실시간 점수 HUD 표시.
- **동시 노트 연결선:** 상단/하단 레인에 동시에 존재하는 일반 노트를 캐릭터 테마 색 반투명 선 2개로 연결. 타격 즉시 소멸.

### 4. 비주얼 이펙트 시스템
- **일반 노트 타격:** 불규칙 6각별 임팩트 + 8방향 방사선 ray burst + 테마 색 근방의 5각 미니 별 7~10개가 포물선을 그리며 흩어짐. 노트 이미지는 위로 포물선 비행 후 소멸.
- **롱노트 홀드 시작:** 흰색 플래시 + ray burst + 미니 별 동시 발동. 홀드 중 BPM 1/4박자마다 테마 색 테두리 원 팡팡 버스트. head 스프라이트 지속 회전 + 9단계 동심원 그라디언트 glow 표시.
- **롱노트 데코레이션:** 롱노트 body를 따라 ♩♪♫♬ 음표가 일정 간격으로 배치(테마 색 밝게 변형). 음표는 노트와 독립적으로 게임 속도로 스크롤되며, 판정선에 닿으면 랜덤 방향으로 튀어나가 회전하며 소멸.
- **판정선:** 작은 중심 원 + 삼분할 회전 호(Arc) 형태의 애니메이션 판정 서클. 노트보다 낮은 z레이어에 배치.
- **판정 텍스트:** PERFECT/GREAT/MISS 텍스트 등장 시 감쇠 진동 스케일 바운스(1.5x → 오버슈트 → 1.0x 수렴) 후 위로 이동하며 소멸.

### 5. 시네마틱 인트로 & 결과 시스템
- **인트로 시퀀스:** "WAITING" → "READY?" → "GO!"로 이어지는 시네마틱 연출. 전용 인트로 BGM(`startsong.mp3`), 효과음(`ready.mp3`, `go.mp3`) 및 캐릭터 슬라이드 인 애니메이션. READY? 구간부터 채보가 우측에서 미리 날아들기 시작하며, GO! 텍스트가 사라진 후 1초 뒤에 오디오 및 판정이 시작되어 자연스러운 게임 진입을 제공.
- **결과창 (Result Screen):** 스테이지 클리어 후 점수(최대 300,000), 정확도(평균 편차 기반), 최대 콤보, 판정 세부 내역 표시.
- **등급 시스템:** 점수 기반의 S(28만↑)/A(25만↑)/B(20만↑)/C 등급 부여 및 등급별 전용 사운드 출력.
- **게임 종료 연출:** 마지막 노트 후 2초 유지 → 3초 페이드아웃 → 결과창 자동 전환.

### 6. 설정 & 오프셋 캘리브레이션
- **환경설정:** ±1ms/±5ms 단위 오디오 오프셋 조절, 슬라이더(±200ms 범위) 및 `localStorage` 저장.
- **탭 캘리브레이션:** 120BPM 메트로놈에 맞춘 직접 타격을 통해 최적의 개인별 오프셋 자동 계산.

### 7. 통합 채보 에디터 (Integrated Editor)
- **BPM 그리드:** 가변 BPM 및 1/4 ~ 1/8 그리드 스냅 지원 (줌 레벨에 따라 자동 전환).
- **노트 도구:** Normal, Long, Switch Up/Down 노트 및 Eraser 도구. 캐릭터별 색상 매핑.
- **Eraser 기능:** 클릭으로 단일 노트 삭제 + 드래그로 범위 내 모든 노트 일괄 삭제. 드래그 중 빨간 선택 영역 시각 표시.
- **마우스 휠 줌:** 타임라인 위에서 휠 스크롤 시 줌 인/아웃(Shift+휠은 가로 스크롤 유지). 마우스 커서 위치를 기준으로 확대/축소.
- **곡 선택:** 드롭다운으로 곡 선택 시 오디오 로드와 동시에 Title·Artist·Roster 메타데이터 자동 입력.
- **리드인 구간:** 타임라인 시작에 1초 리드인 공간 제공. 재생 시 시커가 리드인 구간을 가로질러 음악 시작점에 도달. 노란 경계선으로 음악 시작 위치 구분.
- **사운드 피드백:** 시커 이동 시 노트 종류별 비프음(마우스: 700Hz, 키보드: 1000Hz) 및 메트로놈 기능.
- **배속 조절:** 0.5x ~ 2.0x 배속 재생을 통한 정밀 검수.
- **BPM Recalculate:** 기존 BPM에서 새 BPM으로 전환 시 모든 노트 타이밍 자동 재계산.
- **Import/Export:** JSON 채보 파일 가져오기 및 내보내기.

### 8. 시네마틱 배경 (Parallax Background)
- **고정 배경:** 인게임 전용 배경 이미지(`ingamebackground.png`) 전체 화면 표시.
- **패럴랙스 레이어:** Far(속도 0.03~0.06, 어두운 톤) / Mid(0.10~0.20, 회색 톤) / Near(0.25~0.40, 원색) 3단 레이어로 빌딩 스크롤.
- **건물 에셋:** 17종 빌딩 텍스처(`building (1~17).png`)를 무작위 선택·배치, 화면 밖으로 나가면 오른쪽 끝에 재배치하여 무한 스크롤.
- **바닥 타일:** `bottom.PNG` 무한 타일 스크롤(속도 0.30). 일시정지 시 정지.

### 9. 일시정지 & 재시작
- **ESC 키 토글:** 일시정지 시 `AudioContext.suspend()`로 완전 정지, 재개 시 `resume()`으로 복구.
- **Pause Menu:** RESUME, RETRY, QUIT 버튼 제공.
- **Session Management:** RETRY 시 `gameSessionId` 갱신으로 PixiCanvas 및 GameEngine 전체 초기화 후 재시작. `AudioContext` 상태를 명시적으로 복구하여 어떤 상태에서든 안정적인 재시작 보장.

## 🛠 기술 스택 (Tech Stack)

- **Frontend:** React 19.2 (Hooks)
- **Rendering:** PixiJS 8.17 (WebGPU/WebGL 가속)
- **Audio:** Web Audio API (`AudioContext`, `GainNode`, `AudioBufferSourceNode`)
- **Build Tool:** Vite 8, TypeScript 5.9
- **Lint:** ESLint 9

## 📂 프로젝트 구조 (Structure)

```text
src/
├── core/                # 시스템 핵심
│   ├── GameEngine.ts    # 싱글톤 게임 엔진 (라이프사이클, 인트로 시퀀스, 게임 루프)
│   ├── AudioManager.ts  # Web Audio API 기반 오디오 (재생, 페이드, SFX, 정밀 타이머)
│   ├── InputManager.ts  # 비대칭 입력 추상화 (키보드/마우스/휠 브로드캐스팅)
│   ├── ObjectPool.ts    # 제네릭 오브젝트 풀 (GC 부하 최소화)
│   ├── AssetLoader.ts   # PixiJS Assets + AudioManager 통합 로더
│   └── PixiCanvas.tsx   # React ↔ PixiJS 브릿지 컴포넌트
├── game/                # 인게임 로직
│   ├── NoteManager.ts   # 노트 스폰/렌더/업데이트/폭발 이펙트
│   ├── JudgmentSystem.ts# 판정 매칭 (PERFECT/GREAT/MISS) 및 통계
│   ├── CharacterManager.ts # 로스터 관리 및 실시간 캐릭터 전환
│   ├── ChartLoader.ts   # 채보 JSON 로더 및 타입 정의
│   ├── HUDManager.ts    # 인게임 UI (아바타, 콤보, 점수, 인트로 텍스트, 바닥 스크롤)
│   └── BackgroundManager.ts # 패럴랙스 배경 (고정 BG + 3단 빌딩 레이어 + 바닥 타일)
├── components/          # React UI
│   ├── SongSelect.tsx   # 곡 선택 로비 (프리뷰 크로스페이드, 난이도 선택)
│   ├── ResultScreen.tsx # 결과 화면 (점수, 등급, BGM)
│   ├── ChartEditor.tsx  # 통합 채보 에디터
│   ├── SettingsModal.tsx# 오프셋 설정 및 캘리브레이션
│   └── MobileWarning.tsx# 모바일 접속 경고
├── utils/
│   └── device.ts        # 모바일 디바이스 감지
├── App.tsx              # 전역 상태 머신 (LOBBY/LOADING/INGAME/EDITOR/RESULT)
└── App.css              # 일시정지 메뉴, 로딩 화면 등 UI 스타일
public/
├── assets/
│   ├── audio/           # 곡, 인트로 BGM, SFX, 등급 보이스 리소스
│   ├── charts/          # JSON 채보 데이터 (곡별 easy/hard)
│   └── images/          # 캐릭터 스프라이트 시트, 노트 이미지(note_0~4, long_note_0~4), 배경, 바닥 타일
│       └── coverimg/    # 앨범 커버 이미지 (20곡, PNG)
└── planb.otf            # 커스텀 게임 폰트
```

## 🚀 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 린트
npm run lint
```
