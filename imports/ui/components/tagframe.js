import { Template } from 'meteor/templating';
import { TagTypes, getTagTypes, TagType } from '../../api/tagTypes';
import { ReactiveVar } from 'meteor/reactive-var'
import '@simonwep/pickr/dist/themes/classic.min.css';
import { BsMultiSelect } from '@dashboardcode/bsmultiselect/dist/js/BsMultiSelect.esm.min.js';
import './tagframe.html';
import { Projects, setProjectLastEdited } from '../../api/projects';
import { getFormattedTimeFromSeconds, getSecondsFromFormattedTime } from '../utils/timeFormatting';
import { Tag } from '../../api/tag';
import _ from 'lodash';
import { getStreamPos } from '../utils/streamPos';
import { getClientVar } from '../utils/clientVar';

let typeFilterMs = null;
let participantFilterMs = null;
let typeFilter = new ReactiveVar();
let textFilter = new ReactiveVar();
let sortTimeAscending = new ReactiveVar();
let participantsFilter = new ReactiveVar();
let viewIsUnloading = false;

Template.tagframe.helpers({
    tagTypes: function () {
        return getTagTypes(Template.currentData()._id);
    },
    tags: function () {
        const sortAsc = sortTimeAscending.get();
        const participantsFilterData = participantsFilter.get();
        const typeFilterData = typeFilter.get();
        const textFilterData = textFilter.get();

        return Projects.findOne({ _id: Template.currentData()._id }, { fields: { tags: 1 } }).tags
            .filter(function (element) {
                return participantsFilterData.every(f => element.participants.includes(f)) &&
                    (typeFilterData.length === 0 || typeFilterData.some(f => element.type === f)) &&
                    element.text.includes(textFilterData);
            })
            .sort(function (a, b) {
                if (sortAsc)
                    return a.startSec - b.startSec;
                return b.startSec - a.startSec;
            });
    },
    timeColText: function () {
        if (sortTimeAscending.get())
            return "Time ▲";
        return "Time ▼";
    },
    allParticipants: function () {
        return Projects.findOne({ _id: Template.currentData()._id }, { fields: { participants: 1 } }).participants;
    },
    anyParticipants: function () {
        return Projects.findOne({ _id: Template.currentData()._id }, { fields: { participants: 1 } }).participants.length > 0;
    },
    arrayToCommaString: function (arr) {
        return arr.join(", ");
    },
    formattedTime: function (tag) {
        const start = getFormattedTimeFromSeconds(tag.startSec);
        if (tag.durationSec <= 0)
            return start;
        return `${start} - ${getFormattedTimeFromSeconds(tag.startSec + tag.durationSec)}`;
    },
    getProgressStyle(tag) {
        const streamPos = getStreamPos();
        const percent = Math.max(0, Math.min((streamPos - tag.startSec) / Math.max(tag.durationSec, 0.1), 1) * 100);
        return `background: linear-gradient(to right, rgba(125, 250, 0, 0.5) 0%, rgba(125, 250, 0, 0.5) ${percent}%, white ${percent}%, white 100%);`;
    },
    getTagTypeStyle(tagTypeName) {
        return getTagTypeStyleForProject(tagTypeName, Template.parentData()._id);
    }
});

function destroyTypeFilters() {
    if (typeFilterMs) {
        typeFilterMs.dispose();
        typeFilterMs = null;
    }
    if (participantFilterMs) {
        participantFilterMs.dispose();
        participantFilterMs = null;
    }
}

Template.tagframe.onDestroyed(function () {
    viewIsUnloading = true;
    destroyTypeFilters();
});

Template.tagframe.onCreated(function () {
    viewIsUnloading = false;
    participantsFilter.set([]);
    typeFilter.set([]);
    textFilter.set("");
    sortTimeAscending.set(localStorage.getItem('user.tags-time-ascending') === "true");
});

Template.tagframe.onRendered(function () {
    Tracker.autorun(updateStreamTimePlaceholders);
    Tracker.autorun(function () {
        if (viewIsUnloading)
            return; // For some reason this autorun is called after the onDestroyed callback >:(

        var environment = { window, Popper };

        if (!this.id)
            this.id = Template.currentData()._id;

        destroyTypeFilters(this);

        // Query dependencies to make meteor do its reactive magic
        getTagTypes(this.id);
        Projects.findOne({ _id: this.id }, { fields: { participants: 1 } }).participants;

        // Todo: Find a better way to handle BsMultiSelect events the meteor way than forwarding them using this hack
        environment.trigger = (element, eventName) => {
            if (eventName === "dashboardcode.multiselect:change") {
                $(element).trigger('click');
            }
        }

        setTimeout(function () {
            typeFilterMs = BsMultiSelect($("#filteredTagTypes")[0], environment, {
                cssPatch: {
                    picks: { listStyleType: 'none', display: 'flex', flexWrap: 'nowrap', height: 'auto', marginBottom: '0', overflow: 'hidden' },
                }
            });
            participantFilterMs = BsMultiSelect($("#filteredParticipants")[0], environment, {
                cssPatch: {
                    picks: { listStyleType: 'none', display: 'flex', flexWrap: 'nowrap', height: 'auto', marginBottom: '0', overflow: 'hidden' },
                }
            });
            $(typeFilterMs.getChoices()).children("li").each((i, el) => {
                el.style = getTagTypeStyleForProject(el.innerText, this.id);
            });
        }, 0);
    });
});

