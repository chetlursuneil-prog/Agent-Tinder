 'use client';
 import { useState, useEffect } from 'react';
 import { getProfiles, getProfileByUserId, searchProfilesAdvanced, getSavedSearches, createSavedSearch, deleteSavedSearch } from '../../lib/api';
 import { useAuth } from '../../lib/auth-context';
 import SkillBadge from '../../components/SkillBadge';
 import StarRating from '../../components/StarRating';
 import LoadingSpinner from '../../components/LoadingSpinner';

 export default function SearchPage() {
   const { user } = useAuth();
   const [query, setQuery] = useState('');
   const [results, setResults] = useState([]);
   const [loading, setLoading] = useState(false);
   const [searched, setSearched] = useState(false);
   const [myProfile, setMyProfile] = useState(null);
   const [showFilters, setShowFilters] = useState(false);
   const [filters, setFilters] = useState({ skills: '', minPrice: '', maxPrice: '', minRating: '', sort: '' });
   const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0 });
   const [savedSearches, setSavedSearches] = useState([]);

   async function doSearch(q, off = 0) {
     setLoading(true);
     setSearched(true);
     try {
       let foundProfile = null;
       if (user && user.id) {
         try {
           foundProfile = await getProfileByUserId(user.id);
           setMyProfile(foundProfile);
         } catch {
           foundProfile = null;
           setMyProfile(null);
         }
       }

       const params = {
         q: q || undefined,
         excludeForProfileId: foundProfile?.id,
         limit: 20,
         offset: off,
         skills: filters.skills || undefined,
         minPrice: filters.minPrice || undefined,
         maxPrice: filters.maxPrice || undefined,
         minRating: filters.minRating || undefined,
         sort: filters.sort || undefined,
       };

       const data = await searchProfilesAdvanced(params);
       // client-side safety: filter out signed-in user's own profile
       const filtered = (data.profiles || []).filter(p => {
         if (!p) return false;
         if (foundProfile && p.id === foundProfile.id) return false;
         if (user && user.id && p.user_id === user.id) return false;
         const name = (p.name || '').trim();
         if (!name || name.length <= 1) return false;
         return true;
       });
       setResults(filtered);
       setPagination({ total: data.total, limit: data.limit, offset: data.offset });
     } catch {
       // fallback to basic search
       try {
         const data = await getProfiles({ q: q || undefined });
         setResults(data || []);
         setPagination({ total: (data || []).length, limit: 20, offset: 0 });
       } catch { setResults([]); }
     }
     setLoading(false);
   }

   useEffect(() => { doSearch(); }, [user && user.id]);

   useEffect(() => {
     if (user?.id) {
       getSavedSearches(user.id).then(setSavedSearches).catch(() => {});
     }
   }, [user?.id]);

   async function handleSaveSearch() {
     if (!user?.id) return alert('Please sign in');
     try {
       const ss = await createSavedSearch(user.id, query, filters);
       setSavedSearches(prev => [ss, ...prev]);
     } catch {}
   }

   async function handleDeleteSaved(id) {
     await deleteSavedSearch(id).catch(() => {});
     setSavedSearches(prev => prev.filter(s => s.id !== id));
   }

   function loadSavedSearch(ss) {
     setQuery(ss.query || '');
     setFilters(ss.filters || { skills: '', minPrice: '', maxPrice: '', minRating: '', sort: '' });
     doSearch(ss.query || '', 0);
   }

   const totalPages = Math.ceil(pagination.total / pagination.limit);
   const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

   return (
     <div className="mt-8">
       <h2 className="text-3xl font-bold mb-6">Browse Marketplace</h2>

       <div className="flex gap-2 mb-4">
         <input
           className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-brand outline-none"
           placeholder="Search by skill, keyword, or role..."
           value={query}
           onChange={e => setQuery(e.target.value)}
           onKeyDown={e => { if (e.key === 'Enter') doSearch(query); }}
         />
         <button onClick={() => doSearch(query)} className="px-6 py-3 bg-brand rounded-lg font-semibold hover:bg-brand-dark transition">
           Search
         </button>
         <button onClick={() => setShowFilters(!showFilters)} className="px-4 py-3 border border-gray-700 rounded-lg hover:border-brand transition text-sm">
           🎛 Filters
         </button>
       </div>

       {/* Filters panel */}
       {showFilters && (
         <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
           <div>
             <label className="text-gray-500 text-xs block mb-1">Skills (comma-sep)</label>
             <input
               className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand outline-none"
               value={filters.skills}
               onChange={e => setFilters(f => ({ ...f, skills: e.target.value }))}
               placeholder="python, react"
             />
           </div>
           <div>
             <label className="text-gray-500 text-xs block mb-1">Min Price</label>
             <input
               type="number"
               className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand outline-none"
               value={filters.minPrice}
               onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))}
               placeholder="0"
             />
           </div>
           <div>
             <label className="text-gray-500 text-xs block mb-1">Max Price</label>
             <input
               type="number"
               className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand outline-none"
               value={filters.maxPrice}
               onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
               placeholder="1000"
             />
           </div>
           <div>
             <label className="text-gray-500 text-xs block mb-1">Min Rating</label>
             <select
               className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand outline-none"
               value={filters.minRating}
               onChange={e => setFilters(f => ({ ...f, minRating: e.target.value }))}
             >
               <option value="">Any</option>
               <option value="3">3+ stars</option>
               <option value="4">4+ stars</option>
               <option value="4.5">4.5+ stars</option>
             </select>
           </div>
           <div>
             <label className="text-gray-500 text-xs block mb-1">Sort By</label>
             <select
               className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand outline-none"
               value={filters.sort}
               onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
             >
               <option value="">Newest</option>
               <option value="rating">Top Rated</option>
               <option value="price_low">Price: Low→High</option>
               <option value="price_high">Price: High→Low</option>
               <option value="boosted">Boosted First</option>
             </select>
           </div>
           <div className="col-span-2 md:col-span-5 flex gap-2">
             <button onClick={() => doSearch(query, 0)} className="px-4 py-2 bg-brand rounded-lg text-sm font-semibold hover:bg-brand-dark transition">
               Apply Filters
             </button>
             <button onClick={handleSaveSearch} className="px-4 py-2 border border-gray-600 rounded-lg text-sm hover:border-brand transition">
               💾 Save Search
             </button>
             <button onClick={() => { setFilters({ skills: '', minPrice: '', maxPrice: '', minRating: '', sort: '' }); doSearch(query, 0); }} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
               Clear
             </button>
           </div>
         </div>
       )}

       {/* Saved searches */}
       {savedSearches.length > 0 && (
         <div className="flex flex-wrap gap-2 mb-4">
           <span className="text-gray-500 text-xs self-center">Saved:</span>
           {savedSearches.map(ss => (
             <div key={ss.id} className="flex items-center gap-1 bg-gray-800 rounded-full px-3 py-1">
               <button onClick={() => loadSavedSearch(ss)} className="text-xs text-brand hover:underline">
                 {ss.query || 'All'} {ss.filters?.skills ? `(${ss.filters.skills})` : ''}
               </button>
               <button onClick={() => handleDeleteSaved(ss.id)} className="text-gray-500 hover:text-red-400 text-xs ml-1">×</button>
             </div>
           ))}
         </div>
       )}

       {loading && <LoadingSpinner text="Searching..." />}

       {/* Results count */}
       {searched && !loading && (
         <p className="text-gray-500 text-sm mb-4">{pagination.total} agent{pagination.total !== 1 ? 's' : ''} found</p>
       )}

       <div className="grid gap-4 sm:grid-cols-2">
         {results.map(p => (
           <a key={p.id} href={`/agents/${p.id}`} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-brand/40 transition block">
             <div className="flex items-center gap-3 mb-3">
               <div className="w-10 h-10 bg-brand/20 rounded-full flex items-center justify-center text-lg font-bold text-brand">
                 {(p.about || '?')[0].toUpperCase()}
               </div>
               <div>
                 <p className="font-semibold">{p.name || p.user_id || 'Agent'}</p>
                 <div className="flex items-center gap-2">
                   {p.price && <span className="text-gray-500 text-xs">💰 ${p.price}/hr</span>}
                   {p.avg_rating > 0 && (
                     <span className="flex items-center gap-1">
                       <StarRating rating={p.avg_rating} size="text-xs" />
                       <span className="text-gray-500 text-xs">({p.review_count})</span>
                     </span>
                   )}
                 </div>
               </div>
             </div>
             <div className="flex flex-wrap gap-1.5 mb-3">
               {(p.skills || []).map(s => <SkillBadge key={s} skill={s} />)}
             </div>
             <p className="text-gray-400 text-sm line-clamp-2">{p.about}</p>
           </a>
         ))}
       </div>

       {/* Pagination */}
       {totalPages > 1 && (
         <div className="flex justify-center gap-2 mt-8">
           <button
             disabled={currentPage <= 1}
             onClick={() => doSearch(query, (currentPage - 2) * pagination.limit)}
             className="px-4 py-2 border border-gray-700 rounded-lg hover:border-brand transition disabled:opacity-30"
           >
             ← Prev
           </button>
           <span className="px-4 py-2 text-gray-400 text-sm self-center">
             Page {currentPage} of {totalPages}
           </span>
           <button
             disabled={currentPage >= totalPages}
             onClick={() => doSearch(query, currentPage * pagination.limit)}
             className="px-4 py-2 border border-gray-700 rounded-lg hover:border-brand transition disabled:opacity-30"
           >
             Next →
           </button>
         </div>
       )}

       {searched && !loading && results.length === 0 && (
         <p className="text-gray-500 text-center mt-12">No agents found. Try a different search.</p>
       )}
     </div>
   );
 }
