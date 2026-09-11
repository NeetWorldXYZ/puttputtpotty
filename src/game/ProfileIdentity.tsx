import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Fit display text to its allotted space without changing the saved profile. */
function useFittedText(ref: RefObject<HTMLElement>, text: string, minimum: number) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let active = true;
    const fit = () => {
      if (!active || !element.clientWidth) return;
      element.style.fontSize = '';
      let size = parseFloat(getComputedStyle(element).fontSize);
      while (size > minimum && (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight)) {
        size = Math.max(minimum, size - .5);
        element.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    void document.fonts.ready.then(fit);
    return () => { active = false; observer.disconnect(); };
  }, [ref, text, minimum]);
}

export function ProfileName({ name }: { name: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useFittedText(ref, name, 14);
  return <h1 ref={ref} title={name}>{name}</h1>;
}

export function ProfileSign({ slogan, onEdit }: { slogan: string | null; onEdit?: () => void }) {
  const text = slogan?.trim() || 'Good putts. Better dumps.';
  const ref = useRef<HTMLSpanElement>(null);
  useFittedText(ref, text, 8);
  const content = <><img src="/art/profile-slogan-sign.webp" alt=""/><span className="pf3-sign-message" ref={ref}>{text}</span></>;
  return onEdit
    ? <button className="pf3-sign" type="button" onClick={onEdit} aria-label={`Edit your slogan: ${text}`} title={text}>{content}</button>
    : <div className="pf3-sign" title={text} aria-label={`Player slogan: ${text}`}>{content}</div>;
}
