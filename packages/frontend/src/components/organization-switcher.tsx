import * as React from "react";
import {
  Mail01Icon,
  Mailbox01Icon,
  PlusSignIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
  ChevronsUpDownIcon,
  type ChevronsUpDownIconHandle,
} from "@/components/ui/chevrons-up-down";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { OrganizationAvatar } from "@/features/organization/components/organization-avatar";
import {
  type OrganizationItem,
  useCreateOrganizationMutation,
  useOrganizationsQuery,
  useOrganizationStatsQuery,
  useSetActiveOrganizationMutation,
} from "@/features/organization/hooks/use-organizations";
import { cn } from "@/lib/utils";

const MAX_ORGANIZATIONS = 3;

export const OrganizationSwitcher = () => {
  const { isMobile, state } = useSidebar();
  const {
    activeOrganizationId,
    isLoading: isAuthLoading,
    isSigningOut,
    isAuthenticated,
  } = useAuth();
  const organizationsQuery = useOrganizationsQuery();
  const organizationStatsQuery = useOrganizationStatsQuery();
  const setActiveMutation = useSetActiveOrganizationMutation();
  const createMutation = useCreateOrganizationMutation();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const chevronsRef = React.useRef<ChevronsUpDownIconHandle | null>(null);

  const organizations: OrganizationItem[] = organizationsQuery.data ?? [];
  const activeOrganization =
    organizations.find(org => org.id === activeOrganizationId) ??
    organizations[0];
  const organizationStatsById = React.useMemo(() => {
    const stats = organizationStatsQuery.data ?? [];
    return new Map(stats.map(item => [item.organizationId, item]));
  }, [organizationStatsQuery.data]);
  const activeOrganizationStats = activeOrganization
    ? organizationStatsById.get(activeOrganization.id)
    : undefined;
  const hasLoadedStats = organizationStatsQuery.data !== undefined;
  const formatCountValue = (value: number | undefined) => {
    if (typeof value === "number") return value.toLocaleString();
    return hasLoadedStats ? "0" : "--";
  };
  const formatCountLabel = (
    value: number | undefined,
    singular: string,
    plural: string
  ) => {
    if (typeof value === "number") {
      return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
    }
    if (hasLoadedStats) return `0 ${plural}`;
    return `Loading ${plural}`;
  };

  const isBusy =
    organizationsQuery.isLoading ||
    setActiveMutation.isPending ||
    createMutation.isPending;
  const isInitialOrganizationLoad =
    organizationsQuery.isLoading ||
    (organizationsQuery.isFetching && organizationsQuery.data === undefined);
  const isAtOrganizationLimit = organizations.length >= MAX_ORGANIZATIONS;
  const isCreateDisabled = isBusy || isAtOrganizationLimit;
  const menuSide = isMobile
    ? "bottom"
    : state === "collapsed"
      ? "right"
      : "bottom";

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === activeOrganizationId) return;
    setErrorMessage(null);

    try {
      await setActiveMutation.mutateAsync(organizationId);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleCreate = async () => {
    if (organizations.length >= MAX_ORGANIZATIONS) return;

    const name = window.prompt("Organization name");
    if (!name) return;

    setErrorMessage(null);
    try {
      await createMutation.mutateAsync(name);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleTriggerMouseEnter = () => {
    if (isDropdownOpen) return;
    chevronsRef.current?.startAnimation();
  };

  const handleTriggerMouseLeave = () => {
    if (isDropdownOpen) return;
    chevronsRef.current?.stopAnimation();
  };

  const handleOpenChange = (open: boolean) => {
    setIsDropdownOpen(open);
    if (open) {
      chevronsRef.current?.startAnimation();
      return;
    }
    chevronsRef.current?.stopAnimation();
  };

  if (!activeOrganization) {
    if (isSigningOut || !isAuthenticated) {
      return null;
    }

    if (isAuthLoading || isInitialOrganizationLoad) {
      return (
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" disabled>
              <Skeleton className="size-8 shrink-0 rounded-lg bg-sidebar-primary/50" />
              <div className="grid flex-1 gap-1.5 leading-tight group-data-[collapsible=icon]:hidden">
                <Skeleton className="h-4 w-32 bg-sidebar-foreground/20" />
                <Skeleton className="h-3 w-24 bg-sidebar-foreground/15" />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      );
    }

    return (
      <div className="px-2 pt-2 text-xs text-destructive group-data-[collapsible=icon]:hidden">
        No active organization
      </div>
    );
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="aria-expanded:bg-sidebar-accent cursor-pointer"
                  onMouseEnter={handleTriggerMouseEnter}
                  onMouseLeave={handleTriggerMouseLeave}
                />
              }
            >
              <OrganizationAvatar
                organizationId={activeOrganization.id}
                organizationName={activeOrganization.name}
                className="shrink-0"
              />
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium">
                  {activeOrganization.name}
                </span>
                <TooltipProvider delay={120}>
                  <span className="flex items-center gap-2.5 text-xs text-sidebar-foreground/70">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex items-center gap-1" />
                        }
                      >
                        <HugeiconsIcon
                          icon={UserMultiple02Icon}
                          strokeWidth={2}
                          className="size-3!"
                        />
                        <span>
                          {formatCountValue(
                            activeOrganizationStats?.memberCount
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {formatCountLabel(
                          activeOrganizationStats?.memberCount,
                          "member",
                          "members"
                        )}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex items-center gap-1" />
                        }
                      >
                        <HugeiconsIcon
                          icon={Mailbox01Icon}
                          strokeWidth={2}
                          className="size-3.5!"
                        />
                        <span>
                          {formatCountValue(
                            activeOrganizationStats?.addressCount
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {formatCountLabel(
                          activeOrganizationStats?.addressCount,
                          "email address",
                          "email addresses"
                        )}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex items-center gap-1" />
                        }
                      >
                        <HugeiconsIcon
                          icon={Mail01Icon}
                          strokeWidth={2}
                          className="size-3!"
                        />
                        <span>
                          {formatCountValue(
                            activeOrganizationStats?.emailCount
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {formatCountLabel(
                          activeOrganizationStats?.emailCount,
                          "email received",
                          "emails received"
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TooltipProvider>
              </div>
              <ChevronsUpDownIcon
                ref={chevronsRef}
                size={16}
                className="ml-1 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className={cn(
                "rounded-lg",
                state === "collapsed" ? "min-w-56" : "min-w-0"
              )}
              align="start"
              side={menuSide}
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Organizations
                </DropdownMenuLabel>
                {organizations.map(org => (
                  <DropdownMenuItem
                    key={org.id}
                    className="gap-2.5 cursor-pointer"
                    disabled={isBusy}
                    onClick={() => void handleSwitch(org.id)}
                  >
                    <OrganizationAvatar
                      organizationId={org.id}
                      organizationName={org.name}
                      size="sm"
                      className="shrink-0"
                    />
                    <span className="flex-1 truncate">{org.name}</span>
                    {org.id === activeOrganizationId ? (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Active
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <TooltipProvider delay={120}>
                <Tooltip>
                  <TooltipTrigger render={<div className="w-full" />}>
                    <DropdownMenuItem
                      disabled={isCreateDisabled}
                      onClick={() => void handleCreate()}
                    >
                      <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
                      Create organization
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  {isAtOrganizationLimit ? (
                    <TooltipContent side="top">
                      You can have 3 orgs max
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {errorMessage ? (
        <p className="px-2 pt-1 text-xs text-destructive group-data-[collapsible=icon]:hidden">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
};
