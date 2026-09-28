/**
 * Category Normalization Service
 * Normalizes complaint categories from various pipelines into canonical codes.
 */

export const CANONICAL_CATEGORIES = {
    ROADS: 'roads',
    STREETLIGHTS: 'streetlights',
    WATER_SUPPLY: 'water_supply',
    DRAINAGE: 'drainage',
    GARBAGE: 'garbage',
    TRAFFIC: 'traffic',
    PUBLIC_PROPERTY: 'public_property',
    PARKS: 'parks',
    SANITATION: 'sanitation',
    SAFETY_HAZARD: 'safety_hazard',
    ENVIRONMENT: 'environment',
    OTHER: 'other'
};

const aliasMap = new Map();

const addAliases = (canonical, aliases) => {
    aliases.forEach(alias => {
        aliasMap.set(alias.toLowerCase(), canonical);
    });
};

addAliases(CANONICAL_CATEGORIES.ROADS, [
    'roads', 'Roads', 'road', 'Road',
    'Damaged Roads', 'damaged roads', 'damaged_roads',
    'Road Damage', 'road damage', 'road_damage',
    'Pothole', 'Potholes', 'pothole', 'potholes',
    'Road Surface Damage', 'road surface damage',
    'Road Block', 'road block', 'road_block',
    'Construction Work', 'construction work'
]);

addAliases(CANONICAL_CATEGORIES.STREETLIGHTS, [
    'streetlights', 'Streetlights', 'streetlight',
    'Broken Street Lights', 'broken street lights', 'broken_street_lights',
    'Non-functional Streetlight', 'non-functional streetlight',
    'Missing Road Signs', 'missing road signs', 'missing_road_signs'
]);

addAliases(CANONICAL_CATEGORIES.WATER_SUPPLY, [
    'water_supply', 'Water Supply', 'water supply',
    'Waterlogging', 'waterlogging'
]);

addAliases(CANONICAL_CATEGORIES.DRAINAGE, [
    'drainage', 'Drainage'
]);

addAliases(CANONICAL_CATEGORIES.GARBAGE, [
    'garbage', 'Garbage'
]);

addAliases(CANONICAL_CATEGORIES.TRAFFIC, [
    'traffic', 'Traffic',
    'Traffic Signal Not Working', 'traffic signal not working',
    'Traffic Signal Failure', 'traffic signal failure',
    'Illegal Parking', 'illegal parking', 'illegal_parking',
    'Heavy Traffic', 'heavy traffic',
    'Bus Stop Issues', 'bus stop issues', 'bus_stop',
    'Accident', 'accident'
]);

addAliases(CANONICAL_CATEGORIES.SAFETY_HAZARD, [
    'safety_hazard', 'Safety Hazard', 'safety hazard'
]);

addAliases(CANONICAL_CATEGORIES.ENVIRONMENT, [
    'environment', 'Environment'
]);

addAliases(CANONICAL_CATEGORIES.SANITATION, [
    'sanitation', 'Sanitation'
]);

addAliases(CANONICAL_CATEGORIES.PARKS, [
    'parks', 'Parks'
]);

addAliases(CANONICAL_CATEGORIES.PUBLIC_PROPERTY, [
    'public_property', 'Public Property', 'public property'
]);

addAliases(CANONICAL_CATEGORIES.OTHER, [
    'other', 'Other',
    'Other Transportation Issue', 'other transportation issue'
]);

/**
 * Takes any category string and returns a canonical code.
 * @param {string} rawCategory - The raw category string to normalize.
 * @returns {string} The canonical category code.
 */
export function normalizeCategory(rawCategory) {
    if (!rawCategory) return CANONICAL_CATEGORIES.OTHER;
    const normalized = rawCategory.toLowerCase().trim();
    if (aliasMap.has(normalized)) {
        return aliasMap.get(normalized);
    }
    return CANONICAL_CATEGORIES.OTHER;
}

const RELATED_GROUPS = [
    [CANONICAL_CATEGORIES.ROADS, CANONICAL_CATEGORIES.TRAFFIC],
    [CANONICAL_CATEGORIES.WATER_SUPPLY, CANONICAL_CATEGORIES.DRAINAGE],
    [CANONICAL_CATEGORIES.GARBAGE, CANONICAL_CATEGORIES.SANITATION, CANONICAL_CATEGORIES.ENVIRONMENT],
    [CANONICAL_CATEGORIES.SAFETY_HAZARD, CANONICAL_CATEGORIES.STREETLIGHTS]
];

/**
 * Returns a compatibility score between two raw categories.
 * @param {string} catA - First raw category.
 * @param {string} catB - Second raw category.
 * @returns {number} Score: 1.0 (exact match), 0.5 (related), 0.0 (unrelated).
 */
export function areCategoriesCompatible(catA, catB) {
    const normA = normalizeCategory(catA);
    const normB = normalizeCategory(catB);

    if (normA === normB) {
        return 1.0;
    }

    for (const group of RELATED_GROUPS) {
        if (group.includes(normA) && group.includes(normB)) {
            return 0.5;
        }
    }

    return 0.0;
}

export const CATEGORY_RADII = {
    [CANONICAL_CATEGORIES.ROADS]: 120,
    [CANONICAL_CATEGORIES.STREETLIGHTS]: 100,
    [CANONICAL_CATEGORIES.WATER_SUPPLY]: 250,
    [CANONICAL_CATEGORIES.DRAINAGE]: 150,
    [CANONICAL_CATEGORIES.GARBAGE]: 150,
    [CANONICAL_CATEGORIES.TRAFFIC]: 300,
    [CANONICAL_CATEGORIES.PUBLIC_PROPERTY]: 150,
    [CANONICAL_CATEGORIES.PARKS]: 200,
    [CANONICAL_CATEGORIES.SANITATION]: 150,
    [CANONICAL_CATEGORIES.SAFETY_HAZARD]: 200,
    [CANONICAL_CATEGORIES.ENVIRONMENT]: 300,
    [CANONICAL_CATEGORIES.OTHER]: 100
};

/**
 * Returns the search radius in meters for a given canonical category.
 * @param {string} canonicalCategory - The canonical category code.
 * @returns {number} Radius in meters.
 */
export function getSearchRadius(canonicalCategory) {
    return CATEGORY_RADII[canonicalCategory] || CATEGORY_RADII[CANONICAL_CATEGORIES.OTHER];
}
