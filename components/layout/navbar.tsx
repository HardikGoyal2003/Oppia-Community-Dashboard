"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Notification } from "@/lib/auth/auth.types";

type NotificationItem = Notification & {
  originalIndex: number;
};

function getDaysAgoLabel(createdAt: Date): string {
  const now = new Date().getTime();
  const then = createdAt.getTime();
  const diffInDays = Math.floor(
    (now - then) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays <= 0) return "Today";
  if (diffInDays === 1) return "1 day ago";
  return `${diffInDays} days ago`;
}

export const Navbar = ({
  leftContent,
}: {
  leftContent?: ReactNode;
}) => {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [updatingIndex, setUpdatingIndex] = useState<number | null>(null);

  const username = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const userImage = session?.user?.image || "";

  useEffect(() => {
    (async () => {
      setLoadingNotifications(true);

      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load notifications.");
        }

        const data = (await response.json()) as {
          notifications: Notification[];
        };

        setNotifications(data.notifications ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingNotifications(false);
      }
    })();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const orderedNotifications = useMemo<NotificationItem[]>(
    () =>
      notifications
        .map((notification, index) => ({
          ...notification,
          originalIndex: index,
        }))
        .reverse(),
    [notifications]
  );

  const handleMarkAsRead = async (notificationIndex: number) => {
    setUpdatingIndex(notificationIndex);

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationIndex }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read.");
      }

      setNotifications(prev =>
        prev.map((notification, index) =>
          index === notificationIndex
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingIndex(null);
    }
  };

  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-white px-6">
      <div className="mx-auto flex h-full w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {leftContent}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-medium text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-96">
              <DropdownMenuLabel>
                Notifications
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {loadingNotifications && (
                <div className="p-3 text-sm text-gray-500">
                  Loading notifications...
                </div>
              )}

              {!loadingNotifications &&
                orderedNotifications.length === 0 && (
                  <div className="p-3 text-sm text-gray-500">
                    No notifications yet.
                  </div>
                )}

              {!loadingNotifications &&
                orderedNotifications.map(notification => (
                  <div
                    key={`${notification.originalIndex}-${notification.createdAt.toString()}`}
                    className="border-b last:border-b-0 p-3"
                  >
                    <p className="whitespace-pre-line text-sm text-gray-800">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {getDaysAgoLabel(new Date(notification.createdAt))}
                    </p>
                    {!notification.read && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={
                          updatingIndex === notification.originalIndex
                        }
                        onClick={() =>
                          handleMarkAsRead(notification.originalIndex)
                        }
                      >
                        Mark as read
                      </Button>
                    )}
                  </div>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 w-10 rounded-full p-0"
                aria-label="Open profile menu"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={userImage} alt={username} />
                  <AvatarFallback>
                    {username.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="truncate font-medium">{username}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {userEmail}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
