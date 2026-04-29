(() => {
  const svg = d3.select("#level1-svg");
  if (svg.empty()) {
    return;
  }

  const width = Number(svg.attr("width"));
  const height = Number(svg.attr("height"));
  const margin = { top: 28, right: 140, bottom: 48, left: 78 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parseDate = d3.timeParse("%Y-%m-%d");
  const tooltip = d3.select("#tooltip");
  const state = { mode: "max", monthlyData: [], years: [] };

  const root = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  root.append("g").attr("class", "cells-layer");
  root.append("g").attr("class", "x-axis axis").attr("transform", `translate(0, ${innerHeight})`);
  root.append("g").attr("class", "y-axis axis");
  root.append("g").attr("class", "legend").attr("transform", `translate(${innerWidth + 48}, 32)`);

  Promise.resolve(
    d3.csv("temperature_daily.csv", (row) => {
      const date = parseDate(row.date);
      return {
        date,
        year: date.getFullYear(),
        month: date.getMonth(),
        maxTemperature: +row.max_temperature,
        minTemperature: +row.min_temperature
      };
    })
  ).then((data) => {
    const grouped = d3.rollups(
      data,
      (days) => {
        const maxValue = d3.max(days, (d) => d.maxTemperature);
        const minValue = d3.min(days, (d) => d.minTemperature);
        return {
          year: days[0].year,
          month: days[0].month,
          maxValue,
          minValue,
          maxDate: days.find((d) => d.maxTemperature === maxValue)?.date ?? null,
          minDate: days.find((d) => d.minTemperature === minValue)?.date ?? null
        };
      },
      (d) => d.year,
      (d) => d.month
    );

    state.monthlyData = grouped.flatMap(([year, monthEntries]) =>
      monthEntries.map(([month, summary]) => ({
        year,
        month,
        maxValue: summary.maxValue,
        minValue: summary.minValue,
        maxDate: summary.maxDate,
        minDate: summary.minDate
      }))
    ).sort((a, b) => d3.ascending(a.year, b.year) || d3.ascending(a.month, b.month));

    state.years = [...new Set(state.monthlyData.map((d) => d.year))];
    render();
  });

  d3.selectAll('.mode-button[data-level="1"]').on("click", function () {
    const button = d3.select(this);
    state.mode = button.attr("data-mode");
    d3.selectAll('.mode-button[data-level="1"]').classed("active", false);
    button.classed("active", true);
    render();
  });

  function render() {
    const modeField = state.mode === "max" ? "maxValue" : "minValue";
    const colorInterpolator = state.mode === "max" ? d3.interpolateYlOrRd : d3.interpolatePuBu;
    const valueLabel = state.mode === "max" ? "Monthly max" : "Monthly min";
    const dateField = state.mode === "max" ? "maxDate" : "minDate";

    const x = d3.scaleBand()
      .domain(state.years)
      .range([0, innerWidth])
      .padding(0.04);

    const y = d3.scaleBand()
      .domain(d3.range(12))
      .range([0, innerHeight])
      .padding(0.04);

    const values = state.monthlyData.map((d) => d[modeField]);
    const color = d3.scaleSequential(colorInterpolator)
      .domain(d3.extent(values));

    root.select(".x-axis")
      .call(d3.axisBottom(x).tickSize(0))
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll("text").attr("dy", "1.2em"));

    root.select(".y-axis")
      .call(d3.axisLeft(y).tickFormat((month) => months[month]).tickSize(0))
      .call((g) => g.select(".domain").remove());

    root.select(".cells-layer")
      .selectAll("rect.cell")
      .data(state.monthlyData, (d) => `${d.year}-${d.month}`)
      .join("rect")
      .attr("class", "cell")
      .attr("x", (d) => x(d.year))
      .attr("y", (d) => y(d.month))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", (d) => color(d[modeField]))
      .on("mouseenter", function (event, d) {
        d3.select(this).classed("highlight", true);
        showTooltip(event, `
          <strong>${months[d.month]} ${d.year}</strong>
          <div>${valueLabel}: ${d[modeField].toFixed(1)} °C</div>
          <div>Date: ${formatDate(d[dateField])}</div>
        `);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        d3.select(this).classed("highlight", false);
        hideTooltip();
      });

    drawLegend(color, valueLabel, values);
  }

  function drawLegend(color, title, values) {
    const legend = root.select(".legend");
    legend.selectAll("*").remove();

    const legendHeight = 220;
    const legendWidth = 16;
    const domain = d3.extent(values);
    const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
    defs.select("#level1-legend-gradient").remove();

    const gradient = defs.append("linearGradient")
      .attr("id", "level1-legend-gradient")
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");

    d3.range(0, 1.01, 0.1).forEach((stop) => {
      gradient.append("stop")
        .attr("offset", `${stop * 100}%`)
        .attr("stop-color", color(domain[0] + stop * (domain[1] - domain[0])));
    });

    legend.append("text")
      .attr("class", "legend-title")
      .attr("x", 0)
      .attr("y", -12)
      .text(title);

    legend.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("rx", 4)
      .attr("fill", "url(#level1-legend-gradient)");

    const legendScale = d3.scaleLinear()
      .domain(domain)
      .range([legendHeight, 0]);

    legend.append("g")
      .attr("class", "legend-axis")
      .attr("transform", `translate(${legendWidth}, 0)`)
      .call(d3.axisRight(legendScale).ticks(6).tickFormat((d) => `${d}°C`));
  }

  function showTooltip(event, html) {
    tooltip.html(html)
      .style("opacity", 1)
      .attr("aria-hidden", "false");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    tooltip
      .style("left", `${event.pageX}px`)
      .style("top", `${event.pageY}px`);
  }

  function hideTooltip() {
    tooltip.style("opacity", 0).attr("aria-hidden", "true");
  }

  function formatDate(date) {
    return d3.timeFormat("%Y-%m-%d")(date);
  }
})();
