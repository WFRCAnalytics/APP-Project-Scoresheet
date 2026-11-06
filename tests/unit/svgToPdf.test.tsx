// The chart SVG -> react-pdf converter: keeps shapes and text, drops what the PDF can't use, and
// flattens <tspan> lines into absolutely positioned text.

import { describe, expect, it } from "vitest";
import { svgMarkupToPdf } from "../../src/lib/report/svgToPdf";

const options = { width: 200, fontFamily: "Poppins" };

function flatten(node: unknown, out: { type: unknown; props: Record<string, unknown> }[] = []) {
  if (Array.isArray(node)) node.forEach((n) => flatten(n, out));
  else if (node && typeof node === "object" && "props" in node) {
    const el = node as { type: unknown; props: Record<string, unknown> };
    out.push(el);
    flatten(el.props.children, out);
  }
  return out;
}

describe("svgMarkupToPdf", () => {
  it("returns null for anything that is not usable SVG", () => {
    expect(svgMarkupToPdf("<p>nope</p>", options)).toBeNull();
    expect(svgMarkupToPdf("<svg xmlns='http://www.w3.org/2000/svg'></svg>", options)).toBeNull();
  });

  it("scales the chart to the requested width, keeping its aspect ratio", () => {
    const el = svgMarkupToPdf(
      "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='100'><rect x='0' y='0' width='10' height='10' fill='#fff'/></svg>",
      options,
    )!;
    expect(el.props.width).toBe(200);
    expect(el.props.height).toBe(50);
    expect(el.props.viewBox).toBe("0 0 400 100");
  });

  it("drops defs and clip paths, and keeps shapes", () => {
    const el = svgMarkupToPdf(
      "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><defs><clipPath id='a'><rect width='5' height='5'/></clipPath></defs>" +
        "<g><path d='M0 0L5 5' stroke='#000'/><circle cx='1' cy='1' r='1' fill='red'/></g></svg>",
      options,
    )!;
    const all = flatten(el.props.children);
    expect(all.some((n) => (n.props as { d?: string }).d === "M0 0L5 5")).toBe(true);
    expect(all.some((n) => (n.props as { r?: string }).r === "1")).toBe(true);
    expect(all.some((n) => (n.props as { width?: string }).width === "5")).toBe(false);
  });

  it("flattens tspans into one positioned line each, resolving em and dy offsets", () => {
    const el = svgMarkupToPdf(
      "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><text x='10' y='20' font-size='10' text-anchor='middle' fill='#123456'>" +
        "<tspan x='10' dy='12'>First</tspan><tspan x='10' dy='14'>Second</tspan></text></svg>",
      options,
    )!;
    const lines = flatten(el.props.children).filter((n) => n.props.textAnchor !== undefined);
    expect(lines.map((n) => n.props.children)).toEqual(["First", "Second"]);
    expect(lines.map((n) => n.props.y)).toEqual([32, 46]);
    expect(lines[0].props.textAnchor).toBe("middle");
    expect(lines[0].props.fill).toBe("#123456");
  });
});
