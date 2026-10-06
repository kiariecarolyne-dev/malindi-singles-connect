/**
 * The Malindi-focused local area directory.
 *
 * Malindi Singles Connect is deliberately NOT a nationwide/Kenya-wide app —
 * every area here sits in or around the Malindi coast so people meet someone
 * from their own community. Watamu is part of this dating area.
 *
 * UI copy should describe the platform as "Malindi & surrounding areas"
 * rather than making administrative claims about which town each place
 * formally belongs to.
 */
const MALINDI_AREAS = [
  { id: 'malindi_town', label: 'Malindi Town', emoji: '🏙️' },
  { id: 'central_malindi', label: 'Central Malindi', emoji: '🏛️' },
  { id: 'shella', label: 'Shella', emoji: '🌴' },
  { id: 'casuarina', label: 'Casuarina', emoji: '🌳' },
  { id: 'barani', label: 'Barani', emoji: '🕌' },
  { id: 'ganda', label: 'Ganda', emoji: '🌾' },
  { id: 'maweni', label: 'Maweni', emoji: '🛖' },
  { id: 'kisumu_ndogo', label: 'Kisumu Ndogo', emoji: '🏘️' },
  { id: 'majengo', label: 'Majengo', emoji: '🏡' },
  { id: 'mnarani', label: 'Mnarani', emoji: '🏺' },
  { id: 'muyeye', label: 'Muyeye', emoji: '🌿' },
  { id: 'sabaki', label: 'Sabaki', emoji: '🐪' },
  { id: 'ngala', label: 'Ngala', emoji: '🛣️' },
  { id: 'marine_park', label: 'Marine Park', emoji: '🌊' },
  { id: 'mowlem', label: 'Mowlem', emoji: '🌅' },
];

const WATAMU_AREAS = [
  { id: 'watamu', label: 'Watamu', emoji: '🐠' },
  { id: 'blue_lagoon', label: 'Blue Lagoon', emoji: '🐬' },
  { id: 'jacaranda', label: 'Jacaranda', emoji: '🌺' },
  { id: 'mida', label: 'Mida', emoji: '🐚' },
  { id: 'dabaso', label: 'Dabaso', emoji: '🐟' },
  { id: 'uyombo', label: 'Uyombo', emoji: '🪸' },
  { id: 'temple_point', label: 'Temple Point', emoji: '🗼' },
];

const SURROUNDING_AREAS = [
  { id: 'mambrui', label: 'Mambrui', emoji: '🏖️' },
  { id: 'marafa', label: 'Marafa', emoji: '🏜️' },
  { id: 'jilore', label: 'Jilore', emoji: '🐒' },
  { id: 'langobaya', label: 'Langobaya', emoji: '🎣' },
  { id: 'gongoni', label: 'Gongoni', emoji: '🏰' },
  { id: 'magarini', label: 'Magarini', emoji: '🧭' },
  { id: 'kilifi', label: 'Kilifi', emoji: '🌉' },
];

/** Grouped directory used by the searchable area picker. */
export const AREA_GROUPS = [
  { id: 'malindi', label: 'Malindi', emoji: '🏙️', areas: MALINDI_AREAS },
  { id: 'watamu', label: 'Watamu', emoji: '🐠', areas: WATAMU_AREAS },
  { id: 'surrounding', label: 'Surrounding Malindi area', emoji: '🧭', areas: SURROUNDING_AREAS },
];

/** Flat list — keeps the original AREAS import working everywhere. */
export const AREAS = AREA_GROUPS.flatMap((group) =>
  group.areas.map((area) => ({ ...area, group: group.id })),
);

const byId = new Map(AREAS.map((a) => [a.id, a]));
const groupByAreaId = new Map(
  AREA_GROUPS.flatMap((g) => g.areas.map((a) => [a.id, g.id])),
);

/** True when an area id exists in the Malindi-focused directory. */
export const isKnownArea = (areaId) => byId.has(areaId);

/** Which directory group an area belongs to (malindi | watamu | surrounding). */
export const getAreaGroupId = (areaId) => groupByAreaId.get(areaId) || null;

/** True when both areas sit in the same Malindi / Watamu / surrounding group. */
export const isSameAreaGroup = (areaIdA, areaIdB) => {
  const a = getAreaGroupId(areaIdA);
  return Boolean(a) && a === getAreaGroupId(areaIdB);
};

export const getAreaLabel = (areaId) => {
  const area = byId.get(areaId);
  return area ? area.label : 'Malindi area';
};

export const getAreaEmoji = (areaId) => {
  const area = byId.get(areaId);
  return area ? area.emoji : '📍';
};

/** "📍 Watamu" — used across cards and list rows. */
export const getAreaDisplay = (areaId) => `${getAreaEmoji(areaId)} ${getAreaLabel(areaId)}`;

/**
 * Grouped, searchable results for the area picker.
 * @param {string} query free text (matches the area label)
 * @returns {Array<{id,label,emoji,areas:Array}>} only groups with matches
 */
export const getGroupedAreas = (query = '') => {
  const q = String(query || '').trim().toLowerCase();
  return AREA_GROUPS.map((group) => ({
    ...group,
    areas: group.areas.filter((area) => !q || area.label.toLowerCase().includes(q)),
  })).filter((group) => group.areas.length > 0);
};
