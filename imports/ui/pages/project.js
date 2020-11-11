import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker';
import { Session } from 'meteor/session'
import Split from 'split.js';
import '../components/dominoframe.js';
import '../components/tagframe.js';
import '../components/streamframe.js'
import '../components/logframe.js'
import '../components/settingsframe.js'
import './project.html';

/*
    This page is the layout of an opened project.
    It only contains the UI and logic for splitting the page in 1 - 3 views that can be dynamically selected.
    Specific views (e.g. video view) are in ../components
*/

Template.project.onCreated(function () {
    const project = Template.currentData();
    project.showViewOptions = true;
    document.title = project.name;
    Session.set("projectId", project._id);
});

Template.project.onRendered(function () {
    // todo: this is an ugly hack to set the "view count" dropdown to its actual value
    // it is done here because it dropdown only renders in project pages
    // which means it can not be reliably done in the layout onRendered
    document.getElementById("selectedViewCount").selectedIndex = Session.get("views.count") - 1;

    Tracker.autorun(function () {
        // (Re)Create gutter on view count change
        const viewCount = Session.get("views.count");
        if (this["gutter"] !== undefined)
            gutter.destroy();
        gutter = createSplitter(viewCount);
    });
});

Template.project.helpers({
    'getTemplate': function (index) {
        if (Session.get("views.count") <= index)
            return "none";
        return Session.get("views.active")[index];
    }
});

function createSplitter(viewCount) {
    const viewArray = [];
    for (let i = 1; i < 4; i++) {
        if (i <= viewCount) {
            viewArray.push(`#view-${i}`);
        } 
    }

    return Split(viewArray, {
        gutterSize: 5,
        direction: 'horizontal',
        minSize: 200,

        onDragEnd: function () {
            Session.set('views.resize', new Date()); // allow child templates to handle resizes
        }
    });
}