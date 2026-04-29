(() => {
  const svg = d3.select("#level2-svg");
  if (svg.empty()) {
    return;
  }

  const width = Number(svg.attr("width"));
  const height = Number(svg.attr("height"));
  const margin = { top: 28, right: 150, bottom: 52, left: 78 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parseDate = d3.timeParse("%Y-%m-%d");
  const tooltip = d3.select("#tooltip");
  const state = { mode: "max", cells: [], years: [], valueExtent: [0, 1] };

  const root = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  root.append("g").attr("class", "cell-groups");
  root.append("g").attr("class", "x-axis axis").attr("transform", `translate(0, ${innerHeight})`);
  root.append("g").attr("class", "y-axis axis");
  root.append("g").attr("class", "legend").attr("transform", `translate(${innerWidth + 48}, 28)`);

  Promise.resolve(
    d3.csv("temperature_daily.csv", (row) => {
      const date = parseDate(row.date);
      return {
        date,
        year: date.getFullYear(),
        month: date.getMonth(),
        day: date.getDate(),
        maxTemperature: +row.max_temperature,
        minTemperature: +row.min_temperature
      };
    })
  ).then((data) => {
    const latestYear = d3.max(data, (d) => d.year);
    const startYear = latestYear - 7;
    const filtered = data.filter((d) => d.year >= startYear);

    state.valueExtent = [
      d3.min(filtered, (d) => d.minTemperature),
      d3.max(filtered, (d) => d.maxTemperature)
    ];

    const grouped = d3.rollups(
      filtered,
      (days) => ({
        year: days[0].year,
        month: days[0].month,
        records: days
          .slice()
          .sort((a, b) => d3.ascending(a.day, b.day)),
        maxMonthlyValue: d3.max(days, (d) => d.maxTemperature),
        minMonthlyValue: d3.min(days, (d) => d.minTemperature)
      }),
      (d) => d.year,
      (d) => d.month
    );

    state.cells = grouped.flatMap(([year, monthEntries]) =>
      monthEntries.map(([month, summary]) => ({
        year,
        month,
        records: summary.records,
        maxMonthlyValue: summary.maxMonthlyValue,
        minMonthlyValue: summary.minMonthlyValue
      }))
    ).sort((a, b) => d3.ascending(a.year, b.year) || d3.ascending(a.month, b.month));

    state.years = [...new Set(state.cells.map((d) => d.year))];
    render();
  });

  d3.selectAll('.mode-button[data-level="2"]').on("click", function () {
    const button = d3.select(this);
    state.mode = button.attr("data-mode");
    d3.selectAll('.mode-button[data-level="2"]').classed("active", false);
    button.classed("active", true);
    render();
  });

  function render() {
    const modeField = state.mode === "max" ? "maxTemperature" : "minTemperature";
    const monthlyField = state.mode === "max" ? "maxMonthlyValue" : "minMonthlyValue";
    const valueLabel = state.mode === "max" ? "Daily max" : "Daily min";
    const colorInterpolator = state.mode === "max" ? d3.interpolateOrRd : d3.interpolatePuBu;

    const x = d3.scaleBand()
      .domain(state.years)
      .range([0, innerWidth])
      .padding(0.08);

    const y = d3.scaleBand()
      .domain(d3.range(12))
      .range([0, innerHeight])
      .padding(0.08);

    const cellWidth = x.bandwidth();
    const cellHeight = y.bandwidth();
    const dayScale = d3.scaleLinear().domain([1, 31]).range([6, cellWidth - 6]);
    const tempScale = d3.scaleLinear().domain(state.valueExtent).nice().range([cellHeight - 6, 6]);
    const color = d3.scaleSequential(colorInterpolator)
      .domain(d3.extent(state.cells, (d) => d[monthlyField]));

    root.select(".x-axis")
      .call(d3.axisBottom(x).tickSize(0))
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll("text").attr("dy", "1.2em"));

    root.select(".y-axis")
      .call(d3.axisLeft(y).tickFormat((month) => months[month]).tickSize(0))
      .call((g) => g.select(".domain").remove());

    const line = d3.line()
      .x((d) => dayScale(d.day))
      .y((d) => tempScale(d[modeField]));

    const cells = root.select(".cell-groups")
      .selectAll("g.month-cell")
      .data(state.cells, (d) => `${d.year}-${d.month}`)
      .join("g")
      .attr("class", "month-cell")
      .attr("transform", (d) => `translate(${x(d.year)}, ${y(d.month)})`);

    cells.selectAll("rect.cell-bg")
      .data((d) => [d])
      .join("rect")
      .attr("class", "cell cell-bg")
      .attr("width", cellWidth)
      .attr("height", cellHeight)
      .attr("rx", 6)
      .attr("fill", (d) => color(d[monthlyField]));

    cells.selectAll("path.cell-line")
      .data((d) => [d])
      .join("path")
      .attr("class", `level2-line cell-line ${state.mode}`)
      .attr("d", (d) => line(d.records));

    cells
      .on("mouseenter", function (event, d) {
        d3.select(this).select("rect.cell-bg").classed("highlight", true);
        const firstRecord = d.records[0];
        const lastRecord = d.records[d.records.length - 1];
        showTooltip(event, `
          <strong>${months[d.month]} ${d.year}</strong>
          <div>${valueLabel} range: ${d3.min(d.records, (row) => row[modeField]).toFixed(1)} °C - ${d3.max(d.records, (row) => row[modeField]).toFixed(1)} °C</div>
          <div>Days covered: ${firstRecord.day} - ${lastRecord.day}</div>
        `);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        d3.select(this).select("rect.cell-bg").classed("highlight", false);
        hideTooltip();
      });

    drawLegend(color, valueLabel, state.cells.map((d) => d[monthlyField]));
  }

  function drawLegend(color, title, values) {
    const legend = root.select(".legend");
    legend.selectAll("*").remove();

    const legendHeight = 220;
    const legendWidth = 16;
    const domain = d3.extent(values);
    const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
    defs.select("#level2-legend-gradient").remove();

    const gradient = defs.append("linearGradient")
      .attr("id", "level2-legend-gradient")
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
      .text(`${title} by month`);

    legend.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("rx", 4)
      .attr("fill", "url(#level2-legend-gradient)");

    const legendScale = d3.scaleLinear()
      .domain(domain)
      .range([legendHeight, 0]);

    legend.append("g")
      .attr("class", "legend-axis")
      .attr("transform", `translate(${legendWidth}, 0)`)
      .call(d3.axisRight(legendScale).ticks(6).tickFormat((d) => `${d}°C`));

    legend.append("line")
      .attr("x1", -2)
      .attr("x2", 42)
      .attr("y1", legendHeight + 30)
      .attr("y2", legendHeight + 30)
      .attr("class", `level2-line ${state.mode}`);

    legend.append("text")
      .attr("x", 48)
      .attr("y", legendHeight + 34)
      .text(state.mode === "max" ? "Daily max line" : "Daily min line");
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
})();
