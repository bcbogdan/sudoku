'use client';
import { useEffect, useRef } from 'react';
export default function NumberDial({
  onChoose,
  onClose,
}: {
  onChoose: (value: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="number-dial"
      aria-labelledby="dial-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <h2 id="dial-title">Choose a number</h2>
      <div className="dial-numbers">
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            className="secondary"
            aria-label={`Choose ${i + 1}`}
            onClick={() => onChoose(i + 1)}
            style={{
              left: 130 + 100 * Math.sin((i * Math.PI * 2) / 9),
              top: 130 - 100 * Math.cos((i * Math.PI * 2) / 9),
            }}
          >
            {i + 1}
          </button>
        ))}
        <button
          className="secondary"
          aria-label="Clear square"
          style={{ left: 130, top: 130 }}
          onClick={() => onChoose(0)}
        >
          ⌫
        </button>
      </div>
      <button className="secondary" onClick={onClose}>
        Cancel
      </button>
    </dialog>
  );
}
