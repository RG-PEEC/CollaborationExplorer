import { Template } from 'meteor/templating';
import './domino.html';
import { DominoRenderer } from '../utils/dominoRenderer';
import { getFormattedTimeFromSeconds } from '../utils/timeFormatting';
import { getStreamPos } from '../utils/streamPos';

const size = 150;

Template.domino.helpers({
    size,
    refreshCanvas: function() {
        /*
            Normally you'd be able to re-render the domino by running Tracker.autorun in onRendered and calling Template.currentData
            inside the autorun handler. For some reason, that is buggy in the current version. This helper function will be run when the 
            template data changes, so I just call renderCanvas() from in here. Bit of a hack - but not much I can do.
        */
        if (Template.instance().hasRendered) { // The first render has to happen from onRendered
            renderCanvas();
        }
        return "";
    },
    timeText: function () {
        return getFormattedTimeFromSeconds(this.startSec) + " - " + getFormattedTimeFromSeconds(this.startSec + this.durationSec);
    },
    getProgressStyle: function () {
        const streamPos = getStreamPos();
        const percent = Math.max(0, Math.min((streamPos - this.startSec) / Math.max(this.durationSec, 0.1), 1) * 100);
        return `background: linear-gradient(to right, rgba(125, 250, 0, 0.5) 0%, rgba(125, 250, 0, 0.5) ${percent}%, rgb(211, 211, 211) ${percent}%, rgb(211, 211, 211) 100%);`;
    },
});

Template.domino.onRendered(function () {
    renderCanvas();
    Template.instance().hasRendered = true;
});

function renderCanvas() {
    const data = Template.currentData();
    const canvas = Template.instance().$(".domino-canvas")[0];
    const ctx = canvas.getContext('2d');

    const renderer = new DominoRenderer(size); // Can not do $(canvas).width() sadly

    renderer.render(ctx, data, Template.parentData().couplingTypes);
}

