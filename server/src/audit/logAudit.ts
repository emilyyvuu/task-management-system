import { pool } from "../db";
import { newId } from "../utils/ids";

type AuditInput = {
  orgId: string;
  projectId: string;
  actorUserId: string;
  action: string;
  taskId?: string | null;
  metadata?: Record<string, any>;
};

export async function logAudit(input: AuditInput) {
  const {
    orgId,
    projectId,
    actorUserId,
    action,
    taskId = null,
    metadata = {},
  } = input;

  await pool.query(
    `insert into audit_logs
      (id, org_id, project_id, task_id, actor_user_id, action, metadata)
     values
      ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [newId(), orgId, projectId, taskId, actorUserId, action, JSON.stringify(metadata)]
  );
}