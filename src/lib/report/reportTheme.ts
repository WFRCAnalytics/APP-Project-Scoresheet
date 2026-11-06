// Colors and fonts for the PDF report. Colors are the WFRC brand/chart tokens from
// theme/tokens.css written out as literal hex, because the report is drawn by react-pdf and can't
// read CSS variables. Fonts are bundled (@fontsource) rather than fetched from Google at export
// time, so the report renders the same offline and never waits on a font download.

import { Font } from "@react-pdf/renderer";
import interRegular from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import interSemibold from "@fontsource/inter/files/inter-latin-600-normal.woff?url";
import interBold from "@fontsource/inter/files/inter-latin-700-normal.woff?url";
import poppinsRegular from "@fontsource/poppins/files/poppins-latin-400-normal.woff?url";
import poppinsItalic from "@fontsource/poppins/files/poppins-latin-400-italic.woff?url";
import poppinsMedium from "@fontsource/poppins/files/poppins-latin-500-normal.woff?url";
import poppinsSemibold from "@fontsource/poppins/files/poppins-latin-600-normal.woff?url";

export const COLORS = {
  navy: "#023c5b", // --color-wfrc-blue (headings, primary)
  blue: "#3f748e", // --chart-1 (WFRC)
  green: "#789d4b", // --chart-2 (TLC Applicant)
  mustard: "#c48839", // --chart-3 (Overall)
  skyBlue: "#52b6d5", // --color-wfrc-secondary-blue
  yellow: "#f8b93e", // --color-wfrc-yellow (accent)
  text: "#151515",
  gray: "#76716e", // --color-wfrc-gray (secondary text)
  border: "#d8d5d2",
  panel: "#f4f6f8",
  white: "#ffffff",
  amberBackground: "#fdf3dc",
  amberBorder: "#e0a21f",
} as const;

export const METRIC_COLORS = {
  overall: COLORS.mustard,
  applicant: COLORS.green,
  wfrc: COLORS.blue,
} as const;

export const FONTS = {
  heading: "Inter",
  body: "Poppins",
} as const;

let registered = false;

/** Registers the report's typefaces with react-pdf (once) and turns hyphenation off, so a firm
 * or criterion name is never split mid-word. */
export function registerReportFonts(): void {
  if (registered) return;
  registered = true;
  Font.register({
    family: FONTS.heading,
    fonts: [
      { src: interRegular, fontWeight: 400 },
      { src: interSemibold, fontWeight: 600 },
      { src: interBold, fontWeight: 700 },
    ],
  });
  Font.register({
    family: FONTS.body,
    fonts: [
      { src: poppinsRegular, fontWeight: 400 },
      { src: poppinsItalic, fontWeight: 400, fontStyle: "italic" },
      { src: poppinsMedium, fontWeight: 500 },
      { src: poppinsSemibold, fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
}
