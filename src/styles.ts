export interface HairStyle {
  id: string;
  name: string;
  description: string;
  image: string;
}

// id를 바꾸면 firestore.rules의 validStyle 목록도 함께 수정
export const STYLES: HairStyle[] = [
  {
    id: 'style-01',
    name: '텍스처드 크롭',
    description: '확 짧게 자르고 앞머리로 이마를 적당히 덮는 커트. 웨이브가 윗머리 질감으로 살아나요.',
    image: '/images/crop.webp',
  },
  {
    id: 'style-02',
    name: '가르마',
    description: '짧은 길이에 가르마를 타서 이마를 드러낸 단정한 스타일. 모양 유지엔 가르마펌이 필요할 수 있어요.',
    image: '/images/part.webp',
  },
  {
    id: 'style-03',
    name: '쉐기 컷',
    description: '턱선~목 길이로 줄이고 층을 많이 낸 레이어드. 숱이 가벼워지고 웨이브가 살아 손질이 쉬워요.',
    image: '/images/shaggy.webp',
  },
  {
    id: 'style-04',
    name: '소프트 멀릿',
    description: '앞과 옆은 짧게, 뒷머리는 목을 덮을 정도로 남겨 자연스럽게 이어지는 스타일.',
    image: '/images/mullet.webp',
  },
];
