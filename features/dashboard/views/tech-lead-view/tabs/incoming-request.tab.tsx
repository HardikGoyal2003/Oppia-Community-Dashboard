'use client'

import { LoadingIndicator } from '@/components/layout/loading-indicator';
import Image from 'next/image'
import { useEffect, useState } from 'react'

type MemberAccessRequest = {
  email: string;
  team: string;
  role: string;
  note: string;
  username: string;
  createdAt: string | Date;
};

export function IncomingRequestTab() {
  const [requests, setRequests] = useState<MemberAccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      try {
        const response = await fetch(
          "/api/member-access-requests",
          { cache: "no-store" }
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
  }, []);

  const handleDecision = async (
    email: string,
    decision: "ACCEPT" | "DECLINE"
  ) => {
    setUpdatingEmail(email);

    try {
      const response = await fetch("/api/member-access-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, decision }),
      });

      if (!response.ok) {
        throw new Error("Failed to update request.");
      }

      setRequests(prev =>
        prev.filter(request => request.email !== email)
      );
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingEmail(null);
    }
  };

  return(
    <>
      <h1 className="mb-6 text-2xl font-semibold">
          Incoming Requests
      </h1>

      {isLoading && <LoadingIndicator />}

      {!isLoading && requests.length === 0 && (
        <div className='flex justify-center items-center h-[75vh]'>
          <Image
            src="/no_pending_invites.jpeg"
            width={500}
            height={500}
            alt="No Pending Requests"
            className='max-h-96'
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
                <tr key={request.email} className="border-b align-top">
                  <td className="p-3">{index + 1}</td>
                  <td className="p-3">{request.email}</td>
                  <td className="p-3">{request.username}</td>
                  <td className="p-3">{request.role}</td>
                  <td className="p-3">{request.team}</td>
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
                        disabled={updatingEmail === request.email}
                        onClick={() =>
                          handleDecision(request.email, "ACCEPT")
                        }
                      >
                        Accept
                      </button>
                      <button
                        className="rounded bg-red-600 px-3 py-1  cursor-pointer text-white disabled:opacity-60"
                        disabled={updatingEmail === request.email}
                        onClick={() =>
                          handleDecision(request.email, "DECLINE")
                        }
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
    </>
  )
}
