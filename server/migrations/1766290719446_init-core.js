/* eslint-disable */
exports.shorthands = undefined;

exports.up = (pgm) => {
  /**
   * Roles a user can have inside an organization
   */
  pgm.createType("org_role", ["ADMIN", "MEMBER"]);

  /**
   * Users table
   * Stores login information
   */
  pgm.createTable("users", {
    id: { type: "text", primaryKey: true },
    email: { type: "text", notNull: true, unique: true },
    password_hash: { type: "text", notNull: true },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  /**
   * Organizations (tenants)
   */
  pgm.createTable("organizations", {
    id: { type: "text", primaryKey: true },
    name: { type: "text", notNull: true },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  /**
   * Memberships
   * Connects users to organizations with a role
   */
  pgm.createTable("memberships", {
    id: { type: "text", primaryKey: true },
    org_id: {
      type: "text",
      notNull: true,
      references: "organizations",
      onDelete: "cascade"
    },
    user_id: {
      type: "text",
      notNull: true,
      references: "users",
      onDelete: "cascade"
    },
    role: {
      type: "org_role",
      notNull: true,
      default: "MEMBER"
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  /**
   * A user can only belong to an org once
   */
  pgm.addConstraint("memberships", "memberships_org_user_unique", {
    unique: ["org_id", "user_id"]
  });

  pgm.createIndex("memberships", "user_id");
  pgm.createIndex("memberships", "org_id");
};

exports.down = (pgm) => {
  pgm.dropIndex("memberships", "org_id");
  pgm.dropIndex("memberships", "user_id");
  pgm.dropConstraint("memberships", "memberships_org_user_unique");

  pgm.dropTable("memberships");
  pgm.dropTable("organizations");
  pgm.dropTable("users");
  pgm.dropType("org_role");
};
