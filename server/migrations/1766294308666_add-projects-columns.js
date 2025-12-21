/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("projects", {
    id: { type: "text", primaryKey: true },
    org_id: {
      type: "text",
      notNull: true,
      references: "organizations",
      onDelete: "cascade"
    },
    name: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createIndex("projects", "org_id");

  pgm.createTable("columns", {
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
    name: { type: "text", notNull: true },
    position: { type: "int", notNull: true }
  });

  pgm.addConstraint("columns", "columns_project_position_unique", {
    unique: ["project_id", "position"]
  });

  pgm.createIndex("columns", "org_id");
  pgm.createIndex("columns", "project_id");
};

exports.down = (pgm) => {
  pgm.dropIndex("columns", "project_id");
  pgm.dropIndex("columns", "org_id");
  pgm.dropConstraint("columns", "columns_project_position_unique");
  pgm.dropTable("columns");

  pgm.dropIndex("projects", "org_id");
  pgm.dropTable("projects");
};