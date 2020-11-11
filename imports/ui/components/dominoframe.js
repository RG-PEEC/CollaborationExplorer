import '../components/domino.js';
import './dominoframe.html';
import { Domino } from '../../api/domino.js';
import { Tracker } from 'meteor/tracker';
import { getFormattedTimeFromSeconds, getSecondsFromFormattedTime } from '../utils/timeFormatting.js';
import { DominoRenderer, getDotPositionFromEvent } from '../utils/dominoRenderer.js';
import { getClientVar } from '../utils/clientVar.js';
import { Projects, setProjectLastEdited } from '../../api/projects.js';
import { getCouplingTypes, getCouplingType } from '../../api/couplingTypes.js';
import { getStreamPos } from '../utils/streamPos.js';
import { Session } from 'meteor/session';
import { Template } from 'meteor/templating';

let selectedDominos = [];
let selectedDots = [];
let highlightedDots = -1;
let insertDomino = new Domino(['DISC', 'DISC', 'DP', 'DP'], [], [0, 1, 2, 3]);
let dominoRenderer = new DominoRenderer(200);

Template.dominoframe.onRendered(function () {
    const insertDominoElement = $("#insertDomino");
    insertDominoElement.attr("width", insertDominoElement.width());
    insertDominoElement.attr("height", insertDominoElement.height());
    dominoRenderer = new DominoRenderer(insertDominoElement.width());

    renderInsertDomino();
    validateInsertDominoData();

    Tracker.autorun(updateStreamTimePlaceholders);
});

Template.dominoframe.helpers({
    insertDomino,
    couplingTypes: function () {
        return getCouplingTypes(Template.currentData()._id);
    },
    reactiveDominos: function () {
        return Projects.findOne({ _id: Template.currentData()._id }, { fields: { dominos: 1 } }).dominos.sort(function (a, b) {
            if (!a.startSec)
                return -1;
            return a.startSec > b.startSec ? 1 : a.startSec < b.startSec ? -1 : 0;
        });
    }
});

Template.dominoframe.events({
    'contextmenu .domino'(event) {
        event.preventDefault();

        const dominoFrame = $("#dominoframe")[0];
        const dominoFramePos = dominoFrame.getBoundingClientRect();
        const contextMenu = $("#dominocontext");

        contextMenu.attr('data-domino-id', $(event.currentTarget).attr("data-domino-id"));
        contextMenu.css('left', event.pageX - dominoFramePos.x);
        contextMenu.css('top', event.pageY - dominoFramePos.y);
        contextMenu.toggle();
    },
    'click #ctx-delete'(event) {
        const contextMenu = $("#dominocontext");
        const dominoToDelete = contextMenu.attr('data-domino-id');
        contextMenu.toggle();

        if (dominoToDelete) {
            Projects.update({ _id: Template.currentData()._id }, { $pull: { dominos: { id: dominoToDelete } } });
            setProjectLastEdited(Template.currentData()._id);
        }
    },
    'change #selectedCoupling'(event) {
        const couplingDropdown = event.target;
        const selectedValue = couplingDropdown.options[couplingDropdown.selectedIndex].text;

        for (const person of selectedDots) {
            insertDomino.personToCoupling[person] = selectedValue;
        }

        renderInsertDomino(); // rerender with new coupling
    },
    'mouseleave .insert-domino'(event) {
        if (highlightedDots >= 0) { // reset hover effect
            highlightedDots = -1;
            renderInsertDomino();
        }
    },
    'mousemove .insert-domino'(event) {
        const hoveredDot = getDotPositionFromEvent(event, dominoRenderer);
        if (highlightedDots !== hoveredDot) {
            highlightedDots = hoveredDot;
            renderInsertDomino(); // rerender with hover effect
        }
    },
    'click .insert-domino'(event) {
        const clickedDot = getDotPositionFromEvent(event, dominoRenderer);

        if (clickedDot === -1) {
            selectedDots = []; // click on empty space -> reset selection
        } else if (selectedDots.includes(clickedDot)) {
            selectedDots.splice(selectedDots.indexOf(clickedDot), 1); // click on selected -> remove selection
        } else {
            // (Un)comment this to enable copy-paste behaviour on dot selection
            if (selectedDots.length > 0) {
                insertDomino.personToCoupling[clickedDot] = insertDomino.personToCoupling[selectedDots[0]]; // c&p selection from other selected
            }
            else // */
            {
                const couplingDropdown = $("#selectedCoupling")[0];
                for (let i = 0; i < couplingDropdown.options.length; i++) {
                    if (couplingDropdown.options[i].text === insertDomino.personToCoupling[clickedDot])
                        couplingDropdown.selectedIndex = i; // select coupling of newly selected on dropdown
                }
            }
            selectedDots.push(clickedDot);
        }

        validateInsertDominoData();
        renderInsertDomino(); // rerender with selection effect
    },
    'click #resetDominoButton'(event) {
        insertDomino.personToCoupling = {};
        renderInsertDomino(); // rerender reset domino
    },
    'click #insertDominoButton'(event) {
        const start = getCurrentInsertTime();
        const duration = getCurrentInsertDuration();

        const newDomino = JSON.parse(JSON.stringify(insertDomino));
        newDomino.startSec = start;
        newDomino.durationSec = duration;
        insertDomino.refreshId();

        Projects.update(this._id, { $push: { dominos: newDomino } });
        setProjectLastEdited(this._id);
    },
    'click .domino'(event) {
        event.preventDefault();

        const domino = event.currentTarget;
        const dominoIndex = event.currentTarget.attributes['data-domino-id'];
        if (!dominoIndex) // clicked some other domino such as the insert domino or the aggregate visualization
            return;

        const dominoId = event.currentTarget.attributes['data-domino-id'].value;
        const isSelected = domino.classList.toggle('domino-selected');

        if (isSelected) {
            selectedDominos.push(dominoId);
        } else {
            selectedDominos.splice(selectedDominos.indexOf(dominoId), 1);
        }

        updateAggregatedDomino();
    },
    'input #startSec'(event) {
        validateInsertDominoData();
        updateStreamTimePlaceholders();
    },
    'input #durationSec'(event) {
        validateInsertDominoData();
        updateStreamTimePlaceholders();
    }
});