Template.tagframe.events({
    'input #tagStartSec': updateStreamTimePlaceholders,
    'input #tagDurationSec': updateStreamTimePlaceholders,
    'click #btnAllParticipants'(event) {
        $(".participant-checkbox").prop("checked", true);
    },
    'click #btnNoParticipants'(event) {
        $(".participant-checkbox:checked").prop("checked", false);
    },
    'click #tagInsert'(event) {
        if (event.originalEvent.x === 0 && event.originalEvent.y === 0) {
            event.preventDefault();
            return; // Cheap spacebar detection. Mouse/touch clicks have x and y set
        }

        const startSec = getCurrentInsertTime();
        const durationSec = getCurrentInsertDuration();
        const tagText = $("#tagTextInput").val();
        const tagType = $("#selectedTagType").val();
        const participants = $(".participant-checkbox:checked").toArray().map(el => $(el).attr('data-participant'));

        const newTag = new Tag(tagText, startSec, durationSec, tagType, participants);
        Projects.update({ _id: Template.currentData()._id }, { $push: { tags: newTag } });
        setProjectLastEdited(Template.currentData()._id);

        $("#tagStartSec").val("");
        $("#tagDurationSec").val("");
        $("#tagTextInput").val("");
    },
    'click .delete-tag-instance'(event) {
        Projects.update({ _id: Template.currentData()._id }, { $pull: { tags: { id: $(event.target).attr("data-id") } } });
        setProjectLastEdited(Template.currentData()._id);
    },
    'click #timeHeader'(event) {
        event.preventDefault();

        const sortAscVar = sortTimeAscending;
        const newSortAsc = !sortAscVar.get();
        sortAscVar.set(newSortAsc);
        localStorage.setItem('user.tags-time-ascending', newSortAsc); // set default sort for next launch
    },
    'click #filteredParticipants'(event) {
        const participants = [];

        for (const opt of event.currentTarget) {
            if (opt.selected)
                participants.push(opt.innerText);
        }

        participantsFilter.set(participants);
    },
    'click #filteredTagTypes'(event) {
        const tagTypes = [];

        for (const opt of event.currentTarget) {
            if (opt.selected)
                tagTypes.push(opt.innerText);
        }

        typeFilter.set(tagTypes);
    },
    'input #filteredText'(event) {
        updateTextFilterDebounced(textFilter);
    },
    'input #tagStartSec': _.debounce(validateTagInput, 500),
    'input #tagDurationSec': _.debounce(validateTagInput, 500)
});

updateTextFilterDebounced = _.debounce(function (v) {
    v.set($("#filteredText").val());
}, 256);

function validateTagInput() {
    const alert = $("#tagAlert");
    const streamEnd = getStreamPos() + Number(getClientVar("streamframe.duration" + Session.get("projectId")));
    const currentTime = getCurrentInsertTime();
    const currentDuration = getCurrentInsertDuration();
    const insertEnd = currentTime + currentDuration;
    const errorText = [];
    let allowInsert = true;

    if (isNaN(currentTime)) {
        errorText.push("Invalid tag time: Use hh:mm:ss, mm:ss or ss.");
        $("#tagStartSec").addClass("is-invalid");
        allowInsert = false;
    } else {
        $("#tagStartSec").removeClass("is-invalid");
    }

    if (isNaN(currentDuration) || currentDuration < 0) {
        errorText.push("Invalid tag duration: Use hh:mm:ss, mm:ss or ss.")
        $("#tagDurationSec").addClass("is-invalid");
        allowInsert = false;
    } else {
        $("#tagDurationSec").removeClass("is-invalid");
    }

    if (streamEnd && streamEnd < insertEnd || currentTime < 0) {
        errorText.push("The time for your tag is outside of the video.")
    }

    if (allowInsert) {
        $("#tagInsert").prop('disabled', false);
    } else {
        $("#tagInsert").prop('disabled', true);
    }

    if (errorText.length > 0) {
        $("#tagAlertText").text(errorText.join("\n"));
        alert.show();
    } else {
        alert.hide();
    }
}

function getCurrentInsertTime() {
    return $("#tagStartSec").val() === "" ? getStreamPos() : getSecondsFromFormattedTime($("#tagStartSec").val());
}

function getCurrentInsertDuration() {
    return $("#tagDurationSec").val() === "" ? getDefaultDuration() : getSecondsFromFormattedTime($("#tagDurationSec").val());
}

function updateStreamTimePlaceholders() {
    $("#tagStartSec").attr("placeholder", `Start: ${getFormattedTimeFromSeconds(getStreamPos())}`);
    $("#tagDurationSec").attr("placeholder", `Duration: ${getFormattedTimeFromSeconds(getDefaultDuration())}`);
}

function getDefaultDuration() {
    const streamPos = getStreamPos();
    const formattedStartSec = $("#tagStartSec").val();
    let startSec = formattedStartSec === "" ? streamPos : getSecondsFromFormattedTime(formattedStartSec);
    if (isNaN(startSec))
        startSec = streamPos;
    return Math.max(streamPos - startSec, 0);
}

function getTagTypeStyleForProject(tagTypeName, projectId) {
    const myTagType = getTagTypes(projectId).find(item => item.name === tagTypeName);
    if (!myTagType) {
        console.warn("Cannot find tag name '" + tagTypeName + "'");
        return `color: grey; font-weight: bold;`;
    }
    return `color: ${myTagType.color}; font-weight: bold;`;
}