'use client'

import { LoadingIndicator } from '@/components/layout/loading-indicator';
import { useLoading } from '@/components/providers/loader-context';
import Image from 'next/image'
import { useEffect, useState } from 'react'


export function IncomingRequestTab({...prop}) {

  const [responseData, setResponseData] = useState<string | null>(null);
  const { isLoading, startLoading, stopLoading } = useLoading();

  useEffect(()=>{
    startLoading();
    setTimeout(()=>{
      setResponseData(null);
      stopLoading();
    }, 3000)
  }, [])

  return(
    <>
      <h1 className="mb-6 text-2xl font-semibold">
          Incoming Requests
      </h1>
      {isLoading && <LoadingIndicator />}
      {!responseData && 
      <div className='flex justify-center items-center h-[75vh]'>
        <Image src="/no_pending_invites.jpeg" width={500} height={500} alt="No Pending Requests" className='max-h-96'/>
      </div>
      }

      {responseData && 
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-100">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Username</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Team</th>
            </tr>
          </thead>

          {/* <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b">
                <td className="p-3">{user.fullName}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">
                  <select
                    value={user.role}
                    disabled={updatingId === user.id}
                    onChange={e =>
                      handleRoleChange(
                        user.id,
                        e.target.value as UserRole
                      )
                    }
                    className="border rounded px-2 py-1 disabled:opacity-50"
                  >
                    {ROLES.map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody> */}
        </table>
      </div>
      }
    </>
  )
}