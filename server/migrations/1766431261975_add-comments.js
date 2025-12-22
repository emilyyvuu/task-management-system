/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("comments", {
    id: { type: "text", primaryKey: true },

    org_id: {
      type: "text",
      notNull: true,
      references: "organizations",
      onDelete: "cascade"
    },

    task_id: {
      type: "text",
      notNull: true,
      references: "tasks",
      onDelete: "cascade"
    },

    author_user_id: {
      type: "text",
      notNull: true,
      references: "users",
      onDelete: "cascade"
    },

    body: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createIndex("comments", ["task_id", "created_at"]);
  pgm.createIndex("comments", ["org_id"]);
};

exports.down = (pgm) => {
  pgm.dropIndex("comments", ["org_id"]);
  pgm.dropIndex("comments", ["task_id", "created_at"]);
  pgm.dropTable("comments");
};
