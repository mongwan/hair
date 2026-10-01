import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore/lite';
import { db } from './firebase';
import { resolveSource } from './source';
import { getClientId, getMyVote, getSavedName, setMyVote, setSavedName } from './storage';
import { STYLES, type HairStyle } from './styles';
import 'wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css';
import './style.css';

const source = resolveSource();
const clientId = getClientId();

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

// ---------- 토스트 ----------
const toast = $<HTMLDivElement>('#toast');
let toastTimer: number | undefined;

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

// ---------- 이미지 크게 보기 ----------
const viewer = $<HTMLDialogElement>('#viewer');
const viewerImg = $<HTMLImageElement>('#viewer-img');
const viewerCaption = $<HTMLParagraphElement>('#viewer-caption');

function openViewer(style: HairStyle): void {
  viewerImg.src = style.image;
  viewerImg.alt = style.name;
  viewerCaption.textContent = style.name;
  viewer.showModal();
}

viewer.addEventListener('click', () => viewer.close());

// ---------- 후보 카드 + 투표 ----------
const list = $<HTMLOListElement>('#styles');
const voteStatus = $<HTMLParagraphElement>('#vote-status');
const voteButtons = new Map<string, HTMLButtonElement>();
let myVote = getMyVote();
let voting = false;

function renderCard(style: HairStyle): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'card';
  item.dataset.id = style.id;

  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.className = 'card-image';
  imageButton.setAttribute('aria-label', `${style.name} 크게 보기`);
  imageButton.addEventListener('click', () => openViewer(style));

  const img = document.createElement('img');
  img.src = style.image;
  img.alt = style.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  imageButton.append(img);

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('h3');
  title.textContent = style.name;

  const description = document.createElement('p');
  description.textContent = style.description;

  const vote = document.createElement('button');
  vote.type = 'button';
  vote.className = 'vote';
  vote.addEventListener('click', () => castVote(style.id));
  voteButtons.set(style.id, vote);

  body.append(title, description, vote);
  item.append(imageButton, body);
  return item;
}

function renderVoteState(): void {
  for (const [id, button] of voteButtons) {
    const selected = id === myVote;
    button.textContent = selected ? '✓ 투표함' : '이걸로!';
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = voting;
    button.closest('.card')?.classList.toggle('selected', selected);
  }
  voteStatus.hidden = !myVote;
}

async function castVote(styleId: string): Promise<void> {
  if (voting || styleId === myVote) return;
  voting = true;
  renderVoteState();
  try {
    await setDoc(doc(db, 'votes', clientId), {
      styleId,
      source,
      updatedAt: serverTimestamp(),
    });
    myVote = styleId;
    setMyVote(styleId);
    showToast('투표 완료! 고마워요 🙏');
  } catch (error) {
    console.error(error);
    showToast('투표를 저장하지 못했어요. 잠시 후 다시 눌러주세요.');
  } finally {
    voting = false;
    renderVoteState();
  }
}

list.append(...STYLES.map(renderCard));
renderVoteState();

// ---------- 의견 남기기 ----------
const form = $<HTMLFormElement>('#comment-form');
const nameInput = $<HTMLInputElement>('#name');
const bodyInput = $<HTMLTextAreaElement>('#body');
const counter = $<HTMLSpanElement>('#counter');
const submit = $<HTMLButtonElement>('#submit');

nameInput.value = getSavedName();

const updateCounter = () => {
  counter.textContent = `${bodyInput.value.length}/${bodyInput.maxLength}`;
};
bodyInput.addEventListener('input', updateCounter);
updateCounter();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim() || '익명';
  const body = bodyInput.value.trim();
  if (!body) {
    showToast('코멘트를 입력해주세요.');
    bodyInput.focus();
    return;
  }

  submit.disabled = true;
  try {
    await addDoc(collection(db, 'comments'), {
      name,
      body,
      source,
      createdAt: serverTimestamp(),
    });
    setSavedName(nameInput.value.trim());
    bodyInput.value = '';
    updateCounter();
    showToast('의견 고마워요! 💌');
  } catch (error) {
    console.error(error);
    showToast('전송하지 못했어요. 잠시 후 다시 시도해주세요.');
  } finally {
    submit.disabled = false;
  }
});
