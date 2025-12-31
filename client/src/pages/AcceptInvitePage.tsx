import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import LoadingScreen from "../components/LoadingScreen";
import { getErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function AcceptInvitePage() {
  const { status, authFetch } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);

    try {
      const data = await authFetch<{ ok: boolean; orgId: string }>("/api/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      navigate(`/orgs/${data.orgId}/projects`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-semibold text-slate-900">Invite link missing</h1>
          <p className="mt-2 text-sm text-slate-500">Ask your admin for a valid invite link.</p>
        </div>
      </AuthLayout>
    );
  }

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    return (
      <AuthLayout>
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-semibold text-slate-900">Sign in to accept</h1>
          <p className="mt-2 text-sm text-slate-500">Log in before accepting this invite.</p>
          <Link
            to="/login"
            className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">Accept invite</h1>
        <p className="mt-2 text-sm text-slate-500">You are about to join a workspace.</p>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

        <button
          type="button"
          onClick={handleAccept}
          disabled={submitting}
          className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Accept invite
        </button>
      </div>
    </AuthLayout>
  );
}
