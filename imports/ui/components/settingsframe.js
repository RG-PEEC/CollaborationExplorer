import './settingsframe.html';
import { Template } from 'meteor/templating';
import { TagTypes, getTagTypes, TagType } from '../../api/tagTypes';
import { Projects, setProjectLastEdited } from '../../api/projects';
import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/classic.min.css';
import { createDominosFromCsv, downloadObject, download, readCsv, createCsvFromObjects, createCsvFromDominos } from '../utils/importExport';
import { CouplingType, getCouplingTypes } from '../../api/couplingTypes';
import _ from 'lodash';

const importModalLines = new ReactiveVar();

Template.settingsframe.helpers({
    tags: function () {
        return getTagTypes(Template.currentData()._id);
    },
    moreThanOneTagTypeExists: function () {
        return getTagTypes(Template.parentData()._id).length > 1;
    },
    moreThanOneCouplingExists: function () {
        return getCouplingTypes(Template.parentData()._id).length > 1;
    },
    participants: function () {
        return Projects.findOne({ _id: this._id }, { fields: { participants: 1 } }).participants;
    },
    couplingTypes: function () {
        return getCouplingTypes(this._id);
    },
    importLogfileColumns: function () {
        const lines = importModalLines.get();
        if (!lines)
            return [];
        return Object.keys(lines[0]);
    },
});

Template.settingsframe.onRendered(function () {
    function applyTagInputColor(color) {
        $("#tagTypeName").css('background', "linear-gradient(to right, white 20%, " + color.toRGBA().toString() + ")");
    };

    function applyCouplingsInputColor(color) {
        $("#couplingName").css('background', "linear-gradient(to right, white 20%, " + color.toRGBA().toString() + ")");
    };

    tagColorPicker = createColorPicker('.tag-color-picker');
    tagColorPicker.on('save', function (color) {
        applyTagInputColor(color);
        tagColorPicker.hide();
    });
    tagColorPicker.on('init', function (pickr) {
        applyTagInputColor(pickr.getColor());
    });

    couplingColorPicker = createColorPicker('.tag-color-picker-couplings', '#ff0000');
    couplingColorPicker.on('save', function (color) {
        applyCouplingsInputColor(color);
        couplingColorPicker.hide();
    });
    couplingColorPicker.on('init', function (pickr) {
        applyCouplingsInputColor(pickr.getColor());
    });
});

Template.settingsframe.events({
    'click .delete-tag'(event) {
        Projects.update({ _id: Template.currentData()._id }, { $pull: { tagTypes: { name: $(event.target).attr('data-name') } } });
        setProjectLastEdited(Template.currentData()._id);
    },
    'click .delete-participant'(event) {
        Projects.update({ _id: Template.currentData()._id }, { $pull: { participants: $(event.target).attr('data-name') } });
        setProjectLastEdited(Template.currentData()._id);
    },
    'click .delete-coupling'(event) {
        Projects.update({ _id: Template.currentData()._id }, { $pull: { couplingTypes: { name: $(event.target).attr('data-name') } } });
        setProjectLastEdited(Template.currentData()._id);
    },
    'click #insertTagType'(event) {
        insertTagType();
    },
    'click #insertParticipant'(event) {
        insertParticipant();
    },
    'keypress #participantName'(event) {
        if (event.which === 13) { // Enter key press
            insertParticipant();
        }
    },
    'keypress #tagTypeName'(event) {
        if (event.which === 13) { // Enter key press
            insertTagType();
        }
    },
    'keypress #couplingName'(event) {
        if (event.which === 13) { // Enter key press
            insertCouplingType();
        }
    },
    'click #btnExportDominos'(event) {
        const dominos = Projects.findOne({ _id: this._id }, { fields: { dominos: 1 } }).dominos.sort(function (a, b) {
            if (!a.startSec)
                return -1;
            return a.startSec > b.startSec ? 1 : a.startSec < b.startSec ? -1 : 0;
        });
        download("dominos.csv", createCsvFromDominos(dominos));
    },
    'click #btnExportTagsCsv'(event) {
        const tags = getTagsForExport(this._id);
        download("tags.csv", createCsvFromObjects(tags));
    },
    'click #btnExportTagsJson'(event) {
        const tags = getTagsForExport(this._id);
        downloadObject(tags, "tags");
    },
    'click #btnExportProject'(event) {
        const project = Projects.findOne({ _id: this._id });
        downloadObject(project, this.name);
    },
    'click #btnImportDominos'(event) {
        var fileDialog = document.createElement('input');
        const id = Template.currentData()._id;
        fileDialog.type = 'file';

        fileDialog.onchange = async diag => {

            for (const file of diag.target.files) {
                const newDominos = await createDominosFromCsv(file);

                Projects.update({ _id: id }, { $set: { 'dominos': newDominos } });
                setProjectLastEdited(id);
            }
        };

        fileDialog.click();
    },
    'click #btnLoadLogs'(event) {
        var fileDialog = document.createElement('input');
        fileDialog.type = 'file';

        fileDialog.onchange = async diag => {
            const lines = await readCsv(diag.target.files[0]);
            if (lines.length < 1)
                return;

            importModalLines.set(lines);
            $("#logfileModal").modal();
            $("#logfileModalTitle").text("Logfile " + diag.target.files[0].name);
            $("#timestampOffset").val(Number(lines[0].timestamp || 0));
        };

        fileDialog.click();
    },
    'click #btnImportLogfile'(event) {
        const columns = $(".column-checkbox:checked").toArray().map(el => $(el).attr("data-import"));
        const timestampColumnSelect = $("#timestampColumn")[0];
        const timestampColumnIndex = timestampColumnSelect.selectedIndex;
        const timestampColumn = timestampColumnIndex === 0 ? null : timestampColumnSelect.options[timestampColumnSelect.selectedIndex].value;
        const timeOffset = Number($("#timestampOffset").val() || 0);
        const filteredHeaders = Object.keys(_.pick(importModalLines.get()[0], columns));
        const filteredLines = importModalLines.get().map(line => {
            return {
                line: Object.values(_.pick(line, columns)),
                timestamp: (Number(line[timestampColumn]) - timeOffset) || 0
            };
        }).sort(function (a, b) {
            return a.timestamp - b.timestamp;
        });

        Projects.update({ _id: this._id }, {
            $set: {
                lastEdited: new Date(),
                logTimestampColumn: timestampColumn || null,
                logLines: filteredLines,
                logColumns: filteredHeaders
            }
        });

        $("#logfileModal").modal('hide');
    },
    'click #insertCoupling'(event) {
        insertCouplingType();
    },
});

