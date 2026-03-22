"use client";

import { LoadingIndicator } from "@/components/layout/loading-indicator";
import Image from "next/image";
import { useEffect, useState } from "react";
import { DeclineRequestModal } from "../components/decline-request-modal";
import { formatDisplayValue } from "@/lib/utils/display-format.utils";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

type MemberAccessRequest = {
  id: string;
  userId: string;
  email: string;
  platform: ContributionPlatform;
  team: string;
  role: string;
  note: string;
  username: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string | Date;
};

export function IncomingRequestTab() {
  const [requests, setRequests] = useState<MemberAccessRequest[]>([]);
  const [platform, setPlatform] = useState<ContributionPlatform>("WEB");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(
    null,
  );
  const [declineTargetRequestId, setDeclineTargetRequestId] = useState<
    string | null
  >(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/member-access-requests?platform=${platform}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch incoming requests.");
        }

        const data = (await response.json()) as {
          pending: MemberAccessRequest[];
        };

        setRequests(data.pending ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [platform]);

  const handleDecision = async (
    requestId: string,
    decision: "ACCEPT" | "DECLINE",
    reason?: string,
  ) => {
    setUpdatingRequestId(requestId);

    try {
      const response = await fetch("/api/member-access-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId, decision, reason }),
      });

      if (!response.ok) {
        throw new Error("Failed to update request.");
      }

      setRequests((prev) => prev.filter((request) => request.id !== requestId));
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const openDeclineModal = (requestId: string) => {
    setDeclineTargetRequestId(requestId);
  };

  const closeDeclineModal = () => {
    setDeclineTargetRequestId(null);
  };

  const submitDecline = async (reason: string) => {
    if (!declineTargetRequestId) {
      return;
    }

    await handleDecision(declineTargetRequestId, "DECLINE", reason);
    closeDeclineModal();
  };

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Incoming Requests</h1>

      <div className="mb-4 flex gap-2">
        {(["WEB", "ANDROID"] as ContributionPlatform[]).map((option) => (
          <button
            key={option}
            className={`rounded border px-3 py-1 text-sm ${
              platform === option
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 bg-white text-gray-700"
            }`}
            onClick={() => setPlatform(option)}
          >
            {formatDisplayValue(option)}
          </button>
        ))}
      </div>

      {isLoading && <LoadingIndicator />}

      {!isLoading && requests.length === 0 && (
        <div className="flex justify-center items-center h-[75vh]">
          <Image
            src="/no_pending_invites.jpeg"
            width={500}
            height={500}
            alt="No Pending Requests"
            className="max-h-96"
          />
        </div>
      )}

      {requests.length > 0 && (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-100">
              <tr>
                <th className="p-3 text-left">S.No.</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Github Username</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Team</th>
                <th className="p-3 text-left">Note</th>
                <th className="p-3 text-left">Requested At</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request, index) => (
                <tr key={request.id} className="border-b align-top">
                  <td className="p-3">{index + 1}</td>
                  <td className="p-3">{request.email}</td>
                  <td className="p-3">{request.username}</td>
                  <td className="p-3">{formatDisplayValue(request.role)}</td>
                  <td className="p-3">{formatDisplayValue(request.team)}</td>
                  <td className="p-3 max-w-xs whitespace-pre-wrap">
                    {request.note || "-"}
                  </td>
                  <td className="p-3">
                    {new Date(request.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        className="rounded bg-green-600 px-3 py-1 cursor-pointer text-white disabled:opacity-60"
                        disabled={updatingRequestId === request.id}
                        onClick={() => handleDecision(request.id, "ACCEPT")}
                      >
                        Accept
                      </button>
                      <button
                        className="rounded bg-red-600 px-3 py-1  cursor-pointer text-white disabled:opacity-60"
                        disabled={updatingRequestId === request.id}
                        onClick={() => openDeclineModal(request.id)}
                      >
                        Decline
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeclineRequestModal
        open={Boolean(declineTargetRequestId)}
        loading={Boolean(updatingRequestId)}
        onOpenChange={(open) => {
          if (!open) {
            closeDeclineModal();
          }
        }}
        onSubmit={submitDecline}
      />
    </>
  );
}
