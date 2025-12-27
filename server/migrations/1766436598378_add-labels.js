/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("labels", {
    id: { type: "text", primaryKey: true },
    org_id: {
      type: "text",
      notNull: true,
      references: "organizations",
      onDelete: "cascade",
    },
    name: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  // unique label name per org
  pgm.addConstraint("labels", "labels_org_name_unique", { unique: ["org_id", "name"] });
  pgm.createIndex("labels", ["org_id"]);

  pgm.createTable("task_labels", {
    task_id: {
      type: "text",
      notNull: true,
      references: "tasks",
      onDelete: "cascade",
    },
    label_id: {
      type: "text",
      notNull: true,
      references: "labels",
      onDelete: "cascade",
    },
  });

  pgm.addConstraint("task_labels", "task_labels_unique", { unique: ["task_id", "label_id"] });
  pgm.createIndex("task_labels", ["task_id"]);
  pgm.createIndex("task_labels", ["label_id"]);
};

exports.down = (pgm) => {
  pgm.dropIndex("task_labels", ["label_id"]);
  pgm.dropIndex("task_labels", ["task_id"]);
  pgm.dropConstraint("task_labels", "task_labels_unique");
  pgm.dropTable("task_labels");

  pgm.dropIndex("labels", ["org_id"]);
  pgm.dropConstraint("labels", "labels_org_name_unique");
  pgm.dropTable("labels");
};