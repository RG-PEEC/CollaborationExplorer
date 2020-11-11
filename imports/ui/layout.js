import { Session } from 'meteor/session';
import './layout.html';

const viewConfiguration = { // view count to view selection UI configuration
    1: [
        { Name: "View" }
    ],
    2: [
        { Name: "Left View" },
        { Name: "Right View" },
    ],
    3: [
        { Name: "Left View" },
        { Name: "Middle View" },
        { Name: "Right View" },
    ],
};

const availableViews = [
    { InternalName: "streamframe", DisplayName: "Video" },
    { InternalName: "tagframe", DisplayName: "Tags" },
    { InternalName: "dominoframe", DisplayName: "Dominos" },
    { InternalName: "logframe", DisplayName: "Logfile" },
    { InternalName: "settingsframe", DisplayName: "Project Configuration" },
];

Template.layout.onRendered(function () {
    let initialViewCount = localStorage.getItem("user.initialViewCount");
    let initialViews = JSON.parse(localStorage.getItem("user.initialViews"));
    if (!initialViewCount)
        initialViewCount = 2;
    if (!initialViews)
        initialViews = ["tagframe", "settingsframe", "streamframe"];

    Session.set("views.count", initialViewCount);
    Session.set("views.active", initialViews);
});

Template.layout.helpers({
    availableViews,
    currentViewConfiguration: function () {
        const viewCount = Session.get("views.count");
        return viewConfiguration[viewCount];
    },
    activeView: function (index) {
        const internalName = Session.get("views.active")[index];
        if (internalName === undefined || internalName === "none")
            return "None";
        return availableViews.find(view => view.InternalName === internalName).DisplayName;
    }
});

Template.layout.events({
    'change #selectedViewCount'(event) {
        Session.set("views.count", event.target.value);
        localStorage.setItem("user.initialViewCount", event.target.value);
    },
    'click .view-selection'(event) {
        const viewIndex = Number($(event.target.parentNode).attr("data-index"));
        const viewName = $(event.target).attr("data-template");
        let activeViews = Session.get("views.active");
        if (!activeViews)
            activeViews = [];

        const existing = activeViews.indexOf(viewName);
        if (existing >= 0)
            activeViews[existing] = "none";

        activeViews[viewIndex] = viewName;

        // Ensure that there is only one streamframe per tab
        // Streamframe would need a rework to be able to exist multiple times without weird behaviour
        // However since that is never needed, I just ensure that only one exists at a time
        // Other streamframes IN THE SAME TAB are just set to "none" for now

        Session.set("views.active", activeViews);
        localStorage.setItem("user.initialViews", JSON.stringify(activeViews));
    }
});