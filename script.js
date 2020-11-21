// TODO: loops
// TODO: parallel edges

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

    function getLoopCenter(edge, midpoint) {
        const { start } = edge;
        const x = start.x;
        const y = start.y;
        const dx = x - midpoint.x;
        const dy = y - midpoint.y;
        const distance = getDistPoints(midpoint, { x, y });
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
            const edge = revEdges.find(
                (edge) => getDistEdgePoint(edge, { x, y }) <= edge.range
            );
            return node || edge;
        }

        drawEdges() {
            // Draw loops
            const loops = this.edges.filter(({ start, end }) => start === end);
            const midpoint = {
                x: this.paper.width / 2,
                y: this.paper.height / 2,
            };
            loops.forEach((edge) => {
                const { x, y } = getLoopCenter(edge, midpoint);
                const c = paper
                    .circle(x, y, edge.start.radius)
                    .attr("fill", "white")
                    .attr("stroke-width", edge.strokeWidth);
            });

            // Draw normal edges
            const normalEdges = this.edges.filter(
                (edge) => !loops.includes(edge)
            );
            normalEdges.forEach((edge) => {
                const { start, end, strokeWidth, color } = edge;
                const p = paper
                    .path(`M${start.x},${start.y}L${end.x},${end.y}`)
                    .attr("stroke-width", strokeWidth)
                    .attr("stroke", color);
                if (this.selected.includes(edge)) {
                    p.glow({ color: "black", width: 20, opacity: 0.3 });
                }
            });
        }

        draw() {
            this.paper.clear();
            this.drawEdges();
            this.nodes.forEach((node) => {
                const { x, y, radius, color } = node;
                const c = paper
                    .circle(x, y, radius)
                    .attr("fill", color)
                    .attr("stroke-width", 0);
                if (this.selected.includes(node)) {
                    c.glow({ color: "black", width: 20, opacity: 0.3 });
                }
            });
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
