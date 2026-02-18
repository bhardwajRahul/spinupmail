import * as React from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Mailbox01Icon,
  AddressBookIcon,
  Settings05Icon,
  LogoutIcon,
  UserMultiple02Icon,
  DashboardSquare01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import BoringAvatar from "boring-avatars";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { getAvatarColors } from "@/lib/avatar-colors";
import type { AuthUser } from "@/lib/auth";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: AuthUser | null;
  onSignOut: () => Promise<void> | void;
};

type NavItem = {
  title: string;
  to: string;
  end?: boolean;
  icon: typeof DashboardSquare01Icon;
};

const navItems: NavItem[] = [
  {
    title: "Overview",
    to: "/",
    end: true,
    icon: DashboardSquare01Icon,
  },
  {
    title: "Mailbox",
    to: "/mailbox",
    icon: Mailbox01Icon,
  },
  {
    title: "Addresses",
    to: "/addresses",
    icon: AddressBookIcon,
  },
  {
    title: "Settings",
    to: "/settings",
    icon: Settings05Icon,
  },
  {
    title: "Organization",
    to: "/organization/settings",
    icon: UserMultiple02Icon,
  },
];

export const AppSidebar = ({ user, onSignOut, ...props }: AppSidebarProps) => {
  const { isMobile, state } = useSidebar();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const navigateIfNeeded = React.useCallback(
    (to: string) => {
      if (location.pathname === to) return;
      void navigate(to);
    },
    [location.pathname, navigate]
  );
  const userAvatarSeed = user?.id ?? user?.email ?? user?.name ?? "guest";
  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  const userAvatarColors = React.useMemo(
    () => getAvatarColors(userAvatarSeed, resolvedTheme),
    [userAvatarSeed, resolvedTheme]
  );

  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader className="h-16 border-b border-border/70 mt-px">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigateIfNeeded("/")}
              size="lg"
              className="gap-1"
            >
              <img
                src="/logo-black.png"
                alt="SpinupMail"
                className="size-8 shrink-0 rounded-lg object-contain dark:hidden"
              />
              <img
                src="/logo-transparent.png"
                alt="SpinupMail"
                className="size-8 shrink-0 rounded-lg object-contain hidden dark:block"
              />
              <div className="flex flex-col text-left group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold">SpinupMail</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <OrganizationSwitcher />
          <SidebarGroupContent className="pt-2">
            <SidebarMenu>
              {navItems.map(item => {
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => navigateIfNeeded(item.to)}
                      tooltip={item.title}
                      className="pl-4"
                    >
                      <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="aria-expanded:bg-sidebar-accent"
                  />
                }
              >
                <div className="h-[30px] w-[30px] shrink-0 overflow-hidden rounded-md border border-border/70 leading-none [&>svg]:block! [&>svg]:size-full!">
                  <BoringAvatar
                    size="100%"
                    name={userAvatarSeed}
                    variant="beam"
                    colors={userAvatarColors}
                    className="block! size-full!"
                    square
                  />
                </div>
                <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-medium">
                    {user?.name ?? "User"}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {user?.email ?? "Not available"}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56 rounded-lg"
                side={
                  isMobile ? "bottom" : state === "collapsed" ? "right" : "top"
                }
                sideOffset={6}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Account
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => navigateIfNeeded("/settings")}
                  >
                    <HugeiconsIcon icon={Settings05Icon} strokeWidth={2} />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void onSignOut()}>
                  <HugeiconsIcon icon={LogoutIcon} strokeWidth={2} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
