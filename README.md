# 우주 여행 (Space for Kids) 🚀🌌

**4~7세 아이들을 위한 인터랙티브 우주 시뮬레이션** — 태양계부터 은하까지 줌으로 여행하고, 로켓을 발사하고, 지구의 나라들을 비행기로 탐험합니다. 외부 에셋 없이 전부 코드로 생성되며, 브라우저(아이패드 포함)에서 바로 실행됩니다.

> An interactive space simulation for kids (ages 4–7), in Korean. Kepler-accurate solar system, galaxy-scale zoom journey, star-finding game, rocket trips, and an Earth globe with airplane travel. Everything is procedurally generated — no external assets.

## 기능

### 🪐 우주 탐험
- **태양계** — 8행성 + 달 + 토성 고리. NASA JPL J2000 궤도 요소 기반 **케플러 궤도**로 정확하게 공전 (타원 궤도, 근일점 가속까지 재현)
- **4단계 줌 여행** — 휠/핀치로 줌아웃하면 태양계 → 이웃 별들 → 우리은하(파티클 6만 개) → 국부은하군(안드로메다·마젤란)으로 자연스럽게 전환
- 행성을 탭하면 카메라가 따라가며 한글 이름과 설명을 **음성으로 읽어줌** (Web Speech API)
- 시간 조절 🐢▶️🚀, 줌 레벨 점프 버튼

### ⭐ 별 찾기 게임
- 첫 실행 때 **아이 이름을 등록**하면 아이마다 자기 색깔의 별이 생김 (localStorage 저장 — 한 번만 입력)
- 버튼을 누르면 별이 우주 어딘가에 숨고, 화면 가장자리 **화살표가 방향을 안내**
- 별을 찾으면 꽃가루 축하 + 음성 칭찬 🎉

### 🚀 로켓 여행
- 지구 발사대에서 카운트다운과 함께 SpaceX 스타일 로켓 발사
- 목적지(행성·달·태양·숨은 별)를 고르면 자동 비행, 드래그로 직접 조향, 🔥 부스터로 가속
- 도착하면 행성 궤도를 돌며 음성 소개

### 🌍 지구 알아보기
- 실제 국가 경계([world-atlas](https://github.com/topojson/world-atlas)) 데이터로 그린 지구본
- 대륙 7곳 소개 + 나라 12곳을 **비행기로 대권항로 여행** (이륙→순항→착륙, 컨트레일)
- 도착하면 국기·이름·재미있는 설명을 음성으로

## 시작하기

```bash
git clone <repo-url>
cd space-for-kids
npm install
npm run dev          # http://localhost:5173
```

아이패드 등 다른 기기에서 보려면:

```bash
npm run dev -- --host   # 같은 와이파이에서 표시된 Network 주소로 접속
```

정적 배포(Cloudflare Pages, Netlify, GitHub Pages 등):

```bash
npm run build           # dist/ 폴더를 그대로 배포
```

## 사용법

1. 첫 화면에서 **아이 이름 등록** (최대 4명, 자동 저장 — 다음부터는 묻지 않아요)
2. "우주로 출발! 🚀" → 행성을 콕콕 눌러보고, 휠로 우주 끝까지 줌아웃
3. 좌하단 ⭐ 버튼 = 별 찾기 게임 / 좌상단 🚀 = 로켓 여행 / 🌍 = 지구 알아보기 / 🏠 = 처음으로

## 기술 스택

- [Three.js](https://threejs.org/) + [Vite](https://vitejs.dev/) (vanilla JS, 프레임워크 없음)
- 케플러 방정식 뉴턴법 풀이 (`src/kepler.js`) — NASA JPL 근사 궤도 요소 내장
- 모든 텍스처·사운드 절차 생성 (행성 표면 = 캔버스, BGM = WebAudio 오실레이터)
- 한국어 TTS: Web Speech API (`ko-KR`)
- 국가 경계: world-atlas TopoJSON + topojson-client (로컬 번들, 오프라인 동작)

## 브라우저

크롬·사파리·엣지 최신 버전. 음성은 한국어 TTS 보이스가 있는 환경(맥·iOS·윈도우 기본 포함)에서 나옵니다. 소리는 첫 터치 후에 활성화됩니다(브라우저 정책).

## 이미지 출처

지구 알아보기 모드의 나라·명소 사진(`public/images/`)은 모두 [Wikimedia Commons](https://commons.wikimedia.org/)에서 가져온 **자유 이용 가능(Public Domain / CC BY / CC BY-SA)** 이미지입니다. 파일별 저작자·라이선스·원본 링크는 [`public/images/CREDITS.md`](public/images/CREDITS.md)를 참고하세요. 그 외 모든 텍스처·사운드는 코드로 절차 생성됩니다.

## 라이선스

코드: [MIT](LICENSE) · 명소 사진: 각 이미지의 원 라이선스(CREDITS.md 참조)
