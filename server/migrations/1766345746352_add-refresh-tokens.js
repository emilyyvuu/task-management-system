/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("refresh_tokens", {
    id: { type: "text", primaryKey: true },

    user_id: {
      type: "text",
      notNull: true,
      references: "users",
      onDelete: "cascade"
    },

    token_hash: { type: "text", notNull: true, unique: true },

    revoked_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    expires_at: { type: "timestamptz", notNull: true }
  });

  pgm.createIndex("refresh_tokens", "user_id");
  pgm.createIndex("refresh_tokens", "expires_at");
};

exports.down = (pgm) => {
  pgm.dropIndex("refresh_tokens", "expires_at");
  pgm.dropIndex("refresh_tokens", "user_id");
  pgm.dropTable("refresh_tokens");
};