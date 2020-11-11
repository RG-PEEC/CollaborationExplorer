import './logframe.html';
import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker'
import { Projects } from '../../api/projects';
import Clusterize from 'clusterize.js';
import { getClientVar } from '../utils/clientVar';
import { Session } from 'meteor/session';

let highlightedElements = $([]);
let clusterize = {};
let projectId = null;
let scrollOperationAttempts = 0;

Template.logframe.helpers({
    logLines: function () {
        return Projects.findOne({ _id: Template.currentData()._id }, { fields: { logLines: 1 } }).logLines;
    },
    logLineHeader: function () {
        return Projects.findOne({ _id: Template.currentData()._id }, { fields: { logColumns: 1 } }).logColumns;
    },
    areLogsLoaded: function () {
        return Projects.findOne({ _id: Template.currentData()._id }, { fields: { logLines: 1 } }).logLines.length > 0;
    }
});

Template.logframe.onRendered(function () {
    if ($("#scrollArea").length === 0)
        return; // No log file loaded

    clusterize = new Clusterize({
        scrollId: "scrollArea",
        contentId: "logTableBody",
        callbacks: {
            clusterChanged: clusterChanged
        }
    });
});

Template.logframe.onCreated(function () {
    projectId = Template.currentData()._id;
    Tracker.autorun(function () {
        const streamPos = Number(getClientVar("streamframe.pos" + Session.get("projectId")));
        if (streamPos) {
            scrollTo(streamPos, 5);
        }
    });
});

function getLineIndexByStreamPos(streamPos) {
    const streamPosMs = streamPos * 1000;
    const logLines = Projects.findOne({ _id: projectId }, { fields: { logLines: 1 } }).logLines
    return binarySearch(logLines, l => streamPosMs <= l.timestamp);
}

function binarySearch(array, pred) {
    let lo = -1, hi = array.length;
    while (1 + lo < hi) {
        const mi = lo + ((hi - lo) >> 1);
        if (pred(array[mi])) {
            hi = mi;
        } else {
            lo = mi;
        }
    }
    return hi;
}

function scrollToCurrentTime() {
    const streamPos = Number(getClientVar("streamframe.pos" + Session.get("projectId")));
    if (streamPos) {
        scrollTo(streamPos);
    }
}

function scrollTo(streamPos, attempts) {
    if (attempts)
        scrollOperationAttempts = attempts;

    const visibleChildren = $("#logTableBody").children();
    const hasClusterAbove = !visibleChildren.first().attr("data-timestamp");
    const hasClusterBelow = !visibleChildren.last().attr("data-timestamp");

    let clusterStartChildIndex = 0;
    let clusterEndChildIndex = visibleChildren.length - 1;

    if (clusterEndChildIndex <= 0) // view not yet populated, no reason to scroll
        return;

    while (clusterStartChildIndex < visibleChildren.length - 1 && !$(visibleChildren[clusterStartChildIndex]).attr("data-timestamp"))
        clusterStartChildIndex++;
    while (clusterEndChildIndex > 0 && !$(visibleChildren[clusterEndChildIndex]).attr("data-timestamp"))
        clusterEndChildIndex--;


    const clusterStartTime = $(visibleChildren[clusterStartChildIndex]).attr("data-timestamp") / 1000;
    const clusterEndTime = $(visibleChildren[clusterEndChildIndex]).attr("data-timestamp") / 1000;

    if (clusterStartTime >= streamPos && hasClusterAbove || clusterEndTime <= streamPos && hasClusterBelow) {
        // Element to scroll to is not in cluster
        if (--scrollOperationAttempts <= 0)
            return; // We somehow guessed the position multiple times and it's not even in our cluster yet. abort.

        // Scroll to a guessed position, which forces the cluster to shift. 
        // The clusterChanged() callback will retry an exact scroll later.
        const centerIndex = getLineIndexByStreamPos(streamPos);
        $('#scrollArea').scrollTop(centerIndex * clusterize.options.item_height);
    } else {
        scrollOperationAttempts = 0; // No need to continue guessing, it's in our cluster.
        scrollToElementInCurrentCluster(streamPos);
    }
}

// Scrolls to an element that is not being virtualized
function scrollToElementInCurrentCluster(streamPos) {
    const highlightSize = 10;
    const highlightStart = streamPos - highlightSize;
    const highlightEnd = streamPos + highlightSize;
    const visibleChildren = $("#logTableBody").children();

    const elementsToHighlight = visibleChildren.filter(function () {
        const timestamp = $(this).attr("data-timestamp") / 1000;
        return highlightStart <= timestamp && timestamp <= highlightEnd;
    });

    highlightedElements.remove(elementsToHighlight).css("background", "");
    elementsToHighlight.each(function (i, el) {
        const elementTimeDiff = Math.abs($(el).attr("data-timestamp") / 1000 - streamPos);
        const color = Math.min(255, Math.max(0, (highlightSize - elementTimeDiff) / highlightSize));
        $(el).css("background", "rgba(32, 256, 0, " + color * 0.60 + ")");
    });

    /*
        .scrollIntoView is used to scroll to the relevant log lines.
        In Firefox, .scrollIntoView jitters when called on an element that is already
        perfectly in the view (moves one pixel). To combat this, .scrollIntoView is only
        called if the highlighted elements changed. It does so by comparing length, the first and last
        elements that are highlighted now to the ones highlighted previously. This works because
        it's safe to assume that the elements are sorted by time - which means that if the first 
        elements and the last elements are identical, the highlighted time window is the same.
    */
    if (elementsToHighlight.length > 0 && (
        elementsToHighlight.length !== highlightedElements.length ||
        elementsToHighlight[0] !== highlightedElements[0] ||
        elementsToHighlight[elementsToHighlight.length - 1] !== highlightedElements[highlightedElements.length - 1])
    ) {
        elementsToHighlight[Math.floor(elementsToHighlight.length / 2)].scrollIntoView({ behavior: "smooth", block: "center" });
    }

    highlightedElements = elementsToHighlight;
}

function clusterChanged() {
    if (scrollOperationAttempts > 0) {
        // We guessed the position of the item in the cluster earlier, time to scroll to the 
        // exact position if available.
        scrollToCurrentTime();
    }
}