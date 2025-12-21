/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("audit_logs", {
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

    // optional: sometimes action isn't tied to a task (project created, etc.)
    task_id: {
      type: "text",
      references: "tasks",
      onDelete: "set null"
    },

    actor_user_id: {
      type: "text",
      notNull: true,
      references: "users",
      onDelete: "cascade"
    },

    action: { type: "text", notNull: true },

    // JSON metadata for flexible details (from/to column, old/new values, etc.)
    metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },

    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createIndex("audit_logs", ["org_id", "project_id"]);
  pgm.createIndex("audit_logs", ["project_id"]);
  pgm.createIndex("audit_logs", ["task_id"]);
  pgm.createIndex("audit_logs", ["actor_user_id"]);
};

exports.down = (pgm) => {
  pgm.dropIndex("audit_logs", ["actor_user_id"]);
  pgm.dropIndex("audit_logs", ["task_id"]);
  pgm.dropIndex("audit_logs", ["project_id"]);
  pgm.dropIndex("audit_logs", ["org_id", "project_id"]);
  pgm.dropTable("audit_logs");
};