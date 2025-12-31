import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

type Member = {
  membershipId: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: string;
  userId: string;
  email: string;
};

type MembersResponse = { members: Member[] };
type InviteResponse = { invite: { inviteLink: string; email: string; expiresAt: string } };

export default function AdminPage() {
  const { orgId } = useParams();
  const { authFetch, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return members.find((member) => member.userId === user.id)?.role === "ADMIN";
  }, [members, user]);

  useEffect(() => {
    if (!orgId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await authFetch<MembersResponse>(`/api/orgs/${orgId}/members`);
        if (active) setMembers(data.members);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [authFetch, orgId]);

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    const trimmed = inviteEmail.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);

    try {
      const data = await authFetch<InviteResponse>(`/api/orgs/${orgId}/invites`, {
        method: "POST",
        body: JSON.stringify({ email: trimmed }),
      });
      setInviteLink(data.invite.inviteLink);
      setInviteEmail("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const updateRole = async (memberId: string, role: "ADMIN" | "MEMBER") => {
    if (!orgId) return;
    try {
      const data = await authFetch<{ member: Member }>(`/api/orgs/${orgId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMembers((prev) =>
        prev.map((member) => (member.membershipId === memberId ? { ...member, role: data.member.role } : member))
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const removeMember = async (memberId: string) => {
    if (!orgId) return;
    const confirmed = window.confirm("Remove this member from the organization?");
    if (!confirmed) return;

    try {
      await authFetch(`/api/orgs/${orgId}/members/${memberId}`, { method: "DELETE" });
      setMembers((prev) => prev.filter((member) => member.membershipId !== memberId));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (!orgId) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6">Missing organization.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Admin Settings</h1>
        <p className="text-sm text-slate-500">Manage members and send invites.</p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">{error}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Invite a member</h2>
          <form onSubmit={handleInvite} className="mt-4 flex flex-wrap gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="name@company.com"
              className="w-full flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={!isAdmin || submitting}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send invite
            </button>
          </form>
          {inviteLink ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
              Invite link: <span className="font-semibold">{inviteLink}</span>
            </div>
          ) : null}
          {!isAdmin ? (
            <p className="mt-3 text-xs text-slate-400">You need admin access to send invites.</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Members</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading members...</p>
          ) : (
            <div className="mt-4 space-y-3">
              {members.map((member) => (
                <div key={member.membershipId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{member.email}</p>
                    <p className="text-xs text-slate-500">Joined {new Date(member.joinedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(event) => updateRole(member.membershipId, event.target.value as "ADMIN" | "MEMBER")}
                      disabled={!isAdmin}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                    </select>
                    {member.userId === user?.id ? (
                      <span className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-400">You</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeMember(member.membershipId)}
                        disabled={!isAdmin}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
