import { Template } from 'meteor/templating';
import { Projects, Project } from '../../api/projects';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import _ from 'lodash';

import './newproject.html';
import { Domino } from '../../api/domino';
import { Video } from '../../api/video';
import { DominoRenderer, getDotPositionFromEvent } from '../utils/dominoRenderer';
import { createDominosFromCsv } from '../utils/importExport';
import { TagTypes, TagType } from '../../api/tagTypes';

const people = [0, 1, 2, 3];
const renderer = new DominoRenderer(200); // this can't easily be changed - need to adapt css and html
let dominoConfig = new Domino({}, { [0]: 0, [1]: 0, [2]: 0, [3]: 0 }, [0, 1, 2, 3]);
let highlightedElement = -1;

Template.newproject.helpers({
    dominoConfig,
    people,
    p2r: dominoConfig.personToRoom,
    plusOne: function (num) {
        return num + 1;
    }
});

Template.newproject.onRendered(function () {
    renderDomino(); // initial render of domino after template rendered
});

function renderDomino() {
    const canvas = $("#inpDomino")[0];
    const ctx = canvas.getContext("2d");

    renderer.renderBackground(ctx);
    renderer.renderDominoPersonDots(ctx, dominoConfig);
    renderer.renderDominoRoomLines(ctx, dominoConfig);

    ctx.font = "32px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const person of people) {
        if (highlightedElement === person) {
            ctx.fillStyle = '#888888';
            renderer.renderDot(ctx, person, renderer.dotRadius);
        }

        const pos = renderer.getDotPosition(person);
        ctx.strokeText(person + 1, pos.x, pos.y);
    }
}

Template.newproject.events({
    'change .room-input'(event) {
        const value = Number(event.currentTarget.value);
        const person = event.currentTarget.attributes['data-room'].value;

        dominoConfig.personToRoom[person] = value;
        renderDomino();
    },
    'mouseleave .project-domino'(event) {
        if (highlightedElement >= 0) { // reset hover effect
            highlightedElement = -1;
            renderDomino();
        }
    },
    'mousemove .project-domino'(event) {
        const hoveredDot = getDotPositionFromEvent(event, renderer);
        if (highlightedElement !== hoveredDot) {
            highlightedElement = hoveredDot;
            renderDomino(); // rerender with hover effect
        }
    },
    'click .project-domino'(event) {
        const clickedDot = getDotPositionFromEvent(event, renderer);
        const activePersons = dominoConfig.activePersons;
        if (clickedDot < 0)
            return;

        if (activePersons.includes(clickedDot)) {
            activePersons.splice(activePersons.indexOf(clickedDot), 1);
        } else {
            activePersons.push(clickedDot);
        }
        renderDomino();
    },
    async 'submit .new-proj'(event) {
        event.preventDefault();

        const target = event.target;
        const name = target.name.value;
        const videos = target.videos.files;
        const dominosCsv = target.dominos.files[0];

        if (!name) {
            showError("Please specify a name for the project.")
            return;
        }

        let dominos = [];
        if (dominosCsv)
            dominos = await createDominosFromCsv(dominosCsv);

        let videoObjects = [];
        for (const file of videos) {
            videoObjects.push(new Video(file.name, URL.createObjectURL(file)));
        }

        if (videos.length == 0) {
            showError("Please select at least one video.")
            return;
        }

        const project = new Project(
            name,
            new Date(),
            videoObjects,
            dominoConfig.personToRoom,
            dominoConfig.activePersons
        );
        project.dominos = dominos;
        project.addDefaultCouplingTypes();
        project.addDefaultTagTypes();

        Projects.insert(
            project,
            function (err, id) {
                if (err)
                    FlowRouter.go('notfound');
                else {
                    FlowRouter.go('project', { _id: id });
                }
            });
    },
});

function showError(text) {
    const errorBox = $('#newProjectError');
    errorBox[0].innerHTML = text;
    errorBox.show();
}
