(() => {
  const networkSvg = d3.select("#level3-network-svg");
  const matrixSvg = d3.select("#level3-matrix-svg");
  if (networkSvg.empty() || matrixSvg.empty()) {
    return;
  }

  const tooltip = d3.select("#tooltip");
  const networkWidth = Number(networkSvg.attr("width"));
  const networkHeight = Number(networkSvg.attr("height"));
  const matrixWidth = Number(matrixSvg.attr("width"));
  const matrixHeight = Number(matrixSvg.attr("height"));
  const networkMargin = { top: 60, right: 80, bottom: 60, left: 100 };
  const matrixMargin = { top: 120, right: 20, bottom: 20, left: 120 };
  const innerNetworkWidth = networkWidth - networkMargin.left - networkMargin.right;
  const innerNetworkHeight = networkHeight - networkMargin.top - networkMargin.bottom;
  const innerMatrixWidth = matrixWidth - matrixMargin.left - matrixMargin.right;
  const innerMatrixHeight = matrixHeight - matrixMargin.top - matrixMargin.bottom;

  const networkRoot = networkSvg.append("g")
    .attr("transform", `translate(${networkMargin.left}, ${networkMargin.top})`);
  const matrixRoot = matrixSvg.append("g")
    .attr("transform", `translate(${matrixMargin.left}, ${matrixMargin.top})`);

  networkRoot.append("rect")
    .attr("class", "network-bounds")
    .attr("width", innerNetworkWidth)
    .attr("height", innerNetworkHeight)
    .attr("rx", 12);

  networkRoot.append("g").attr("class", "links-layer");
  networkRoot.append("g").attr("class", "nodes-layer");
  networkRoot.append("g").attr("class", "labels-layer");

  matrixRoot.append("g").attr("class", "row-highlights");
  matrixRoot.append("g").attr("class", "column-highlights");
  matrixRoot.append("g").attr("class", "cells-layer");
  matrixRoot.append("g").attr("class", "row-labels");
  matrixRoot.append("g").attr("class", "column-labels");
  matrixRoot.append("g").attr("class", "legend").attr("transform", `translate(${innerMatrixWidth - 50}, -110)`);

  Promise.resolve(d3.json("HKUST_coauthor_graph.json")).then((graph) => {
    const cseNodes = graph.nodes
      .map((node, index) => ({ ...node, originalIndex: index, displayName: node.fullname || node.itsc || node.uniqueID }))
      .filter((node) => node.dept === "CSE");

    const nodeByOriginalIndex = new Map(cseNodes.map((node) => [node.originalIndex, node]));
    const cseIndexSet = new Set(cseNodes.map((node) => node.originalIndex));

    const links = graph.edges
      .filter((edge) => cseIndexSet.has(edge.source) && cseIndexSet.has(edge.target))
      .map((edge) => ({
        source: nodeByOriginalIndex.get(edge.source),
        target: nodeByOriginalIndex.get(edge.target),
        count: edge.publications.length,
        publications: edge.publications
      }));

    cseNodes.forEach((node) => {
      node.degree = 0;
      node.totalCollaborations = 0;
    });

    links.forEach((link) => {
      link.source.degree += 1;
      link.target.degree += 1;
      link.source.totalCollaborations += link.count;
      link.target.totalCollaborations += link.count;
    });

    const sortedNodes = [...cseNodes].sort((a, b) => d3.descending(a.degree, b.degree) || d3.ascending(a.displayName, b.displayName));
    const positionByIndex = new Map(sortedNodes.map((node, index) => [node.originalIndex, index]));

    const matrixCells = links.flatMap((link) => ([
      {
        row: link.source.originalIndex,
        col: link.target.originalIndex,
        count: link.count,
        sourceNode: link.source,
        targetNode: link.target
      },
      {
        row: link.target.originalIndex,
        col: link.source.originalIndex,
        count: link.count,
        sourceNode: link.target,
        targetNode: link.source
      }
    ]));

    const x = d3.scaleBand()
      .domain(sortedNodes.map((node) => node.originalIndex))
      .range([0, innerMatrixWidth])
      .padding(0.04);

    const y = d3.scaleBand()
      .domain(sortedNodes.map((node) => node.originalIndex))
      .range([0, innerMatrixHeight])
      .padding(0.04);

    const radius = d3.scaleSqrt()
      .domain(d3.extent(cseNodes, (node) => node.degree))
      .range([6, 22]);

    const linkWidth = d3.scaleSqrt()
      .domain(d3.extent(links, (link) => link.count))
      .range([1, 5]);

    const matrixColor = d3.scaleSequential(d3.interpolatePuRd)
      .domain(d3.extent(matrixCells, (cell) => cell.count));

    drawNetwork(cseNodes, links, radius, linkWidth);
    drawMatrix(sortedNodes, matrixCells, x, y, matrixColor, positionByIndex);
    drawLegend(matrixColor, matrixCells.map((cell) => cell.count));

    function drawNetwork(nodes, linkData, radiusScale, linkWidthScale) {
      const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(linkData).id((d) => d.originalIndex).distance(90).strength(0.45))
        .force("charge", d3.forceManyBody().strength(-180))
        .force("center", d3.forceCenter(innerNetworkWidth / 2, innerNetworkHeight / 2))
        .force("collision", d3.forceCollide((d) => radiusScale(d.degree) + 4));

      const linkSelection = networkRoot.select(".links-layer")
        .selectAll("line.link")
        .data(linkData)
        .join("line")
        .attr("class", "link")
        .attr("data-source", (d) => d.source.originalIndex)
        .attr("data-target", (d) => d.target.originalIndex)
        .attr("stroke-width", (d) => linkWidthScale(d.count));

      const nodeSelection = networkRoot.select(".nodes-layer")
        .selectAll("circle.node")
        .data(nodes)
        .join("circle")
        .attr("class", "node")
        .attr("r", (d) => radiusScale(d.degree))
        .attr("data-node-id", (d) => d.originalIndex)
        .on("mouseenter", function (event, d) {
          highlightProfessor(d.originalIndex);
          labelSelection
            .filter((label) => label.originalIndex === d.originalIndex)
            .style("opacity", 1);
          showTooltip(event, `
            <strong>${d.displayName}</strong>
            <div>Department: ${d.dept}</div>
            <div>Collaborators: ${d.degree}</div>
            <div>Total collaborations: ${d.totalCollaborations}</div>
          `);
        })
        .on("mousemove", moveTooltip)
        .on("mouseleave", () => {
          clearHighlight();
          labelSelection.style("opacity", 0);
          hideTooltip();
        });

      const labelSelection = networkRoot.select(".labels-layer")
        .selectAll("text.node-label")
        .data(nodes)
        .join("text")
        .attr("class", "node-label")
        .attr("text-anchor", "middle")
        .style("opacity", 0)
        .style("pointer-events", "none")
        .text((d) => shortName(d.displayName));

      simulation.on("tick", () => {
        nodes.forEach((node) => {
          const padding = radiusScale(node.degree) + 28;
          node.x = Math.max(padding, Math.min(innerNetworkWidth - padding, node.x));
          node.y = Math.max(padding + 10, Math.min(innerNetworkHeight - padding, node.y));
        });

        linkSelection
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        nodeSelection
          .attr("cx", (d) => d.x)
          .attr("cy", (d) => d.y);

        labelSelection
          .attr("x", (d) => d.x)
          .attr("y", (d) => d.y - radiusScale(d.degree) - 8);
      });
    }

    function drawMatrix(nodes, cells, xScale, yScale, colorScale) {
      matrixRoot.select(".row-highlights")
        .selectAll("rect.row-highlight")
        .data(nodes)
        .join("rect")
        .attr("class", "row-highlight")
        .attr("data-row-id", (d) => d.originalIndex)
        .attr("x", 0)
        .attr("y", (d) => yScale(d.originalIndex))
        .attr("width", innerMatrixWidth)
        .attr("height", yScale.bandwidth())
        .style("opacity", 0);

      matrixRoot.select(".column-highlights")
        .selectAll("rect.column-highlight")
        .data(nodes)
        .join("rect")
        .attr("class", "column-highlight")
        .attr("data-column-id", (d) => d.originalIndex)
        .attr("x", (d) => xScale(d.originalIndex))
        .attr("y", 0)
        .attr("width", xScale.bandwidth())
        .attr("height", innerMatrixHeight)
        .style("opacity", 0);

      matrixRoot.select(".cells-layer")
        .selectAll("rect.matrix-cell")
        .data(cells)
        .join("rect")
        .attr("class", "matrix-cell")
        .attr("data-row-id", (d) => d.row)
        .attr("data-column-id", (d) => d.col)
        .attr("data-pair-key", (d) => pairKey(d.row, d.col))
        .attr("x", (d) => xScale(d.col))
        .attr("y", (d) => yScale(d.row))
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .attr("fill", (d) => colorScale(d.count))
        .on("mouseenter", function (event, d) {
          highlightPair(d.row, d.col);
          showTooltip(event, `
            <strong>${d.sourceNode.displayName} ↔ ${d.targetNode.displayName}</strong>
            <div>Collaborations: ${d.count}</div>
          `);
        })
        .on("mousemove", moveTooltip)
        .on("mouseleave", () => {
          clearHighlight();
          hideTooltip();
        });

      matrixRoot.select(".row-labels")
        .selectAll("text.matrix-label.row")
        .data(nodes)
        .join("text")
        .attr("class", "matrix-label row")
        .attr("x", -10)
        .attr("y", (d) => yScale(d.originalIndex) + yScale.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .text((d) => shortName(d.displayName));

      matrixRoot.select(".column-labels")
        .selectAll("text.matrix-label.column")
        .data(nodes)
        .join("text")
        .attr("class", "matrix-label column")
        .attr("transform", (d) => `translate(${xScale(d.originalIndex) + xScale.bandwidth() / 2}, -10) rotate(-55)`)
        .text((d) => shortName(d.displayName));
    }

    function drawLegend(colorScale, values) {
      const legend = matrixRoot.select(".legend");
      legend.selectAll("*").remove();

      const legendHeight = 90;
      const legendWidth = 150;
      const domain = d3.extent(values);
      const defs = matrixSvg.select("defs").empty() ? matrixSvg.append("defs") : matrixSvg.select("defs");
      defs.select("#level3-legend-gradient").remove();

      const gradient = defs.append("linearGradient")
        .attr("id", "level3-legend-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

      d3.range(0, 1.01, 0.1).forEach((stop) => {
        gradient.append("stop")
          .attr("offset", `${stop * 100}%`)
          .attr("stop-color", colorScale(domain[0] + stop * (domain[1] - domain[0])));
      });

      legend.append("text")
        .attr("class", "legend-title")
        .attr("x", 0)
        .attr("y", -10)
        .text("Collaboration count");

      legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", 12)
        .attr("rx", 4)
        .attr("fill", "url(#level3-legend-gradient)");

      const legendScale = d3.scaleLinear()
        .domain(domain)
        .range([0, legendWidth]);

      legend.append("g")
        .attr("class", "legend-axis")
        .attr("transform", "translate(0, 12)")
        .call(d3.axisBottom(legendScale).ticks(4).tickFormat(d3.format("d")));
    }

    function highlightProfessor(originalIndex) {
      const relatedLinks = links.filter((link) => link.source.originalIndex === originalIndex || link.target.originalIndex === originalIndex);
      const relatedPairs = new Set(relatedLinks.flatMap((link) => [pairKey(link.source.originalIndex, link.target.originalIndex), pairKey(link.target.originalIndex, link.source.originalIndex)]));
      const connectedNodes = new Set([originalIndex, ...relatedLinks.flatMap((link) => [link.source.originalIndex, link.target.originalIndex])]);

      networkRoot.selectAll("circle.node")
        .classed("dimmed", (d) => !connectedNodes.has(d.originalIndex))
        .classed("highlight", (d) => d.originalIndex === originalIndex);

      networkRoot.selectAll("line.link")
        .classed("dimmed", (d) => !(d.source.originalIndex === originalIndex || d.target.originalIndex === originalIndex))
        .classed("highlight", (d) => d.source.originalIndex === originalIndex || d.target.originalIndex === originalIndex);

      matrixRoot.selectAll("rect.matrix-cell")
        .classed("dimmed", (d) => !relatedPairs.has(pairKey(d.row, d.col)) && d.row !== originalIndex && d.col !== originalIndex)
        .classed("highlight", (d) => relatedPairs.has(pairKey(d.row, d.col)));

      matrixRoot.selectAll("rect.row-highlight")
        .style("opacity", (d) => d.originalIndex === originalIndex ? 1 : 0);
      matrixRoot.selectAll("rect.column-highlight")
        .style("opacity", (d) => d.originalIndex === originalIndex ? 1 : 0);
    }

    function highlightPair(rowIndex, colIndex) {
      const targetKey = pairKey(rowIndex, colIndex);
      const nodeIds = new Set([rowIndex, colIndex]);

      networkRoot.selectAll("text.node-label")
        .style("opacity", (d) => nodeIds.has(d.originalIndex) ? 1 : 0);

      networkRoot.selectAll("circle.node")
        .classed("dimmed", (d) => !nodeIds.has(d.originalIndex))
        .classed("highlight", (d) => nodeIds.has(d.originalIndex));

      networkRoot.selectAll("line.link")
        .classed("dimmed", (d) => !matchesPair(d, rowIndex, colIndex))
        .classed("highlight", (d) => matchesPair(d, rowIndex, colIndex));

      matrixRoot.selectAll("rect.matrix-cell")
        .classed("dimmed", (d) => pairKey(d.row, d.col) !== targetKey && pairKey(d.row, d.col) !== pairKey(colIndex, rowIndex))
        .classed("highlight", (d) => pairKey(d.row, d.col) === targetKey || pairKey(d.row, d.col) === pairKey(colIndex, rowIndex));

      matrixRoot.selectAll("rect.row-highlight")
        .style("opacity", (d) => d.originalIndex === rowIndex || d.originalIndex === colIndex ? 1 : 0);
      matrixRoot.selectAll("rect.column-highlight")
        .style("opacity", (d) => d.originalIndex === rowIndex || d.originalIndex === colIndex ? 1 : 0);
    }

    function clearHighlight() {
      networkRoot.selectAll("circle.node").classed("dimmed", false).classed("highlight", false);
      networkRoot.selectAll("line.link").classed("dimmed", false).classed("highlight", false);
      networkRoot.selectAll("text.node-label").style("opacity", 0);
      matrixRoot.selectAll("rect.matrix-cell").classed("dimmed", false).classed("highlight", false);
      matrixRoot.selectAll("rect.row-highlight, rect.column-highlight").style("opacity", 0);
    }

    function matchesPair(link, rowIndex, colIndex) {
      return (
        (link.source.originalIndex === rowIndex && link.target.originalIndex === colIndex) ||
        (link.source.originalIndex === colIndex && link.target.originalIndex === rowIndex)
      );
    }
  });

  function pairKey(a, b) {
    return `${a}-${b}`;
  }

  function shortName(name) {
    const cleaned = name.includes(",") ? name.split(",")[0].trim() : name.trim();
    return cleaned.length > 12 ? `${cleaned.slice(0, 10)}…` : cleaned;
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
