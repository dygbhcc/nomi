const GLOBAL_MOOD_TAGS = [
  "romantic",
  "chill",
  "energetic",
  "fresh",
  "pet_friendly",
  "hidden_gem",
  "lively",
  "terrace"
];

const PORTUGAL_LOCAL_MOOD_TAGS = [
  "tasca",
  "fado",
  "petiscos",
  "miradouro",
  "saudade",
  "marisqueira"
];

module.exports = {
  GLOBAL_MOOD_TAGS,
  PORTUGAL_LOCAL_MOOD_TAGS,
  ALL_MOOD_TAGS: [...GLOBAL_MOOD_TAGS, ...PORTUGAL_LOCAL_MOOD_TAGS]
};
