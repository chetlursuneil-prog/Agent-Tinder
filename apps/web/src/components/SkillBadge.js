'use client';

export default function SkillBadge({ skill }) {
  return (
    <span className="inline-block bg-brand/20 text-brand text-xs font-semibold px-3 py-1 rounded-full">
      {skill}
    </span>
  );
}
