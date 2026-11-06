// Turns a rendered Recharts <svg> into react-pdf's own SVG primitives, so the report's charts are
// the SAME charts the app draws (not a screenshot): crisp vector shapes and real, selectable text
// in the PDF at any zoom.
//
// Recharts' output is plain presentational SVG (paths, rects, lines, circles, text) with literal
// hex colors (theme/chartColors.ts resolves its CSS variables before they reach Recharts), which is
// what makes it portable outside the page. This converter only needs to cover that subset:
//  - drops what react-pdf can't use or the report doesn't need (<defs>/<clipPath> and the
//    clip-path attributes pointing at them, <title> tooltips, gradients);
//  - flattens <text>/<tspan> into one react-pdf <Text> per line, with absolute coordinates —
//    react-pdf's SVG text doesn't honor tspan `dy`, and Recharts wraps/stacks labels with it;
//  - reads `style="..."` declarations as if they were attributes.

import { G, Svg, Text, Path, Rect, Line, Circle, Ellipse, Polygon, Polyline } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";

/** Attributes copied straight through (kebab-case in SVG -> camelCase for react-pdf). */
const PASS_THROUGH: Record<string, string> = {
  fill: "fill",
  stroke: "stroke",
  "stroke-width": "strokeWidth",
  "stroke-dasharray": "strokeDasharray",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "fill-opacity": "fillOpacity",
  "stroke-opacity": "strokeOpacity",
  "fill-rule": "fillRule",
  opacity: "opacity",
  transform: "transform",
};

const GEOMETRY: Record<string, string[]> = {
  path: ["d"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  polygon: ["points"],
  polyline: ["points"],
};

const SHAPES = {
  path: Path,
  rect: Rect,
  line: Line,
  circle: Circle,
  ellipse: Ellipse,
  polygon: Polygon,
  polyline: Polyline,
} as const;

const SKIPPED = new Set(["defs", "clippath", "title", "desc", "style", "foreignobject", "lineargradient", "radialgradient", "mask", "pattern"]);

export interface SvgToPdfOptions {
  /** Width the chart takes in the PDF, in points; height follows the chart's own aspect ratio. */
  width: number;
  fontFamily: string;
  /** Font family for bold text (chart titles etc.) when it is a separately registered family. */
  fontSize?: number;
}

function styleDeclarations(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  const style = el.getAttribute("style");
  if (!style) return out;
  for (const part of style.split(";")) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

function attr(el: Element, name: string): string | null {
  return styleDeclarations(el)[name] ?? el.getAttribute(name);
}

function presentation(el: Element): Record<string, string | number> {
  const props: Record<string, string | number> = {};
  const declarations = styleDeclarations(el);
  for (const [svgName, reactName] of Object.entries(PASS_THROUGH)) {
    const value = declarations[svgName] ?? el.getAttribute(svgName);
    // url(#id) paint servers (gradients, patterns) were dropped along with <defs>.
    if (value !== null && value !== "" && !value.startsWith("url(")) props[reactName] = value;
  }
  return props;
}

function isHidden(el: Element): boolean {
  const declarations = styleDeclarations(el);
  return (
    declarations.display === "none" ||
    el.getAttribute("display") === "none" ||
    el.getAttribute("visibility") === "hidden"
  );
}

/** "12" -> 12; "0.71em" -> 0.71 * fontSize; missing -> 0. */
function length(value: string | null, fontSize: number): number {
  if (!value) return 0;
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 0;
  return value.trim().endsWith("em") ? n * fontSize : n;
}

interface TextContext {
  fontFamily: string;
  fontSize: number;
}

/** One <text> becomes one react-pdf <Text> per visual line. */
function convertText(el: Element, key: string, ctx: TextContext): ReactElement[] {
  const fontSize = parseFloat(attr(el, "font-size") ?? "") || ctx.fontSize;
  const fontWeight = attr(el, "font-weight");
  const anchor = attr(el, "text-anchor");
  const fill = attr(el, "fill");
  const fillOpacity = attr(el, "fill-opacity");
  const transform = el.getAttribute("transform");

  let x = length(el.getAttribute("x"), fontSize);
  let y = length(el.getAttribute("y"), fontSize) + length(el.getAttribute("dy"), fontSize);

  const lines: { x: number; y: number; text: string }[] = [];
  const tspans = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === "tspan");
  if (tspans.length === 0) {
    lines.push({ x, y, text: (el.textContent ?? "").trim() });
  } else {
    for (const span of tspans) {
      if (span.hasAttribute("x")) x = length(span.getAttribute("x"), fontSize);
      if (span.hasAttribute("y")) y = length(span.getAttribute("y"), fontSize);
      y += length(span.getAttribute("dy"), fontSize);
      lines.push({ x, y, text: (span.textContent ?? "").trim() });
    }
  }

  const bold = fontWeight === "bold" || Number(fontWeight) >= 600;
  return lines
    .filter((line) => line.text !== "")
    .map((line, i) => (
      <Text
        key={`${key}-${i}`}
        x={line.x}
        y={line.y}
        transform={transform ?? undefined}
        textAnchor={anchor === "middle" || anchor === "end" ? anchor : "start"}
        fill={fill && !fill.startsWith("url(") ? fill : "#151515"}
        fillOpacity={fillOpacity ?? undefined}
        style={
          {
            fontFamily: ctx.fontFamily,
            fontSize,
            fontWeight: bold ? 600 : 400,
          } as never
        }
      >
        {line.text}
      </Text>
    ));
}

function convertChildren(parent: Element, key: string, ctx: TextContext): ReactNode[] {
  const out: ReactNode[] = [];
  Array.from(parent.children).forEach((child, i) => {
    const node = convertNode(child, `${key}-${i}`, ctx);
    if (Array.isArray(node)) out.push(...node);
    else if (node) out.push(node);
  });
  return out;
}

function convertNode(el: Element, key: string, ctx: TextContext): ReactNode | ReactNode[] | null {
  const tag = el.tagName.toLowerCase();
  if (SKIPPED.has(tag) || isHidden(el)) return null;

  if (tag === "text") return convertText(el, key, ctx);

  if (tag === "g") {
    return (
      <G key={key} {...presentation(el)}>
        {convertChildren(el, key, ctx)}
      </G>
    );
  }

  if (tag in SHAPES) {
    const Shape = SHAPES[tag as keyof typeof SHAPES] as unknown as (props: Record<string, unknown>) => ReactElement;
    const props: Record<string, unknown> = { ...presentation(el) };
    for (const name of GEOMETRY[tag] ?? []) {
      const value = el.getAttribute(name);
      if (value !== null) props[name] = value;
    }
    // Recharts draws unfilled shapes with fill="none"; a bare path with no paint would default to black.
    if (props.fill === undefined && tag !== "line") props.fill = "none";
    return <Shape key={key} {...props} />;
  }

  return null;
}

/** Parses SVG markup and returns a react-pdf <Svg> that is `width` points wide, or null if it
 * isn't usable SVG. */
export function svgMarkupToPdf(markup: string, options: SvgToPdfOptions): ReactElement | null {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) return null;

  const viewBox = root.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
  const w = viewBox?.[2] || parseFloat(root.getAttribute("width") ?? "");
  const h = viewBox?.[3] || parseFloat(root.getAttribute("height") ?? "");
  if (!w || !h) return null;

  const ctx: TextContext = { fontFamily: options.fontFamily, fontSize: options.fontSize ?? 12 };
  const height = (options.width * h) / w;
  return (
    <Svg width={options.width} height={height} viewBox={`0 0 ${w} ${h}`}>
      {convertChildren(root, "svg", ctx)}
    </Svg>
  );
}
