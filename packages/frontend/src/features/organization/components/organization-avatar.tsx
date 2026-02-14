import BoringAvatar from "boring-avatars";
import { getAvatarColors } from "@/lib/avatar-colors";
import { cn } from "@/lib/utils";

type OrganizationAvatarProps = {
  organizationId: string;
  organizationName?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
};

const SIZE_CLASS_MAP = {
  sm: "size-6",
  default: "size-8",
  lg: "size-10",
} as const;

export const OrganizationAvatar = ({
  organizationId,
  organizationName,
  size = "default",
  className,
}: OrganizationAvatarProps) => {
  const colors = getAvatarColors(organizationId);
  const name = organizationName?.trim() || organizationId;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border/70 leading-none [&>svg]:block! [&>svg]:size-full!",
        SIZE_CLASS_MAP[size],
        className
      )}
      aria-hidden="true"
    >
      <BoringAvatar
        size="100%"
        name={`${organizationId}:${name}`}
        variant="bauhaus"
        colors={colors}
        className="block! size-full!"
        square
      />
    </div>
  );
};
