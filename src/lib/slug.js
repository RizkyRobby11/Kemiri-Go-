const slugify = require("slugify");

function createSlug(value) {
  return slugify(value, {
    lower: true,
    strict: true,
    trim: true,
  });
}

module.exports = { createSlug };
