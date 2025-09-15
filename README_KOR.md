# ComfyMobileUI

*다른 언어로 읽기: [English](README.md)*

<div align="center">

![ComfyMobileUI Icon](./public/icons/icon-192x192.png)

**ComfyUI를 위한 모바일 우선 현대적 웹 인터페이스**
*전문적인 AI 이미지 생성 워크플로우를 손끝으로*

![TypeScript-React](https://img.shields.io/badge/TypeScript-React-blue?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-Next_Generation_Frontend-646CFF?style=for-the-badge&logo=vite)
![Mobile First](https://img.shields.io/badge/Mobile-First_Design-success?style=for-the-badge&logo=mobile)
![PWA](https://img.shields.io/badge/PWA-Progressive_Web_App-purple?style=for-the-badge&logo=pwa)

[⭐ **이 프로젝트가 유용하다면 스타를 눌러주세요!** ⭐](#지원하기)

</div>

---

## 개발 배경과 동기

저는 ComfyUI를 사용하기 위해 컴퓨터 책상 앞에 앉아서 오랜 시간을 보내는게 불편하다고 느꼈습니다. 대부분의 작업은 워크플로우를 단순히 **실험**하는 것인데도 불구하고요. (단순히 매개변수를 조정하고, 다양한 설정을 테스트하고, 아이디어를 반복하는 과정이죠)

책상에 묶여있지 않고 소파에서 편안하게 이 기능들을 즐기고 싶었기 때문에 처음엔 ComfyUI를 모바일 브라우저로 접속해보았으나 ComfyUI는 복잡한 워크플로우 생성에는 뛰어나지만 모바일 경험이 상당히 불편했습니다. 그래서 저는 **워크플로우 사용과 실험**에 최적화된 모바일 우선 인터페이스를 만들었습니다. 

**ComfyMobileUI**는 이런 필요에서 탄생했으며 다음 기능에 집중했습니다.
- **어디서나 편안하게** 워크플로우 사용
- 복잡한 생성보다는 **실험에 집중**
- 빠른 매개변수 조정을 위한 **모바일 편의성 활용**
- **워크플로우 사용 과정 간소화**

**복잡한 워크플로우 생성은 여전히 ComfyUI 데스크톱 인터페이스 사용을 권장하며, 생성된 워크플로우를 ComfyMobileUI에서 가져와 사용하시는 것을 권장합니다.

---

## 기능

### **핵심 워크플로우 기능**
- **워크플로우 업로드**: 표준 ComfyUI 워크플로우 파일 가져오기 (비API 형식)
- **스냅샷 시스템**: 전체 히스토리와 함께 특정 워크플로우 상태 저장 및 복원
- **워크플로우 실행**: 실시간 진행률 추적과 함께 원터치 실행
- **큐 관리**: 실행 큐 보기, 중단 및 관리
- **간단한 노드 편집**: 기본적인 노드 위치 변경 및 연결 수정
- **위젯 값 편집**: 모바일 최적화 컨트롤로 노드 매개변수 수정

### **편의 기능**
- **Watchdog 재부팅**: ComfyUI 서버 프로세스 재시작 (서버가 완전히 응답하지 않더라도!)
- **서버 동기화**: ComfyUI 서버에서 워크플로우 다운로드 및 업로드
- **모델 다운로드**: URL 링크를 사용한 모델 다운로드
- **간단한 모델 탐색기**: 트리거 워드 저장 및 검색과 함께 모델 탐색
- **미디어 브라우저**: input, output, temp 폴더의 이미지/비디오 보기 및 관리
- **데이터 백업**: 브라우저 데이터 백업 및 복원 기능

### **워크플로우 편의 도구**
- **내장 Fast Group Bypassor**: 노드 그룹을 빠르게 바이패스/활성화
- **내장 Fast Group Mutor**: 노드 그룹을 빠르게 음소거/음소거 해제
- **시드 랜덤화**: 워크플로우의 모든 시드를 수동으로 랜덤화
- **트리거 워드 검색**: 트리거 워드를 미리 저장해두고 워크플로우에서 쉽게 복사하기

### **모바일 최적화 인터페이스**
- **프로그레시브 웹 앱**: 네이티브와 같은 경험을 위해 모바일 기기에 설치 가능
- **터치 제스처**: 롱 프레스, 핀치 줌, 드래그 팬
- **반응형 디자인**: 모든 기기 크기에서 원활한 경험
- **최적화된 성능**: 모바일 하드웨어를 위한 효율적인 렌더링

---

## 노드 패치 시스템

### **고급 사용자를 위한 기능**

ComfyUI의 다양한 커스텀 노드들은 종종 노드 작성자가 작성한 특별한 규칙을 JS 스크립트로 포함하며, 이는 ComfyUI의 확장 시스템과 긴밀하게 통합되어 있습니다. 게다가 일부 커스텀 노드들은 `/object_info`에 필수 입력정보가 없었기 때문에 API 용 포맷으로 변환하는 것이 어려웠습니다 (특히 Power Lora Loader (rgthree) 노드가 그렇습니다). 이를 해결하기 위해 특정 노드 타입에 대한 위젯 슬롯 패치를 허용하는 **노드 패치 시스템**을 구현했습니다.

### **패치 범위**
- **글로벌**: 모든 워크플로우에서 특정 타입의 모든 노드에 적용
- **워크플로우**: 특정 워크플로우 내의 특정 노드 타입에 적용
- **특정 노드**: 워크플로우 내의 특정 노드 ID에만 적용

### **사용 사례**
- object_info에 나타나지 않는 **누락된 위젯 추가**
- **위젯 타입 재정의** (아마도 Int 위젯을 미리 정의된 값을 위한 Combo로 변환하는 것이 가능)
- 일부 커스텀 노드의 **호환성 문제 해결**
- 모바일 사용을 위한 **노드 동작 커스터마이징**

*이 시스템의 유용성은 아직 탐구 중이지만, 고급 사용자를 위한 기능을 제공합니다.*

---

## 설치

### **필수 요구사항**
- Node.js 18+ 및 npm
- ComfyUI 서버 실행 (일반적으로 `http://localhost:8188`)
- **필수**: ComfyMobileUI API 확장

### **중요: API 확장 설정**

**이 단계는 필수입니다** - ComfyMobileUI가 제대로 작동하려면 API 확장이 필요합니다.

1. **API 확장 복사**:
   ```bash
   # comfy-mobile-ui-api-extension 전체 폴더를 ComfyUI custom_nodes 디렉토리에 복사
   cp -r comfy-mobile-ui-api-extension /path/to/your/comfyui/custom_nodes/
   ```

2. **ComfyUI 재시작**:
   ```bash
   # ComfyUI 시작 - API 확장이 자동으로 설치되고 실행됩니다
   python main.py --enable-cors-header
   ```

**중요**: API 확장은 ComfyMobileUI가 의존하는 핵심 기능(거의 대부분의 기능)을 제공합니다. 이것 없이는 앱이 제대로 작동하지 않습니다.

### **개발 설정**

```bash
# 저장소 클론
git clone https://github.com/jaeone94/comfy-mobile-ui.git
cd ComfyMobileUI

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 브라우저에서 열기
# http://localhost:5173으로 이동
```

### **프로덕션 빌드**

```bash
# 프로덕션용 빌드
npm run build

# 프로덕션 빌드 미리보기
npm run preview

# 코드 린트
npm run lint
```

### **ComfyUI 서버 설정**

ComfyUI 설치에서 확인사항:

1. **API 확장 설치**: `comfy-mobile-ui-api-extension`을 `custom_nodes/`에 복사
2. **CORS 활성화**: `--enable-cors-header` 플래그로 시작
3. **네트워크 액세스**: 네트워크 액세스를 위해 `--listen 0.0.0.0` 사용 (선택사항)

```bash
# ComfyUI 시작 명령 예시
python main.py --enable-cors-header --listen 0.0.0.0
```

---

## 사용법

### **시작하기**

1. **API 확장 설정**: ComfyUI에 필수 API 확장 설치
2. **ComfyUI 연결**: 앱이 로컬 ComfyUI 서버를 자동 감지
3. **워크플로우 가져오기**: JSON 워크플로우 파일을 드래그 앤 드롭하거나 가져오기 대화상자 사용 
(워크플로우 정보가 내장된 PNG 파일도 가능)
4. **간단한 편집**: 노드를 탭하여 모바일 친화적 컨트롤로 매개변수 편집
5. **워크플로우 실행**: 플로팅 액션 버튼을 사용하여 워크플로우 실행

### **주요 상호작용**

- **싱글 탭**: 노드 선택 및 매개변수 편집기 열기
- **롱 프레스**: 노드에서 - 연결 모드 진입; 캔버스에서 - 노드 재배치 모드 진입
- **더블 탭**: 탭한 위치에 새 노드 삽입
- **핀치 제스처**: 캔버스 확대/축소
- **드래그**: 큰 워크플로우 주변 이동

### **워크플로우 관리**

- **가져오기**: JSON 파일이나 서버에서 워크플로우 로드
- **편집**: 모바일 최적화 위젯으로 매개변수 수정
- **실행**: 실시간 진행률과 함께 원터치 실행
- **저장**: 썸네일 미리보기와 함께 자동 브라우저 저장
- **내보내기**: 워크플로우를 JSON 파일로 저장

---

## 개발

### **프로젝트 구조**

```
src/
├── components/          # React 컴포넌트
│   ├── canvas/         # 캔버스 렌더링 및 상호작용
│   ├── controls/       # UI 컨트롤 및 패널
│   ├── workflow/       # 워크플로우 관리 컴포넌트
│   └── ui/            # 재사용 가능한 UI 컴포넌트 (shadcn/ui)
├── core/              # 비즈니스 로직 및 서비스
│   └── services/      # 핵심 서비스 구현
├── hooks/             # 커스텀 React 훅
├── infrastructure/    # 외부 통합
│   ├── api/          # ComfyUI API 클라이언트
│   ├── storage/      # IndexedDB 작업
│   └── websocket/    # 실시간 통신
├── shared/           # 공유 유틸리티 및 타입
│   ├── types/        # TypeScript 타입 정의
│   └── utils/        # 유틸리티 함수
└── test/             # 테스트 유틸리티 및 통합 테스트
```

### **핵심 기술**
- **React 19** with TypeScript - 타입 안전 개발
- **Vite** - 초고속 개발 및 최적화된 빌드
- **Tailwind CSS + shadcn/ui** - 일관되고 접근 가능한 디자인 시스템
- **Framer Motion** - 부드러운 애니메이션 및 전환

---

## 테스트

프로젝트에는 두 가지 주요 통합 테스트가 포함되어 있습니다:

### **API 형식 변환 테스트**
JSON에서 API 형식으로의 완전한 워크플로우 파이프라인 테스트:
- JSON → Graph 변환
- Graph → ComfyUI API 형식
- API 구조 검증
- 선택적 서버 실행 테스트

```bash
# API 형식 변환 테스트 실행
npx tsx --tsconfig tsx.config.json tests/integration/convertToApiFormatTest.ts <workflow-file>

# 서버 실행 포함
npx tsx --tsconfig tsx.config.json tests/integration/convertToApiFormatTest.ts <workflow-file> --execute
```

### **직렬화 일관성 테스트**
JSON ↔ Graph ↔ JSON 변환의 일관성 테스트:
- 원본 JSON → Graph → 직렬화된 JSON
- 변환 사이클을 통해 워크플로우가 무결성을 유지하는지 검증

```bash
# 직렬화 테스트 실행
npx tsx --tsconfig tsx.config.json tests/integration/serializationTest.ts <workflow-file>

# 커스텀 서버 사용
npx tsx --tsconfig tsx.config.json tests/integration/serializationTest.ts <workflow-file> --server http://localhost:8188
```

**참고**: 두 테스트 모두 실행 중인 ComfyUI 서버가 필요하며 디버깅을 위한 상세한 출력 파일을 생성합니다.

---

## 알려진 문제

### **현재 제한사항**
- **터치 문제**: 가끔 터치 반응성 문제나 스크롤 문제
  - **해결책**: 브라우저를 새로고침하거나 브라우저 앱을 재시작하세요
- **모바일 성능**: 큰 워크플로우는 오래된 모바일 기기에서 느릴 수 있음
- **브라우저 캐시**: 변경사항에 하드 새로고침(Ctrl+F5)이 필요할 수 있음
- **rgthree 노드 호환성**: 일부 rgthree 노드가 제대로 작동하지 않거나 기능이 누락될 수 있음
  - **해결책**: 워크플로우가 ComfyUI에서는 실행되지만 모바일 앱에서 실패하는 경우, 문제가 있는 rgthree 노드를 동등한 표준 노드로 교체해보세요

### **해결 방법**
- **브라우저 새로고침**: 대부분의 UI 문제는 간단한 새로고침으로 해결됩니다
- **캐시 지우기**: 문제가 지속되면 브라우저 캐시를 지우세요
- **브라우저 재시작**: 지속적인 문제에 대해서는 브라우저를 닫았다가 다시 여세요
- **노드 교체**: 지원되지 않는 rgthree 노드를 호환 가능한 대안으로 교체

### **문제 신고**
ComfyUI에서는 작동하지만 ComfyMobileUI에서 실패하는 워크플로우를 발견하면:
1. 가능한 경우 **문제가 있는 노드를** 표준 ComfyUI 노드로 교체
2. 워크플로우 파일을 첨부하여 GitHub에 **문제를 신고**
3. 문제를 일으키는 **노드를 명시**
4. 호환성 문제를 신속하게 해결하도록 노력하겠습니다

---

## 기여하기

**기여는 언제나 환영합니다!**

### **코드 품질 안내**
이 앱의 대부분은 "바이브 코딩"(빠른 프로토타이핑, Claude Code 사용. 그는 신이야)으로 개발되었으므로 코드 품질이 떨어질 수 있습니다. 양해를 부탁드리며 개선을 환영합니다!

### **기여 방법**
1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 열기

### **개발 가이드라인**
- TypeScript strict 모드 요구사항 준수
- 제공된 ESLint 설정 사용
- 새 기능에 대한 테스트 작성
- 모바일 호환성 보장
- 기존 컴포넌트 패턴 따르기

---

## 지원하기

⭐ **이 앱이 유용하다면 스타를 눌러주세요!** ⭐

여러분의 지원은 프로젝트 성장에 도움이 되고 지속적인 개발 동기를 부여합니다.

---

## 라이센스

이 프로젝트는 MIT 라이센스 하에 라이센스됩니다 - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 감사의 말

- **ComfyUI**: 이 모든 것을 가능하게 한 강력한 백엔드
- **shadcn/ui**: 아름답고 접근 가능한 컴포넌트 라이브러리
- **Tailwind CSS**: 유틸리티 우선 CSS 프레임워크
- **React Team**: 놀라운 React 프레임워크
- **ComfyUI 커뮤니티**: 영감과 피드백

---

## 로드맵

- [ ] **코드 품질**: 코드 품질 리팩터링 및 개선
- [ ] **알려진 버그 수정**: 알림된 버그 지속 수정
- [ ] **성능**: 더 나은 모바일 성능 최적화
- [ ] **UI 다듬기**: 향상된 모바일 인터페이스 개선

---

<div align="center">

**ComfyUI 커뮤니티를 위해 ❤️을 담아 제작**

*소파에서 ComfyUI를 즐기세요!*

</div>