"use client";

import { useState } from "react";
import Image from "next/image";

export default function ImageGallery({ images, title }: { images: { src: string; alt: string }[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (images.length === 0) return null;

  function move(direction: number) {
    setActive((current) => current === null ? null : (current + direction + images.length) % images.length);
  }

  return (
    <>
      <div className="gallery-grid">
        {images.map((image, index) => <button className="gallery-image" key={`${image.src}-${index}`} onClick={() => setActive(index)} aria-label={`View ${title} image ${index + 1}`}>
          <Image src={image.src} alt={image.alt} fill sizes="(max-width: 760px) 50vw, 33vw" unoptimized />
        </button>)}
      </div>
      {active !== null && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`${title} image preview`} onClick={() => setActive(null)}>
        <button className="lightbox-close" onClick={() => setActive(null)} aria-label="Close preview">×</button>
        <button className="lightbox-previous" onClick={(event) => { event.stopPropagation(); move(-1); }} aria-label="Previous image">‹</button>
        <Image src={images[active].src} alt={images[active].alt} width={1600} height={1200} unoptimized onClick={(event) => event.stopPropagation()} />
        <button className="lightbox-next" onClick={(event) => { event.stopPropagation(); move(1); }} aria-label="Next image">›</button>
        <span>{active + 1} / {images.length}</span>
      </div>}
    </>
  );
}
