// Persistent header shown above every screen (Load included). Logo variant is chosen by
// header width, not by screen/area, across three tiers: the horizontal lockup (mark +
// wordmark, short and wide) fits the 64px bar at desktop widths; below 1024px it swaps to
// the stacked lockup (mark over a single-line wordmark, narrower but taller) so the full
// name still fits a tablet-width bar; below 640px it swaps again to the abbreviated mark
// alone so it doesn't crowd "Project Evaluation Scoresheet" and the icon buttons. Color vs.
// white variant tracks the current theme, not prefers-color-scheme directly, so a manual
// override stays visually consistent with the rest of the page.
//
// Text next to the logo is deliberately "Project Evaluation Scoresheet" only — never the
// literal string "WFRC" — the logo itself already carries that identity.

import { CircleHelp } from "lucide-react";
import logoAbbreviatedColor from "../assets/logo/abbreviated/WFRC_logo_abbreviated_color_transparent.png";
import logoAbbreviatedWhite from "../assets/logo/abbreviated/WFRC_logo_abbreviated_white_transparent.png";
import logoHorizontalColor from "../assets/logo/horizontal/WFRC_logo_horizontal_color_transparent.png";
import logoHorizontalWhite from "../assets/logo/horizontal/WFRC_logo_horizontal_white_transparent.png";
import logoStackedColor from "../assets/logo/stacked/WFRC_logo_stacked_color_transparent.png";
import logoStackedWhite from "../assets/logo/stacked/WFRC_logo_stacked_white_transparent.png";
import { useMediaQuery } from "../theme/useMediaQuery";
import { useTheme } from "../theme/useTheme";
import { ThemeToggle } from "./ThemeToggle";

export interface AppHeaderProps {
  onOpenHelp: () => void;
}

export function AppHeader({ onOpenHelp }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");

  const logoSrc = isMobile
    ? theme === "dark"
      ? logoAbbreviatedWhite
      : logoAbbreviatedColor
    : isTablet
      ? theme === "dark"
        ? logoStackedWhite
        : logoStackedColor
      : theme === "dark"
        ? logoHorizontalWhite
        : logoHorizontalColor;

  return (
    <header className="app-header no-print">
      <div className="app-header-brand">
        <img src={logoSrc} alt="WFRC" className="app-header-logo" />
        <span className="app-header-title">Project Evaluation Scoresheet</span>
      </div>
      <div className="app-header-actions">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <button
          type="button"
          className="button-link app-header-icon-button"
          onClick={onOpenHelp}
          aria-label="Help & guide"
          title="Help & guide"
        >
          <CircleHelp size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
