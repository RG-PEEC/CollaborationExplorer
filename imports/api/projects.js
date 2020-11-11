import { Mongo } from 'meteor/mongo';
import { CouplingType } from './couplingTypes';
import { TagType } from './tagTypes';

const mongoName = 'projects';
export const Projects = new Mongo.Collection(mongoName);
export class Project {
    constructor(name, lastEdited, videos, personToRoom, activePersons) {
        this.dominos = [];
        this.tags = [];
        this.participants = []; // Display names of participants, not necessarily set
        this.couplingTypes = [];
        this.tagTypes = [];
        this.logLines = [];
        this.logColumns = [];
        this.logTimestampColumn = null;
        this.name = name;
        this.lastEdited = lastEdited;
        this.videos = videos;
        this.personToRoom = personToRoom; // default configuration for new dominos
        this.activePersons = activePersons; // default configuration for new dominos
    }

    addDomino(domino) {
        this.dominos.push(domino);
    }

    addDefaultCouplingTypes() {
        const defaultCouplingTypes = [
            new CouplingType('DISC', '#ff0000'),
            new CouplingType('VE', '#ff7f00'),
            new CouplingType('SV', '#ffd400'),
            new CouplingType('SDIC', '#ffff00'),
            new CouplingType('SIDD', '#6aff00'),
            new CouplingType('SISSV', '#6affaa'),
            new CouplingType('SSP', '#00eaff'),
            new CouplingType('SGP', '#0040ff'),
            new CouplingType('DP', '#aa00ff', false, false),
            new CouplingType('D', '#ff00aa', false, true),
        ];

        for (const couplingType of defaultCouplingTypes) {
            this.couplingTypes.push(couplingType);
        }
    }

    addDefaultTagTypes() {
        this.tagTypes.push(new TagType('Default', '#0000bb'));
    }
}

if (Meteor.isServer) {
    Meteor.publish(mongoName, function () {
        return Projects.find();
    });
}

export function setProjectLastEdited(id) {
    Projects.update({ _id: id }, { $set: { lastEdited: new Date() } });
}