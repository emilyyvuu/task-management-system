/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createType("task_priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);

  pgm.createTable("tasks", {
    id: { type: "text", primaryKey: true },

    org_id: {
      type: "text",
      notNull: true,
      references: "organizations",
      onDelete: "cascade"
    },

    project_id: {
      type: "text",
      notNull: true,
      references: "projects",
      onDelete: "cascade"
    },

    column_id: {
      type: "text",
      notNull: true,
      references: "columns",
      onDelete: "restrict"
    },

    title: { type: "text", notNull: true },
    description: { type: "text" },

    priority: { type: "task_priority", notNull: true, default: "MEDIUM" },
    due_date: { type: "timestamptz" },

    assignee_user_id: {
      type: "text",
      references: "users",
      onDelete: "set null"
    },

    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createIndex("tasks", ["org_id"]);
  pgm.createIndex("tasks", ["project_id"]);
  pgm.createIndex("tasks", ["column_id"]);
  pgm.createIndex("tasks", ["org_id", "project_id"]);
};

exports.down = (pgm) => {
  pgm.dropIndex("tasks", ["org_id", "project_id"]);
  pgm.dropIndex("tasks", ["column_id"]);
  pgm.dropIndex("tasks", ["project_id"]);
  pgm.dropIndex("tasks", ["org_id"]);
  pgm.dropTable("tasks");
  pgm.dropType("task_priority");
};
