import { t } from "../../../../shared/i18n/index.mjs";
function getRandomPrefixes() {
  return [
    t("market.comments.names.traveler"),
    t("market.comments.names.spaceTraveler"),
    t("market.comments.names.pixelHunter"),
    t("market.comments.names.modEnthusiast"),
    t("market.comments.names.cyberRanger"),
    t("market.comments.names.dataHunter"),
    t("market.comments.names.virtualExplorer"),
    t("market.comments.names.dimensionWalker"),
  ];
}
const commentsMemoryCache = new Map();
function getCommentsCacheKey(serverUrl, modId) {
  return `${serverUrl}|${modId}`;
}
function readCommentsCache(serverUrl, modId) {
  if (!serverUrl || !modId) return null;
  return commentsMemoryCache.get(getCommentsCacheKey(serverUrl, modId)) || null;
}
function writeCommentsCache(serverUrl, modId, payload) {
  if (!serverUrl || !modId) return;
  commentsMemoryCache.set(getCommentsCacheKey(serverUrl, modId), {
    ...payload,
    ts: Date.now(),
  });
}
const profileCache = new Map();
const profileInflight = new Map();
const PROFILE_TTL_MS = 5 * 60 * 1e3;
function getProfileCacheKey(serverUrl, clientId) {
  return `${serverUrl}|${clientId}`;
}
async function fetchUserProfile(serverUrl, clientId) {
  if (!serverUrl || !clientId)
    return {
      nickname: null,
      avatarUrl: null,
    };
  const key = getProfileCacheKey(serverUrl, clientId);
  const cached = profileCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < PROFILE_TTL_MS) return cached;
  if (profileInflight.has(key)) return profileInflight.get(key);
  const task = (async () => {
    let nickname = null;
    let avatarUrl = null;
    try {
      const profileRes = await fetch(
        `${serverUrl}/api/comment-profiles/${encodeURIComponent(clientId)}`,
      );
      if (profileRes.ok) {
        const profileData = await profileRes.json().catch(() => null);
        if (profileData?.success && profileData.profile) {
          if (profileData.profile.nickname)
            nickname = profileData.profile.nickname;
          if (profileData.profile.avatarUrl) {
            const raw = profileData.profile.avatarUrl;
            avatarUrl = raw.startsWith("http") ? raw : `${serverUrl}${raw}`;
          }
        }
      }
    } catch (e) {
      console.warn("[ModCommentSection] Failed to load avatar profile:", e);
    }
    const entry = {
      nickname,
      avatarUrl,
      fetchedAt: Date.now(),
    };
    profileCache.set(key, entry);
    return entry;
  })();
  profileInflight.set(key, task);
  try {
    return await task;
  } finally {
    profileInflight.delete(key);
  }
}
function mergeRetainRecentOwn(prev, incoming, thresholdMs = 6e4) {
  if (!Array.isArray(prev) || !prev.length) return incoming;
  const now = Date.now();
  const seen = new Set();
  const collect = (list) => {
    for (const c of list || []) {
      if (c && c.id != null) seen.add(c.id);
      if (c && c.replies) collect(c.replies);
    }
  };
  collect(incoming);
  const isRecentOwn = (c) => {
    if (!c || !c.isOwn) return false;
    if (c.pending) return true;
    if (!c.createdAt) return false;
    try {
      const iso = String(c.createdAt);
      const t = new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
      if (!Number.isFinite(t)) return false;
      return now - t < thresholdMs;
    } catch {
      return false;
    }
  };
  const missingRoots = [];
  const missingRepliesByParent = new Map();
  for (const c of prev) {
    if (!c || c.id == null) continue;
    if (!seen.has(c.id) && isRecentOwn(c)) {
      missingRoots.push(c);
    }
    if (c.replies && c.replies.length) {
      for (const r of c.replies) {
        if (!r || r.id == null) continue;
        if (!seen.has(r.id) && isRecentOwn(r)) {
          if (!missingRepliesByParent.has(c.id)) {
            missingRepliesByParent.set(c.id, []);
          }
          missingRepliesByParent.get(c.id).push(r);
        }
      }
    }
  }
  if (!missingRoots.length && missingRepliesByParent.size === 0)
    return incoming;
  const mergedBody = incoming.map((c) => {
    const extras = missingRepliesByParent.get(c.id);
    if (!extras || !extras.length) return c;
    return {
      ...c,
      replies: [...(c.replies || []), ...extras],
    };
  });
  return [...missingRoots, ...mergedBody];
}
function generateRandomNickname() {
  const prefix =
    getRandomPrefixes()[Math.floor(Math.random() * getRandomPrefixes().length)];
  const hex = Math.random().toString(16).substr(2, 4).toUpperCase();
  return `${prefix}#${hex}`;
}
function getOrCreateNickname() {
  let nick = localStorage.getItem("comment-nickname");
  if (!nick) {
    nick = generateRandomNickname();
    localStorage.setItem("comment-nickname", nick);
  }
  return nick;
}
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(
    dateStr.endsWith("Z") ? dateStr : dateStr + "Z",
  ).getTime();
  const diff = now - then;
  if (diff < 6e4) return t("common.time.justNow");
  if (diff < 36e5)
    return t("common.time.minutesAgo", {
      floor: Math.floor(diff / 6e4),
    });
  if (diff < 864e5)
    return t("common.time.hoursAgo", {
      floor: Math.floor(diff / 36e5),
    });
  if (diff < 6048e5)
    return t("common.time.daysAgo", {
      floor: Math.floor(diff / 864e5),
    });
  return new Date(then).toLocaleDateString("zh-CN");
}
export {
  readCommentsCache,
  getOrCreateNickname,
  fetchUserProfile,
  mergeRetainRecentOwn,
  writeCommentsCache,
  timeAgo,
};