function getTagsForExport(projectId) {
    return Projects.findOne({ _id: projectId }, { fields: { tags: 1 } }).tags.map(tag => ({
        id: tag.id,
        text: tag.text,
        startMs: tag.startSec * 1000,
        durationMs: tag.durationSec * 1000,
        type: tag.type,
        participants: tag.participants
    }));
}

function createColorPicker(el, defaultColor = '#0000aa') {
    return Pickr.create({
        el,
        theme: 'classic',
        swatches: null,
        default: defaultColor,
        components: {
            preview: true,
            opacity: false,
            hue: true,
            interaction: {
                hex: false,  // Display 'input/output format as hex' button  (hexadecimal representation of the rgba value)
                rgba: false, // Display 'input/output format as rgba' button (red green blue and alpha)
                hsla: false, // Display 'input/output format as hsla' button (hue saturation lightness and alpha)
                hsva: false, // Display 'input/output format as hsva' button (hue saturation value and alpha)
                cmyk: false, // Display 'input/output format as cmyk' button (cyan mangenta yellow key )

                input: false, // Display input/output textbox which shows the selected color value.
                // the format of the input is determined by defaultRepresentation,
                // and can be changed by the user with the buttons set by hex, rgba, hsla, etc (above).
                cancel: true, // Display Cancel Button, resets the color to the previous state
                clear: false, // Display Clear Button; same as cancel, but keeps the window open
                save: true,  // Display Save Button,
            },
        }
    });
}

function insertParticipant() {
    const newParticipant = $("#participantName").val();
    if (newParticipant && newParticipant !== "") {
        Projects.update({ _id: Template.currentData()._id }, { $push: { participants: newParticipant } });
        setProjectLastEdited(Template.currentData()._id);
        $("#participantName").val("");
    }
}

function insertTagType() {
    const newType = new TagType($("#tagTypeName").val(), tagColorPicker.getColor().toRGBA().toString(), Template.currentData()._id);
    if (newType.name && newType.name !== "") {
        Projects.update({ _id: Template.currentData()._id }, { $push: { tagTypes: newType } });
        setProjectLastEdited(Template.currentData()._id);
        $("#tagTypeName").val("");
    }
}

function insertCouplingType() {
    const multiple = $("#optMultiple").hasClass("active");
    const render = $("#optRender").hasClass("active");
    const name = $("#couplingName").val();
    const color = couplingColorPicker.getColor().toRGBA().toString();
    const newCoupling = new CouplingType(name, color, multiple, !render);

    if (newCoupling.name && newCoupling.name !== "") {
        Projects.update({ _id: Template.currentData()._id }, { $push: { couplingTypes: newCoupling } });
        setProjectLastEdited(Template.currentData()._id);
        $("#couplingName").val("");
    }
}
