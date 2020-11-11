import { getCouplingTypeColor, getCouplingType, CouplingType } from '../../api/couplingTypes';

export class DominoRenderer {
    constructor(size) {
        this.size = size;

        this.dotRadius = size / 8;
        this.couplingLineWidth = size / 20;
        this.sizeHalf = size / 2;
    }

    render(ctx, domino, couplingTypes, dotColor = '#000000', roomLineColor = '#777777', roomLineWidth = 2) {
        this.renderBackground(ctx);
        this.renderDominoRoomLines(ctx, domino, roomLineWidth, roomLineColor);
        this.renderDominoCouplings(ctx, domino, couplingTypes);
        this.renderDominoPersonDots(ctx, domino, dotColor);
    }

    renderBackground(ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, this.size, this.size);
    }

    renderDominoRoomLines(ctx, domino, roomLineWidth = 2, roomLineColor = '#777777') {
        const p2r = domino.personToRoom;

        ctx.strokeStyle = roomLineColor;
        if (p2r[0] != p2r[1]) {
            drawLine(ctx, this.sizeHalf, 0, this.sizeHalf, this.sizeHalf, roomLineWidth);
        }
        if (p2r[0] != p2r[2]) {
            drawLine(ctx, 0, this.sizeHalf, this.sizeHalf, this.sizeHalf, roomLineWidth);
        }
        if (p2r[3] != p2r[1]) {
            drawLine(ctx, this.sizeHalf, this.sizeHalf, this.size, this.sizeHalf, roomLineWidth);
        }
        if (p2r[3] != p2r[2]) {
            drawLine(ctx, this.sizeHalf, this.sizeHalf, this.sizeHalf, this.size, roomLineWidth);
        }
    }

    renderDominoCouplings(ctx, domino, couplingTypes) {
        const p2c = domino.personToCoupling;
        // Check each person with every OTHER person, and if they have the same coupling, draw a line
        iteratePersonIndexTouples((person1, person2) => {
            if (p2c[person1] === undefined || p2c[person1] !== p2c[person2])
                return;

            let couplingType = couplingTypes.find(t => t.name == p2c[person1]);
            if (!couplingType)
                couplingType = getFallbackCoupling(p2c[person1]);

            if (couplingType.noRendering || !couplingType.multipleOnly)
                return;

            this.renderDominoCouplingLine(ctx, person1, person2, couplingType.color);
        });

        // render ring for some single couplings, e.g. DP
        for (const person of domino.activePersons) {
            if (p2c[person] === undefined)
                continue;

            let couplingType = couplingTypes.find(t => t.name == p2c[person]);
            if (!couplingType)
                couplingType = getFallbackCoupling(p2c[person]);

            if (!couplingType.multipleOnly && !couplingType.noRendering) {
                ctx.fillStyle = couplingType.color;
                this.renderDot(ctx, person, this.dotRadius + this.couplingLineWidth);
            }
        }
    }

    renderDominoCouplingLine(ctx, person1, person2, color) {
        const start = this.getDotPosition(person1);
        const end = this.getDotPosition(person2);

        ctx.strokeStyle = color;
        drawLine(ctx, start.x, start.y, end.x, end.y, this.couplingLineWidth);
    }

    renderDominoPersonDots(ctx, domino, dotColor = '#000000') {
        ctx.fillStyle = dotColor;
        // debugger;
        for (let i = 0; i < 4; i++) {
            if (domino.activePersons.includes(i))
                this.renderDot(ctx, i, this.dotRadius);
        }
    }

    renderDot(ctx, index, radius) {
        const dot = this.getDotPosition(index);
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius, 0, 2 * Math.PI, false);
        ctx.fill();
    }

    getDotPosition(index) {
        return {
            x: (index % 2) * this.size / 2 + this.size / 4,
            y: Math.floor(index / 2) * this.size / 2 + this.size / 4
        }
    }

    getDotIntersection(x, y) {
        for (let i = 0; i < 4; i++) {
            const dotPos = this.getDotPosition(i);
            const diffX = dotPos.x - x;
            const diffY = dotPos.y - y;
            const diffSquared = diffX * diffX + diffY * diffY;

            if (this.dotRadius * this.dotRadius > diffSquared)
                return i;
        }
        return -1;
    }

    getConnectionIntersections(x, y, extraHitboxWidith = 0) {
        const intersectingConnections = [];

        iteratePersonIndexTouples((person1, person2) => {
            const person1Pos = this.getDotPosition(person1);
            const person2Pos = this.getDotPosition(person2);

            if (isOnLine(x, y, person1Pos.x, person1Pos.y, person2Pos.x, person2Pos.y, this.lineWidth + extraHitboxWidith))
                intersectingConnections.push([person1, person2]);
        });
        return intersectingConnections;
    }
}

export function getDotPositionFromEvent(event, renderer) {
    const elementPos = event.currentTarget.getBoundingClientRect();
    const mouseY = event.pageY - elementPos.top;
    const mouseX = event.pageX - elementPos.left;

    return renderer.getDotIntersection(mouseX, mouseY);
}

function isOnLine(x, y, lineStartX, lineStartY, lineEndX, lineEndY, lineWidth) {
    const lineNormX = lineEndX - lineStartX;
    const lineNormY = lineEndY - lineStartY;
    const xNorm = x - lineStartX;
    const yNorm = y - lineStartY;

    const lineRot = Math.atan2(lineNormY, lineNormX);
    const xNormRot = Math.cos(-lineRot) * xNorm - Math.sin(-lineRot) * yNorm;
    const yNormRot = Math.sin(-lineRot) * xNorm - Math.cos(-lineRot) * yNorm;
    if (xNormRot < 0 || xNormRot * xNormRot > lineNormX * lineNormX + lineNormY * lineNormY)
        return false; // point is before start or after end of line

    return Math.abs(yNormRot) < lineWidth;
}

function iteratePersonIndexTouples(action) {
    // Check each person with every OTHER person exactly ONCE
    for (let person1 = 0; person1 < 3; person1++) {
        for (let person2 = person1 + 1; person2 < 4; person2++) {
            action(person1, person2);
        }
    }
}

function drawLine(ctx, fromX, fromY, toX, toY, width) {
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
}

function getFallbackCoupling(name) {
    return new CouplingType(name, '#999999'); // Fallback rendering config for deleted coupling type
}