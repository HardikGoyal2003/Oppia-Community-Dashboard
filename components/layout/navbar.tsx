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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Notification } from "@/lib/auth/auth.types";

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
  const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([]);
  const [readNotifications, setReadNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingReadNotifications, setLoadingReadNotifications] = useState(false);
  const [updatingNotificationId, setUpdatingNotificationId] = useState<string | null>(null);
  const [isAllNotificationsOpen, setIsAllNotificationsOpen] = useState(false);

  const username = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const userImage = session?.user?.image || "";

  useEffect(() => {
    (async () => {
      setLoadingNotifications(true);

      try {
        const response = await fetch("/api/notifications?status=unread", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load notifications.");
        }

        const data = (await response.json()) as {
          notifications: Notification[];
        };

        setUnreadNotifications(data.notifications ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingNotifications(false);
      }
    })();
  }, []);

  const unreadCount = unreadNotifications.length;

  const allNotifications = useMemo(
    () =>
      [...unreadNotifications, ...readNotifications].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [readNotifications, unreadNotifications]
  );

  const handleMarkAsRead = async (notificationId: string) => {
    setUpdatingNotificationId(notificationId);

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read.");
      }

      const notification = unreadNotifications.find(
        item => item.id === notificationId
      );

      if (!notification) {
        return;
      }

      setUnreadNotifications(prev =>
        prev.filter(item => item.id !== notificationId)
      );
      setReadNotifications(prev => [
        { ...notification, read: true },
        ...prev.filter(item => item.id !== notificationId),
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingNotificationId(null);
    }
  };

  const handleSeeAll = async () => {
    setLoadingReadNotifications(true);

    try {
      const response = await fetch("/api/notifications?status=read", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load all notifications.");
      }

      const data = (await response.json()) as {
        notifications: Notification[];
      };

      setReadNotifications(data.notifications ?? []);
      setIsAllNotificationsOpen(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingReadNotifications(false);
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
                unreadNotifications.length === 0 && (
                  <div className="p-3 text-sm text-gray-500">
                    No unread notifications.
                  </div>
                )}

              {!loadingNotifications &&
                unreadNotifications.map(notification => (
                  <div
                    key={notification.id}
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
                        disabled={updatingNotificationId === notification.id}
                        onClick={() =>
                          handleMarkAsRead(notification.id)
                        }
                      >
                        Mark as read
                      </Button>
                    )}
                  </div>
                ))}

              <DropdownMenuSeparator />
              <div className="p-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={loadingReadNotifications}
                  onClick={handleSeeAll}
                >
                  {loadingReadNotifications ? "Loading..." : "See all"}
                </Button>
              </div>
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

      <Dialog
        open={isAllNotificationsOpen}
        onOpenChange={setIsAllNotificationsOpen}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>All Notifications</DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {allNotifications.length === 0 && (
              <p className="text-sm text-gray-500">
                No notifications yet.
              </p>
            )}

            {allNotifications.map(notification => (
              <div
                key={notification.id}
                className="rounded-lg border p-3"
              >
                <p className="whitespace-pre-line text-sm text-gray-800">
                  {notification.message}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {getDaysAgoLabel(new Date(notification.createdAt))}
                </p>
              </div>
            ))}
          </div>

          <DialogClose asChild>
            <Button className="mt-2">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </header>
  );
};
