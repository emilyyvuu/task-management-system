/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("invites", {
    id: { type: "text", primaryKey: true },

    org_id: {
      type: "text",
      notNull: true,
      references: "organizations",
      onDelete: "cascade",
    },

    email: { type: "text", notNull: true },

    token_hash: { type: "text", notNull: true, unique: true },

    expires_at: { type: "timestamptz", notNull: true },
    accepted_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("invites", ["org_id"]);
  pgm.createIndex("invites", ["email"]);
  pgm.createIndex("invites", ["expires_at"]);
};

exports.down = (pgm) => {
  pgm.dropIndex("invites", ["expires_at"]);
  pgm.dropIndex("invites", ["email"]);
  pgm.dropIndex("invites", ["org_id"]);
  pgm.dropTable("invites");
};