function getCurrentInsertTime() {
    const startSecInput = $("#startSec");
    let formattedStart = startSecInput.val();

    if (formattedStart === "")
        formattedStart = startSecInput.attr("placeholder");

    return getSecondsFromFormattedTime(formattedStart);
}

function getCurrentInsertDuration() {
    const durationSecInput = $("#durationSec");
    let formattedDuration = durationSecInput.val();

    if (formattedDuration === "")
        formattedDuration = durationSecInput.attr("placeholder");

    return getSecondsFromFormattedTime(formattedDuration);
}

function validateInsertDominoData() {
    const streamEnd = getStreamPos() + Number(getClientVar("streamframe.duration" + Session.get("projectId")));
    const insertTime = getCurrentInsertTime();
    const insertDuration = getCurrentInsertDuration();

    const couplingCounts = {};
    for (const coupling of insertDomino.personToCoupling) {
        couplingCounts[coupling] = couplingCounts[coupling] ? couplingCounts[coupling] + 1 : 1;
    }

    const projectId = Session.get("projectId");
    for (const coupling in couplingCounts) {
        if (getCouplingType(projectId, coupling).multipleOnly && couplingCounts[coupling] <= 1) {
            setInsertAlert(false, `Invalid domino configuration: Coupling ${coupling} needs to be applied to multiple people (Settings: Connect).`)
            return;
        }
    }

    if (insertDomino.personToCoupling.length === 0) {
        setInsertAlert(false, "Invalid domino configuration: No couplings.");
    }

    if (streamEnd && streamEnd < insertTime + insertDuration) {
        setInsertAlert(false, "Invalid domino time: After video.")
    } else if (insertTime && insertTime < 0) {
        setInsertAlert(false, "Invalid domino time: Before video.")
    } else {
        setInsertAlert(true, "Domino is valid.");
    }
}

function setInsertAlert(success, message) {
    const alert = $("#dominoAlert");
    const alertText = $("#dominoAlertText");

    alert.addClass(success ? "alert-success" : "alert-danger");
    alert.removeClass(success ? "alert-danger" : "alert-success");
    alertText.text(message);
}

function updateStreamTimePlaceholders() {
    let streamPos = getStreamPos();

    $("#startSec").attr("placeholder", getFormattedTimeFromSeconds(streamPos));
    const formattedStartSec = $("#startSec").val();
    let startSec = formattedStartSec === "" ? streamPos : getSecondsFromFormattedTime(formattedStartSec);
    if (isNaN(startSec))
        startSec = streamPos;
    const currentDurationSec = Math.max(streamPos - startSec, 0);
    $("#durationSec").attr("placeholder", getFormattedTimeFromSeconds(currentDurationSec));
}

function updateAggregatedDomino() {
    // todo: Not implemented
}

function renderInsertDomino() {
    const canvas = $("#insertDomino")[0];
    const ctx = canvas.getContext("2d");

    dominoRenderer.renderBackground(ctx);
    dominoRenderer.renderDominoRoomLines(ctx, insertDomino);
    dominoRenderer.renderDominoCouplings(ctx, insertDomino, Template.currentData().couplingTypes);

    for (const person of [0, 1, 2, 3]) {
        if (selectedDots.includes(person) && highlightedDots === person)
            ctx.fillStyle = '#dddd55';
        else if (selectedDots.includes(person))
            ctx.fillStyle = '#eeee22';
        else if (highlightedDots === person)
            ctx.fillStyle = '#cccc88';
        else
            ctx.fillStyle = '#000000';

        dominoRenderer.renderDot(ctx, person, dominoRenderer.dotRadius);
    }
}
