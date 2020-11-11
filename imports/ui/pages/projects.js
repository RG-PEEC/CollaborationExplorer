import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Projects } from '../../api/projects';
import { format } from 'timeago.js';

import './projects.html';

let projectToDelete = null;
let projectToDeleteName = null;

Template.projects.helpers({
    projects: function () {
        return Projects.find().fetch().sort((a, b) => b.lastEdited - a.lastEdited)
    },
    formatTimeAgo: function (time) {
        return format(time, 'de_DE');
    },
    hasCommitHash: function () {
        return !!Meteor.gitCommitHash;
    },
    commitHash: function () {
        return Meteor.gitCommitHash.slice(0, 7);
    }
});

Template.projects.events({
    'click #btnDeleteProjectConfirm'(event) {
        const confirmedText = $("#inpDeleteProjectName").val();

        if (confirmedText === projectToDeleteName && projectToDelete) {
            Projects.remove(projectToDelete);
            $("#deleteModal").modal("hide");
        } else {
            $("#alertWrongProjectName").show();
        }
    },
    'click .delete-project'(event) {
        event.preventDefault();

        projectToDelete = $(event.currentTarget).attr("data-delete-id");
        projectToDeleteName = $(event.currentTarget).attr("data-name");

        $("#inpDeleteProjectName").val("");
        $("#alertWrongProjectName").hide();
        $("#deleteModal").modal();
    },
    'click .open-proj'(event) {
        event.preventDefault();

        if ($(event.target).hasClass("delete-project"))
            return;

        const projectId = $(event.currentTarget).attr("data-proj-id");
        if (projectId)
            FlowRouter.go('project', { _id: projectId });
    }
});
