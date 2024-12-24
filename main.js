"use strict"
let xSlider, ySlider, thresholdSlider, incrementSlider, dotCheckbox, pathCheckbox
let field, rows, cols
let segments, internalPaths, externalPaths, pathJoins
let rez = 10
let buffer = 4 //NOT less than 2
class Point {
    constructor(x, y) {
        this.x = x
        this.y = y
    }
    distanceFrom(q) {
        return Math.sqrt((this.x - q.x) ** 2 + (this.y - q.y) ** 2)
    }
}
class Path {
    constructor(points) {
        this.points = points
        this.setBoundingBoxAndCentroid()
    }
    setBoundingBoxAndCentroid() {
        this.minX = Infinity
        this.minY = Infinity
        this.maxX = -Infinity
        this.maxY = -Infinity

        for (let point of this.points) {
            if (point.x < this.minX) this.minX = point.x
            if (point.y < this.minY) this.minY = point.y
            if (point.x > this.maxX) this.maxX = point.x
            if (point.y > this.maxY) this.maxY = point.y
        }
        this.centroid = new Point((this.minX + this.maxX) / 2, (this.minY + this.maxY) / 2)
    }
}
class Joiner {
    constructor(p1, centre, p2) {
        this.start = p1
        this.centre = centre
        this.end = p2
    }
}
//*--------------------------->  SETUP
function setup() {
    rectMode(CENTER)
    createCanvas(800, 600)
    rows = 1 + height / rez
    cols = 1 + width / rez
    field = new Array(rows * cols)
    segments = []
    internalPaths = []
    externalPaths = []
    pathJoins = []

    //Create the UI elements
    let container = createDiv().position(width, 5).size(250, height).addClass("wn")

    let x = 10
    let y = 10
    createP("Threshold").position(x, y).parent(container).addClass("label")
    thresholdSlider = createSlider(0.4, 0.6, 0.5, 0.01)
        .position(x, y + 16)
        .parent(container)

    y += 40
    createP("X Offset").position(x, y).parent(container).addClass("label")
    ySlider = createSlider(0, 100, 0, 0.1)
        .position(x, y + 16)
        .parent(container)

    y += 40
    createP("Y Offset").position(x, y).parent(container).addClass("label")
    xSlider = createSlider(0, 100, 0, 0.1)
        .position(x, y + 16)
        .parent(container)

    y += 40
    createP("Noise Delta").position(x, y).parent(container).addClass("label")
    incrementSlider = createSlider(0, 1, 0.3, 0.01)
        .position(x, y + 16)
        .parent(container)

    y += 60

    dotCheckbox = createCheckbox("Draw Field Dots", false).position(x, y).parent(container)
    y += 20

    pathCheckbox = createCheckbox("Draw Paths", true).position(x, y).parent(container)

    y += 80
    createButton("Update").position(x, y).mousePressed(redraw).addClass("stdbutton").parent(container)
}
function update() {
    //clear paths
    while (externalPaths.length) {
        let path = externalPaths.shift()
        while (path.length) path.shift()
    }
    while (internalPaths.length) {
        let path = internalPaths.shift()
        while (path.length) path.shift()
    }
    //update all from noise field
    updateNoiseField()
    addNoiseFieldBorder()
    getPathSegments()
    createPaths()
    //have base - now join paths, clean up and refigure the paths
    getPathJoins()
    joinPaths()
    fixDiagonals()
    addNoiseFieldBorder()
    getPathSegments()
    createPaths()
    //console.log(externalPaths)
}
//----------------------------DRAW
function draw() {
    update()
    //-----draw
    background(51)
    //Draw the Paths
    //console.log(externalPaths)

    if (pathCheckbox.checked()) {
        for (let path of externalPaths) {
            stroke("blue")
            strokeWeight(3)
            fill("lightblue")
            beginShape()
            for (let i = 0; i < path.points.length; i++) {
                vertex(path.points[i].x, path.points[i].y)
            }
            endShape()
        }
        fill(51)
        for (let path of internalPaths) {
            beginShape()
            for (let i = 0; i < path.points.length; i++) vertex(path.points[i].x, path.points[i].y)
            endShape()
        }
    }

    if (dotCheckbox.checked()) {
        strokeWeight(1)
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let index = y * cols + x
                fill("yellow")
                if (field[index]) fill("blue")
                noStroke()
                circle(x * rez, y * rez, 5)
            }
        }
    }

    noLoop()
}
//--------------------Noise Field
function updateNoiseField() {
    let xoff = xSlider.value()
    for (let y = 0; y < rows; y++) {
        let yoff = ySlider.value()
        xoff += incrementSlider.value()
        for (let x = 0; x < cols; x++) {
            let index = y * cols + x
            field[index] = noise(xoff, yoff) > thresholdSlider.value() ? 1 : 0
            yoff += incrementSlider.value()
        }
    }
}
function addNoiseFieldBorder() {
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (x < buffer || x >= cols - buffer || y < buffer || y >= rows - buffer) {
                field[getIndex(x, y)] = 0
            }
        }
    }
}
function getIndex(x, y) {
    return y * cols + x
}
//---------------------
function getPathSegments() {
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            let index = getIndex(x, y)
            if (!field[index]) continue

            let displayX = x * rez
            let displayY = y * rez
            let d = rez / 2

            //LEFT SIDE
            if (!field[getIndex(x - 1, y)]) {
                let p = new Point(displayX - d, displayY + d)
                let q = new Point(displayX - d, displayY - d)
                segments.push({
                    p: p,
                    q: q,
                })
            }
            //TOP
            if (!field[getIndex(x, y - 1)]) {
                let p = new Point(displayX - d, displayY - d)
                let q = new Point(displayX + d, displayY - d)
                segments.push({
                    p: p,
                    q: q,
                })
            }
            //RIGHT SIDE
            if (!field[getIndex(x + 1, y)]) {
                let p = new Point(displayX + d, displayY - d)
                let q = new Point(displayX + d, displayY + d)
                segments.push({
                    p: p,
                    q: q,
                })
            }
            //BOTTOM
            if (!field[getIndex(x, y + 1)]) {
                let p = new Point(displayX + d, displayY + d)
                let q = new Point(displayX - d, displayY + d)
                segments.push({
                    p: p,
                    q: q,
                })
            }
        }
    }
}
function createPaths() {
    clearPaths()
    while (segments.length) {
        //create a new path
        let pathPoints = []
        //get first path segment
        let segment = segments.shift()
        //copy the points into the path
        pathPoints.push(segment.p)
        pathPoints.push(segment.q)

        //follow the path until it ends
        let bPathFinding = true
        while (bPathFinding) {
            let testPoint = pathPoints[pathPoints.length - 1]
            let foundSegmentIndex = -1
            for (let i = 0; i < segments.length; i++) {
                //console.log(segments[i], testPoint)
                if (segments[i].p.x == testPoint.x && segments[i].p.y == testPoint.y) {
                    foundSegmentIndex = i
                    break
                }
            }
            if (foundSegmentIndex > -1) {
                //remove the element from the array
                let segment = segments.splice(foundSegmentIndex, 1)[0]
                pathPoints.push(segment.q)
            } else {
                bPathFinding = false
            }
        }

        // externalPaths.push(newPath)

        if (isExternalPath(pathPoints)) externalPaths.push(new Path(pathPoints))
        else internalPaths.push(new Path(pathPoints))
    }
}
function isExternalPath(path) {
    let leftmostX = Infinity
    let bestIndex = null

    for (let i = 0; i < path.length - 1; i++) {
        let p = path[i]
        let q = path[i + 1]

        if (p.x == q.x) {
            if (p.x < leftmostX) {
                leftmostX = p.x
                bestIndex = i
            }
        }
    }

    //we have the index of the left most point & segment
    let p = path[bestIndex]
    let q = path[bestIndex + 1]

    //get the index into the field array
    let x = (p.x + rez / 2) / rez
    let y = (p.y + q.y) / 2 / rez

    if (field[getIndex(x, y)]) return true
    else return false
}
function clearPaths() {
    while (externalPaths.length) {
        let path = externalPaths.shift()
        while (path.length) path.shift()
    }
    while (internalPaths.length) {
        let path = internalPaths.shift()
        while (path.length) path.shift()
    }
}
//-------------Path joining functions
function getPathJoins() {
    //put all the path indices in a list (leave out zero since checking that one)
    let pathsToProcess = []
    for (let i = 0; i < externalPaths.length; i++) {
        pathsToProcess.push(i)
    }

    let currentPath = externalPaths[pathsToProcess.shift()]

    //do one to start
    while (pathsToProcess.length) {
        //console.log(pathsToProcess)
        //test the distance from the current
        let closest = Infinity
        let closestPathIndex = -1
        let p2pIndex = -1
        for (let i = 0; i < pathsToProcess.length; i++) {
            let testPath = externalPaths[pathsToProcess[i]]
            let dist = testPath.centroid.distanceFrom(currentPath.centroid)
            if (dist < closest) {
                closestPathIndex = pathsToProcess[i]
                p2pIndex = i
                closest = dist
            }
        }
        //we now have the closest path
        //remove it from the pathsToProcess array
        pathsToProcess.splice(p2pIndex, 1)
        let closestPath = externalPaths[closestPathIndex]

        //determine midpoint of the two centroids
        let centre = new Point(
            (currentPath.centroid.x + closestPath.centroid.x) / 2,
            (currentPath.centroid.y + closestPath.centroid.y) / 2
        )
        //now determine the closest point to the centre for each path

        let closestIndex = -1
        closest = Infinity
        for (let i = 0; i < currentPath.points.length; i++) {
            let dist = centre.distanceFrom(currentPath.points[i])
            if (dist < closest) {
                closestIndex = i
                closest = dist
            }
        }
        let start = currentPath.points[closestIndex]

        closestIndex = -1
        closest = Infinity
        for (let i = 0; i < closestPath.points.length; i++) {
            let dist = centre.distanceFrom(closestPath.points[i])
            if (dist < closest) {
                closestIndex = i
                closest = dist
            }
        }
        let end = closestPath.points[closestIndex]

        pathJoins.push(new Joiner(start, centre, end))
        currentPath = closestPath
    }
}
function joinPaths() {
    while (pathJoins.length) {
        let join = pathJoins.shift()

        let start = new Point(ceil(join.start.x / rez), ceil(join.start.y / rez))
        let end = new Point(ceil(join.end.x / rez), ceil(join.end.y / rez))

        let dx = end.x - start.x
        let dy = end.y - start.y

        let curX = start.x
        let curY = start.y

        //ensure start and end are both walls
        field[getIndex(start.x, start.y)] = 1
        field[getIndex(end.x, end.y)] = 1

        //console.log(start.x, start.y, end.x, end.y, dx, dy)

        while (curX != end.x || curY != end.y) {
            //console.log("Working", curX, curY, end.x, end.y, dx, dy)
            // console.log(dx, dy)
            let total = Math.abs(dx) + Math.abs(dy)
            let percentX = Math.abs(dx) / total

            if (Math.random() < percentX) {
                curX += Math.sign(dx)
                dx -= Math.sign(dx)
            } else {
                curY += Math.sign(dy)
                dy -= Math.sign(dy)
            }
            field[getIndex(curX, curY)] = 1
        }
    }
}
function fixDiagonals() {
    for (let y = buffer; y < rows - buffer; y++) {
        for (let x = buffer; x < cols - buffer; x++) {
            let tl = field[getIndex(x, y)]
            let tr = field[getIndex(x + 1, y)]
            let bl = field[getIndex(x, y + 1)]
            let br = field[getIndex(x + 1, y + 1)]
            let takeAction = false

            if (tl && br && !tr && !bl) takeAction = true
            if (!tl && !br && tr && bl) takeAction = true
            if (takeAction) {
                field[getIndex(x, y)] = 1
                field[getIndex(x + 1, y)] = 1
                field[getIndex(x, y + 1)] = 1
                field[getIndex(x + 1, y + 1)] = 1
            }
        }
    }
}
