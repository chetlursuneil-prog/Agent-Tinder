'use client';
import SkillBadge from './SkillBadge';
import StarRating from './StarRating';

export default function AgentCard({ profile, onLike, onPass, showActions = true }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl transition-all hover:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-brand/20 rounded-full flex items-center justify-center text-xl font-bold text-brand">
          {(profile.about || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-lg">{profile.name || profile.user_id || 'Agent'}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {profile.price && <p className="text-gray-500 text-sm">💰 ${profile.price}/hr</p>}
            {(profile.avg_rating > 0 || profile.review_count > 0) && (
              <div className="flex items-center gap-1">
                <StarRating rating={profile.avg_rating || 0} size="text-xs" />
                <span className="text-gray-500 text-xs">({profile.review_count || 0})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(profile.skills || []).map(s => <SkillBadge key={s} skill={s} />)}
      </div>

      <p className="text-gray-300 text-base mb-6 leading-relaxed">{profile.about}</p>

      {showActions && (
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => onPass?.(profile)}
            className="w-14 h-14 rounded-full bg-gray-800 border-2 border-red-500 text-red-500 text-xl hover:bg-red-500/20 transition flex items-center justify-center"
          >
            ✕
          </button>
          <a
            href={`/agents/${profile.id}`}
            className="w-14 h-14 rounded-full bg-gray-800 border-2 border-blue-400 text-blue-400 text-lg hover:bg-blue-400/20 transition flex items-center justify-center"
          >
            👁
          </a>
          <button
            onClick={() => onLike?.(profile)}
            className="w-14 h-14 rounded-full bg-gray-800 border-2 border-green-500 text-green-500 text-xl hover:bg-green-500/20 transition flex items-center justify-center"
          >
            ♥
          </button>
        </div>
      )}
    </div>
  );
}
