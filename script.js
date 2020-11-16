(() => {
    /**************************************************************************
     * Helpers
     **************************************************************************/
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

        getSelection(x, y) {
            const node = this.nodes.find(
                (node) => getDistPoints({ x, y }, node) <= node.radius
            );
            const edge = this.edges.find(
                (edge) => getDistEdgePoint(edge, { x, y }) <= edge.range
            );
            return node || edge;
        }

        draw() {
            this.paper.clear();
            this.edges.forEach((edge) => {
                const { start, end, strokeWidth } = edge;
                const stroke = this.selected.includes(edge) ? "blue" : "black";
                paper
                    .path(`M${start.x},${start.y}L${end.x},${end.y}`)
                    .attr("stroke-width", strokeWidth)
                    .attr("stroke", stroke);
            });
            this.nodes.forEach((node) => {
                const { x, y, radius } = node;
                const fill = this.selected.includes(node) ? "blue" : "black";
                paper.circle(x, y, radius).attr("fill", fill);
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
