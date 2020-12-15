// TODO: parallel edge selection
// TODO: directed toggle

(() => {
    /**************************************************************************
     * Helpers
     **************************************************************************/

    function getKeyColor(key) {
        const colors = {
            b: "blue",
            g: "green",
            o: "orange",
            p: "purple",
            r: "red",
            x: "black",
            y: "yellow",
        };
        return colors[key];
    }

    function getDistPoints(point1, point2) {
        return Math.hypot(point2.y - point1.y, point2.x - point1.x);
    }

    function getDistEdgePoint(edge, point) {
        var dx = edge.end.x - edge.start.x;
        var dy = edge.end.y - edge.start.y;
        var l2 = dx * dx + dy * dy;

        if (l2 == 0) return getDistPoints(point, edge.start);

        var t =
            ((point.x - edge.start.x) * dx + (point.y - edge.start.y) * dy) /
            l2;
        t = Math.max(0, Math.min(1, t));

        return getDistPoints(point, {
            x: edge.start.x + t * dx,
            y: edge.start.y + t * dy,
        });
    }

    function getLoopCenter(edge, pageCenter) {
        const { start } = edge;
        const x = start.x;
        const y = start.y;
        const dx = x - pageCenter.x;
        const dy = y - pageCenter.y;
        const distance = getDistPoints(pageCenter, { x, y });
        return {
            x: (dx / distance) * start.radius + x,
            y: (dy / distance) * start.radius + y,
        };
    }

    function getMouseCoords(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        return { x, y };
    }

    function getParallelPoints(edge, height) {
        let { start, end } = edge;
        const dist = getDistPoints(start, end);

        // Unit vector
        const uv = {
            x: (end.x - start.x) / dist,
            y: (end.y - start.y) / dist,
        };

        // Make perpendicular
        let t = uv.x;
        uv.x = uv.y;
        uv.y = t * -1;

        const mid = {
            x: (end.x + start.x) / 2 + uv.x * height,
            y: (end.y + start.y) / 2 + uv.y * height,
        };
        start = {
            x: start.x + uv.x * height,
            y: start.y + uv.y * height,
        };
        end = {
            x: start.x + uv.x * height,
            y: start.y + uv.y * height,
        };
        return { mid, start, end };
    }

    /**************************************************************************
     * Classes
     **************************************************************************/
    class Node {
        constructor(id, x, y) {
            this.id = id;
            this.x = x;
            this.y = y;
            this.radius = 30;
            this.color = "black";
        }

        move(diffX, diffY) {
            this.x += diffX;
            this.y += diffY;
        }
    }

    class Edge {
        constructor(id, startNode, endNode) {
            this.id = id;
            this.start = startNode;
            this.end = endNode;
            this.range = 10;
            this.strokeWidth = 5;
            this.color = "black";
        }
    }

    class Graph {
        constructor(paper) {
            this.paper = paper;
            this.nodes = [];
            this.edges = [];
            this.selected = [];
            this.nextId = 0;
            this.draw();
        }

        load(nodes, edges, nextId) {
            this.nodes = nodes;
            this.edges = edges;
            this.nextId = nextId;
        }

        addNode(x, y) {
            const n = new Node(this.nextId, x, y);
            this.nodes.push(n);
            this.selected = [n];
            this.nextId++;
            this.draw();
        }

        addEdge(node1, node2) {
            const e = new Edge(this.nextId, node1, node2);
            this.edges.push(e);
            this.nextId++;
            this.draw();
        }

        addSelection(item) {
            this.selected.push(item);
            this.draw();
        }

        deleteSelected() {
            const selectedIds = this.selected.map((item) => item.id);
            this.nodes = this.nodes.filter(
                (node) => !selectedIds.includes(node.id)
            );
            // Edges should be removed if they were selected or their start/end node was selected
            this.edges = this.edges.filter((edge) =>
                selectedIds.every(
                    (id) =>
                        id !== edge.id &&
                        id !== edge.start.id &&
                        id !== edge.end.id
                )
            );
            this.selected = [];
            this.draw();
        }

        clearSelected() {
            this.selected = [];
            this.draw();
        }

        setSelectedColor(color) {
            this.selected.forEach((item) => (item.color = color));
            this.draw();
        }

        getSelection(x, y) {
            // Reverse the nodes/edges so that more recent elements are prioritized b/c they are
            // physically above older elements
            const revNodes = [...this.nodes].reverse();
            const revEdges = [...this.edges].reverse();

            const node = revNodes.find(
                (node) => getDistPoints({ x, y }, node) <= node.radius
            );

            const pageCenter = {
                x: this.paper.width / 2,
                y: this.paper.height / 2,
            };
            const edge = revEdges.find((edge) => {
                // Handle loops
                if (edge.start === edge.end) {
                    const loop = getLoopCenter(edge, pageCenter);
                    return getDistPoints({ x, y }, loop) <= edge.start.radius;
                }
                return getDistEdgePoint(edge, { x, y }) <= edge.range;
            });
            return node || edge;
        }

        getSelectedDegree() {
            const selectedNodes = this.nodes.filter((node) =>
                this.selected.includes(node)
            );
            return this.edges.reduce((sum, edge) => {
                selectedNodes.forEach((node) => {
                    if (node === edge.start || node === edge.end) sum += 1;
                });
                return sum;
            }, 0);
        }

        isBipartite() {
            if (!this.edges.length) return "N/A";

            const root = this.edges[0].start;
            const stack = [root];
            const colors = {
                [root.id]: "red",
            };
            let count = 1;

            while (stack.length) {
                const node = stack.shift();

                let neighbors = this.edges
                    .filter(({ start, end }) => start === node || end === node)
                    .map(({ start, end }) => {
                        if (start === node) return end;
                        return start;
                    });

                for (let neighbor of neighbors) {
                    if (!colors[neighbor.id]) {
                        colors[neighbor.id] =
                            colors[node.id] === "red" ? "black" : "red";
                        stack.push(neighbor);
                        count++;
                    } else if (colors[neighbor.id] === colors[node.id]) {
                        return "No";
                    }
                }
            }

            return count === this.nodes.length ? "Yes" : "No";
        }

        drawEdges() {
            // Draw loops
            const loops = this.edges.filter(({ start, end }) => start === end);
            const pageCenter = {
                x: this.paper.width / 2,
                y: this.paper.height / 2,
            };
            loops.forEach((edge) => {
                const { color, start, strokeWidth } = edge;
                const { x, y } = getLoopCenter(edge, pageCenter);
                const c = this.paper
                    .circle(x, y, start.radius)
                    .attr("fill", "white")
                    .attr("stroke", color)
                    .attr("stroke-width", strokeWidth);
                if (this.selected.includes(edge)) {
                    c.glow({ color: "black", width: 20, opacity: 0.3 });
                }
            });

            // Filter out the loops
            const normalEdges = this.edges.filter(
                (edge) => !loops.includes(edge)
            );

            // Get the count for each edge spanning the two given points
            const counts = {};
            for (let edge of normalEdges) {
                const { start, end } = edge;
                const key = [start.id, end.id].sort((a, b) => a - b).join("/");
                if (!counts[key]) {
                    counts[key] = [edge, 0];
                }
                counts[key][1]++;
            }

            for (let [edge, count] of Object.values(counts)) {
                const { start, end, strokeWidth, color } = edge;
                let p;

                // Draw the middle line when edge count is odd
                if (count % 2 !== 0) {
                    p = this.paper
                        .path(`M${start.x},${start.y}L${end.x},${end.y}`)
                        .attr("stroke-width", strokeWidth)
                        .attr("stroke", color);
                    if (this.selected.includes(edge)) {
                        p.glow({ color: "black", width: 20, opacity: 0.3 });
                    }
                    count -= 1;
                }

                // Draw the surrounding edges
                let height = 0;
                for (let i = 0; i < count; i++) {
                    height = i % 2 === 0 ? height * -1 + 40 : height * -1;
                    const { mid } = getParallelPoints(edge, height);
                    p = this.paper
                        .path(
                            `M${start.x},${start.y}Q ${mid.x} ${mid.y}, ${end.x} ${end.y}`
                        )
                        .attr("stroke-width", strokeWidth)
                        .attr("stroke", color);
                    if (this.selected.includes(edge)) {
                        p.glow({ color: "black", width: 20, opacity: 0.3 });
                    }
                }
            }
        }

        draw() {
            this.paper.clear();
            this.drawEdges();
            this.nodes.forEach((node) => {
                const { x, y, radius, color } = node;
                const c = this.paper
                    .circle(x, y, radius)
                    .attr("fill", color)
                    .attr("stroke-width", 0);
                if (this.selected.includes(node)) {
                    c.glow({ color: "black", width: 20, opacity: 0.3 });
                }
            });
            this.fillStats();
        }

        fillStats() {
            $("#n").html(`N: ${this.nodes.length}`);
            $("#m").html(`M: ${this.edges.length}`);
            $("#selected-degree").html(
                `Selection Degree: ${this.getSelectedDegree()}`
            );
            $("#is-bipartite").html(`Bipartite: ${this.isBipartite()}`);
        }
    }

    /**************************************************************************
     * Main
     **************************************************************************/
    const $window = $(window);
    const $paper = $("#paper");
    const paper = Raphael("paper", $window.width(), $window.height());
    const graph = new Graph(paper);

    // Resize the canvas on window resize
    $window.resize(() => paper.setSize($window.width(), $window.height()));

    // Single key press actions
    $window.on("keyup", (e) => {
        switch (e.key) {
            case "Backspace":
                graph.deleteSelected();
                break;
            default:
                const color = getKeyColor(e.key);
                if (color) {
                    graph.setSelectedColor(color);
                }
        }
    });

    // IMPORTANT handler responsible for selection, edge creation, and movement
    $paper.on("mousedown", (downE) => {
        const { x: startX, y: startY } = getMouseCoords(downE);

        // Get the element (edge/node) that the mouse is over
        const selection = graph.getSelection(startX, startY);

        // Early exit
        if (!selection) {
            graph.clearSelected();
            return;
        }

        // Edge creation
        if (downE.altKey && selection instanceof Node) {
            const selectedNodes = graph.selected.filter(
                (item) => item instanceof Node
            );
            selectedNodes.forEach((node) => graph.addEdge(node, selection));
            graph.clearSelected();
            graph.addSelection(selection);
            return;
        }

        // Selection logic
        const alreadySelected = graph.selected.includes(selection);
        if (!alreadySelected) {
            if (!downE.shiftKey) graph.clearSelected();
            graph.addSelection(selection);
        }

        /******************
         * Dragging logic
         ******************/

        // Keep track of the last position the mouse had
        let lastX = startX;
        let lastY = startY;

        $paper.on("mousemove", (moveE) => {
            const { x, y } = getMouseCoords(moveE);

            // If the drag was <= 5 pixels then ignore it by exiting b/c lot of clicks happen while
            // the mouse is moving slightly
            if (Math.abs(startX - x) <= 5 && Math.abs(startY - y) <= 5) return;

            // Move the nodes using the difference between the current mouse position and the last
            const selectedNodes = graph.selected.filter(
                (item) => item instanceof Node
            );
            selectedNodes.forEach((node) => node.move(x - lastX, y - lastY));
            graph.draw();
            lastX = x;
            lastY = y;
        });
    });

    // Adding new nodes
    $paper.on("dblclick", (e) => {
        const { x, y } = getMouseCoords(e);
        graph.addNode(x, y);
    });

    // Stop handling mousemove when the mouse is no longer clicked
    $paper.on("mouseup", (e) => $paper.off("mousemove"));

    // Save graph to JSON
    $("#save").click(() => {
        let { nodes, edges, nextId } = graph;
        const filename = window.prompt("Enter the graph name: ");
        if (!filename) return;
        const json = JSON.stringify({ nodes, edges, nextId });
        const blob = new Blob([json], { type: "application/json" });
        window.saveAs(blob, `${filename}.json`);
    });

    // Trigger the file input on Load button click
    $("#load").click(() => {
        $("#file-input").click();
    });

    // Load a JSON file
    $("#file-input").change(() => {
        const file = $("#file-input").prop("files")[0];
        const reader = new FileReader();
        reader.readAsText(file);

        reader.onload = function () {
            try {
                let { nodes, edges, nextId } = JSON.parse(reader.result);

                // Reassign the node objects from the JSON to class Node
                nodes = nodes.map((node) => Object.assign(new Node(), node));

                // Set the edge start/ends to reference the nodes we just initialized
                edges.forEach((edge) => {
                    edge.start = nodes.find(
                        (node) => edge.start.id === node.id
                    );
                    edge.end = nodes.find((node) => edge.end.id === node.id);
                });

                // Reassing the edge objects to class Edge
                edges = edges.map((edge) => Object.assign(new Edge(), edge));

                // Load everything
                graph.load(nodes, edges, nextId);
                graph.draw();
            } catch (e) {
                console.log(e);
                alert("JSON parsing failed for that document");
            }
        };

        reader.onerror = function () {
            alert("There was an error loading your file");
        };
    });
})();
