# PRISME-F2

가구 패널 그래프 데이터를 생성하고, 패널 크기 변경이 인접 패널에 전파되는 과정을 **웹 기반 3D**로 시각화하는 MVP입니다.

## 주요 기능

- 패널 = 노드, 인접성 = 엣지
- 접합 면(rect) 정보 기반 전파
- 두께(thickness) 고정
- 분자(모양) 그래프: 노드(구) + 엣지(선)

## 실행 방법

```powershell
npm install
npm run dev
```

## 테스트

```powershell
npm test
```

## 폴더 구조

- `src/main.ts`: Three.js 렌더링 + UI
- `src/graph.ts`: 그래프 모델과 전파 로직
- `src/sampleGraph.ts`: 예시 가구 그래프 데이터
- `tests/graph.test.ts`: 전파 로직 테스트
