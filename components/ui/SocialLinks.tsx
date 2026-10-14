import type { ComponentType, SVGProps } from "react";
import { SOCIAL_LINKS } from "@/lib/social";
import { FacebookIcon, InstagramIcon, LinkedInIcon, WhatsAppIcon, XIcon } from "@/components/ui/icons";
import styles from "./SocialLinks.module.css";

const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  x: XIcon,
  whatsapp: WhatsAppIcon,
};

export default function SocialLinks({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={`${styles.row} ${size === "sm" ? styles.sm : ""} ${className}`.trim()}>
      {SOCIAL_LINKS.map((social) => {
        const Icon = ICONS[social.key];
        if (!Icon) return null;
        return (
          <a
            key={social.key}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            // The icon is aria-hidden, so the accessible name lives here.
            aria-label={social.label}
            className={styles.link}
          >
            <Icon />
          </a>
        );
      })}
    </div>
  );
}
