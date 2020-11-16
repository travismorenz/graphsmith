function distancePoints(point1, point2) {
    return Math.hypot(point2.y - point1.y, point2.x - point1.x);
}

function distanceEdgePoint(edge, point) {
    const { start, end } = edge;
    const deltaY = end.y - start.y;
    const deltaX = end.x - start.x;
    const num = Math.abs(
        deltaY * point.x - deltaX * point.y + end.x * start.y - end.y * start.x
    );
    const dist = Math.hypot(deltaY, deltaX);
    return num / dist;
}

function getMouseCoords(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
}

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
        this.edges = this.edges.filter((edge) =>
            selectedIds.every(
                (id) =>
                    id !== edge.id && id !== edge.start.id && id !== edge.end.id
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
            (node) => distancePoints({ x, y }, node) <= node.radius
        );
        const edge = this.edges.find(
            (edge) => distanceEdgePoint(edge, { x, y }) <= edge.range
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

const paperEl = $("#paper");
const paper = Raphael("paper", 800, 800);
const graph = new Graph(paper);

let dragging = false;

paperEl.on("mousedown", (downE) => {
    const { x: startX, y: startY } = getMouseCoords(downE);
    const selection = graph.getSelection(startX, startY);
    dragging = false;

    if (!selection) {
        graph.clearSelected();
        return;
    }

    if (downE.altKey && selection instanceof Node) {
        const selectedNodes = graph.selected.filter(
            (item) => item instanceof Node
        );
        selectedNodes.forEach((node) => graph.addEdge(node, selection));
        graph.clearSelected();
        graph.addSelection(selection);
        return;
    }

    const alreadySelected = graph.selected.includes(selection);
    if (!alreadySelected) {
        if (!downE.shiftKey) graph.clearSelected();
        graph.addSelection(selection);
    }

    let lastX = startX;
    let lastY = startY;
    paperEl.on("mousemove", (moveE) => {
        const { x, y } = getMouseCoords(moveE);

        if (Math.abs(startX - x) > 5 || Math.abs(startY - y) > 5) {
            dragging = true;
            const selectedNodes = graph.selected.filter(
                (item) => item instanceof Node
            );
            selectedNodes.forEach((node) => node.move(x - lastX, y - lastY));
            graph.draw();
            lastX = x;
            lastY = y;
        }
    });
});

paperEl.on("dblclick", (e) => {
    const { x, y } = getMouseCoords(e);
    graph.addNode(x, y);
});

paperEl.on("mouseup", (e) => paperEl.off("mousemove"));

document.addEventListener("keyup", (e) => {
    switch (e.key) {
        case "Backspace":
            graph.deleteSelected();
            break;
    }
});
