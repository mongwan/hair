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
    name: '투블럭 댄디컷',
    description: '옆은 짧게, 윗머리는 자연스럽게 내린 깔끔한 스타일',
    image: '/images/style-01.webp',
  },
  {
    id: 'style-02',
    name: '가르마펌',
    description: '6:4 가르마에 볼륨을 살린 부드러운 인상',
    image: '/images/style-02.webp',
  },
  {
    id: 'style-03',
    name: '애즈펌',
    description: '앞머리를 C컬로 넘겨 이마를 살짝 드러낸 스타일',
    image: '/images/style-03.webp',
  },
  {
    id: 'style-04',
    name: '리프컷',
    description: '레이어드로 가볍게, 끝을 바깥으로 흐르게',
    image: '/images/style-04.webp',
  },
];
