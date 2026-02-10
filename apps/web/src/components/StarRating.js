'use client';
import { useState } from 'react';

export default function StarRating({ rating = 0, size = 'text-sm' }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span key={i} className={`${size} ${i <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-600'}`}>
        ★
      </span>
    );
  }
  return <span className="inline-flex gap-0.5">{stars}</span>;
}
