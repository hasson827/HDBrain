/**
 * Dark ECharts theme (README_XCH §8 S2 task 5). Canvas-rendered charts can't
 * read CSS custom properties, so these values are literal copies of the hex
 * codes in css/tokens.css — keep the two in sync by hand if the palette moves.
 * Registered once here; every station calls `echarts.init(el, "hdbrain-dark")`.
 */
const INK_1 = "#E8EDF5";
const INK_2 = "#93A1B5";
const BG_1 = "#101A2C";
const BG_2 = "#16233A";
const CORAL = "#FF6B6B";
const MINT = "#06D6A0";
const MANGO = "#FFD166";
const STRAIT_BLUE = "#118AB2";
const GRID_LINE = "rgba(232, 237, 245, 0.12)";

export function registerEchartsTheme() {
  window.echarts.registerTheme("hdbrain-dark", {
    color: [MINT, CORAL, MANGO, STRAIT_BLUE],
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Inter, system-ui, sans-serif", color: INK_1 },
    title: { textStyle: { color: INK_1, fontFamily: "Manrope, system-ui, sans-serif" } },
    legend: { textStyle: { color: INK_2 } },
    tooltip: {
      backgroundColor: "rgba(16, 28, 46, 0.92)",
      borderColor: "rgba(232, 237, 245, 0.16)",
      textStyle: { color: INK_1 },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: GRID_LINE } },
      axisTick: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: INK_2 },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: GRID_LINE } },
      axisTick: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: INK_2 },
      splitLine: { lineStyle: { color: GRID_LINE, type: "dashed" } },
    },
    line: { lineStyle: { width: 2 }, symbol: "circle", symbolSize: 6 },
    bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
  });
}
